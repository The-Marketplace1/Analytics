import { ZodError } from "zod";
import { AnalyticsError } from "../errors/index.js";
import { assertCompatibleEventVersion } from "../schemas/compatibility.js";
import { eventBatchSchema } from "../schemas/event.js";

export function parseEventBatch(input: unknown) {
  const result = eventBatchSchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new AnalyticsError("INVALID_EVENT", details, 422);
  }
  for (const event of result.data.events) {
    assertCompatibleEventVersion(event.eventType, event.version);
  }
  return result.data;
}

export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}
