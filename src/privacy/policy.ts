import { createHmac } from "node:crypto";
import { AnalyticsError, ForbiddenDataError } from "../errors/index.js";
import type { AnalyticsEvent } from "../types/index.js";

const forbiddenKeyPattern =
  /password|passwd|access[_-]?token|refresh[_-]?token|secret|private[_-]?key|card[_-]?(number|pan|cvv|cvc)|payment[_-]?card|private[_-]?messages?|message[_-]?(content|body)|precise[_-]?location|latitude|longitude|coordinates?|location|e-?mail|phone|mobile|first[_-]?name|last[_-]?name|full[_-]?name|date[_-]?of[_-]?birth|birthdate|ssn|social[_-]?security|street[_-]?address|postal[_-]?address|iban|bank[_-]?(account|number)|cvv|cvc/i;
const sensitiveValuePattern =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b(?:bearer\s+)?eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/i;
const cardNumberPattern = /^(?:\D*\d){13,19}\D*$/;
const coordinatePairPattern = /-?\d{1,3}\.\d{3,}\s*[,/]\s*-?\d{1,3}\.\d{3,}/;

function inspect(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspect(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === "string") {
    if (
      sensitiveValuePattern.test(value) ||
      coordinatePairPattern.test(value) ||
      containsPaymentCardNumber(value)
    ) {
      throw new ForbiddenDataError(path || "value");
    }
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (forbiddenKeyPattern.test(key)) throw new ForbiddenDataError(nextPath);
    inspect(nested, nextPath);
  }
}

export function assertPrivacySafe(event: AnalyticsEvent): void {
  inspect(event.properties, "properties");
  inspect(event.actor, "actor");
  const region = event.properties.region;
  if (region !== undefined && (typeof region !== "string" || !/^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/i.test(region))) {
    throw new ForbiddenDataError("properties.region");
  }
}

function containsPaymentCardNumber(value: string): boolean {
  if (!cardNumberPattern.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export function pseudonymise(identifier: string, key: string | undefined): string {
  if (!key || Buffer.byteLength(key, "utf8") < 32) {
    throw new AnalyticsError(
      "PSEUDONYMISATION_NOT_CONFIGURED",
      "A pseudonymisation key of at least 32 bytes must be configured",
      503,
    );
  }
  return createHmac("sha256", key).update(identifier, "utf8").digest("hex");
}

export function pseudonymiseEvent(event: AnalyticsEvent, key: string | undefined): AnalyticsEvent {
  return {
    ...event,
    userId: event.userId ? pseudonymise(event.userId, key) : undefined,
    anonymousId: event.anonymousId ? pseudonymise(event.anonymousId, key) : undefined,
    sessionId: event.sessionId ? pseudonymise(event.sessionId, key) : undefined,
    resourceId: event.resourceId ? pseudonymise(event.resourceId, key) : undefined,
    actor: {
      ...event.actor,
      userId: event.actor.userId ? pseudonymise(event.actor.userId, key) : undefined,
    },
    properties: { ...event.properties },
  };
}
