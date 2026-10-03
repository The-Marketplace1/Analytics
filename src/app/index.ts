import express, { type Express } from "express";
import { createAnalyticsContext } from "../api/context.js";
import type { AnalyticsContext, AnalyticsDependencies } from "../api/context.js";
import { createRouter, errorHandler } from "../api/routes.js";
import { telemetry } from "../telemetry/index.js";

export function createApp(
  dependencies: AnalyticsDependencies = {},
): { app: Express; context: AnalyticsContext } {
  const app = express();
  const context = createAnalyticsContext(dependencies);

  app.disable("x-powered-by");
  app.use((request, _response, next) => {
    telemetry.info({ method: request.method, path: request.path }, "analytics request");
    next();
  });
  app.use(express.json({ limit: "256kb" }));
  app.use(createRouter(context));
  app.use(errorHandler);

  return { app, context };
}
