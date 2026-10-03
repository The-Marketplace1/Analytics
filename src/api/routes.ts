import { Router, type NextFunction, type Request, type Response } from "express";
import { requireRole } from "../authorization/index.js";
import { AnalyticsError } from "../errors/index.js";
import { pseudonymise } from "../privacy/policy.js";
import { summarize } from "../reporting/summary.js";
import { recordPipelineMetric } from "../telemetry/index.js";
import { parseEventBatch } from "../validation/index.js";
import type { AnalyticsContext } from "./context.js";

export function createRouter(context: AnalyticsContext): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "analytics" });
  });

  router.post("/v1/events/batch", async (request, response, next) => {
    try {
      requireRole(request, ["ingest", "admin"], context.authorizer);
      const batch = parseEventBatch(request.body);
      const result = await context.pipeline.trackBatch(batch.events);
      recordPipelineMetric("events.accepted", result.accepted.length);
      if (result.dropped > 0) recordPipelineMetric("events.dropped", result.dropped);
      response.status(202).json({
        accepted: result.accepted.map((event) => event.eventId),
        dropped: result.dropped,
        duplicates: result.duplicates,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/v1/reports/summary", (request, response, next) => {
    try {
      requireRole(request, ["analyst", "admin"], context.authorizer);
      const from = queryString(request, "from");
      const to = queryString(request, "to");
      if (
        (from && !Number.isFinite(Date.parse(from))) ||
        (to && !Number.isFinite(Date.parse(to))) ||
        (from && to && Date.parse(from) > Date.parse(to))
      ) {
        throw new AnalyticsError("INVALID_DATE_RANGE", "Report dates must be valid and from must not exceed to", 422);
      }
      const report = summarize(context.store.all(), {
        from,
        to,
        environment: environmentQuery(request),
      });
      response.json(report);
    } catch (error) {
      next(error);
    }
  });

  router.post("/v1/privacy/deletion-requests", async (request, response, next) => {
    try {
      requireRole(request, ["admin"], context.authorizer);
      const userId = typeof request.body?.userId === "string" ? request.body.userId.trim() : "";
      if (!userId) throw new AnalyticsError("INVALID_REQUEST", "userId is required", 422);
      const pseudonymisedId = pseudonymise(userId, context.pseudonymisationKey);
      await context.dispatcher.deleteByUser(pseudonymisedId);
      const deleted = context.store.deleteByUser(pseudonymisedId);
      recordPipelineMetric("events.deleted", deleted);
      response.status(202).json({ deleted });
    } catch (error) {
      next(error);
    }
  });

  router.post("/v1/privacy/retention/purge", async (request, response, next) => {
    try {
      requireRole(request, ["admin"], context.authorizer);
      const cutoff = context.retentionPolicy.cutoff();
      await context.dispatcher.deleteOlderThan(cutoff);
      const deleted = context.store.deleteOlderThan(cutoff);
      recordPipelineMetric("events.deleted", deleted);
      response.status(202).json({ deleted, cutoff, retentionDays: context.retentionPolicy.days });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function queryString(request: Request, key: string): string | undefined {
  const value = request.query[key];
  return typeof value === "string" ? value : undefined;
}

function environmentQuery(request: Request) {
  const value = queryString(request, "environment");
  return value === "development" || value === "test" || value === "staging" || value === "production"
    ? value
    : undefined;
}

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  if (error instanceof AnalyticsError) {
    response.status(error.statusCode).json({ error: error.code, message: error.message });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: "INVALID_JSON", message: "Request body must be valid JSON" });
    return;
  }
  response.status(500).json({ error: "INTERNAL_ERROR", message: "Analytics request failed" });
}
