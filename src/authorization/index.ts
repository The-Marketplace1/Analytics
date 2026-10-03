import { AnalyticsError } from "../errors/index.js";
import type { Request } from "express";
import type { AnalyticsRole } from "../types/index.js";

export type AnalyticsAuthorizer = (
  request: Request,
  allowedRoles: readonly AnalyticsRole[],
) => boolean;

export function requireRole(
  request: Request,
  allowedRoles: readonly AnalyticsRole[],
  authorize: AnalyticsAuthorizer,
): void {
  if (!authorize(request, allowedRoles)) {
    throw new AnalyticsError("FORBIDDEN", "The authenticated principal is not authorised", 403);
  }
}

export const denyByDefault: AnalyticsAuthorizer = () => false;
