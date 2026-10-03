import { AnalyticsError } from "../errors/index.js";

export const CURRENT_EVENT_VERSION = 1;

export function assertCompatibleEventVersion(eventType: string, version: number): void {
  if (version !== CURRENT_EVENT_VERSION) {
    throw new AnalyticsError(
      "UNSUPPORTED_EVENT_VERSION",
      `Event ${eventType} uses unsupported version ${version}; supported version is ${CURRENT_EVENT_VERSION}`,
      422,
    );
  }
}
