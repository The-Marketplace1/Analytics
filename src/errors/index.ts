export class AnalyticsError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "AnalyticsError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ForbiddenDataError extends AnalyticsError {
  constructor(field: string) {
    super("FORBIDDEN_DATA", `Event contains prohibited field: ${field}`, 422);
  }
}

export class DuplicateEventConflictError extends AnalyticsError {
  constructor(eventId: string) {
    super("DUPLICATE_EVENT_CONFLICT", `eventId ${eventId} was already used with different event data`, 409);
  }
}

export class ProviderDispatchError extends AnalyticsError {
  constructor(providerNames: string[]) {
    super(
      "PROVIDER_UNAVAILABLE",
      `Analytics provider delivery failed: ${providerNames.join(", ")}`,
      503,
    );
  }
}
