import type { AnalyticsEvent, EnrichedAnalyticsEvent } from "../types/index.js";

const categories: Record<string, string> = {
  registration: "account",
  onboarding: "account",
  authentication: "account",
  discovery: "discovery",
  search: "discovery",
  profile: "discovery",
  service: "discovery",
  booking: "booking",
  cancellation: "booking",
  availability: "booking",
  payment: "commerce",
  communication: "engagement",
  notification: "engagement",
  review: "trust",
  dispute: "trust",
  feature: "product",
};

function categoryFor(eventType: string): string {
  const prefix = eventType.split(".")[0] ?? eventType;
  return categories[prefix] ?? "product";
}

export function enrichEvent(event: AnalyticsEvent): EnrichedAnalyticsEvent {
  const properties = event.properties;
  const region = typeof properties.region === "string" ? properties.region : undefined;
  const lifecycleStage =
    typeof properties.lifecycleStage === "string" ? properties.lifecycleStage : undefined;

  return {
    ...event,
    properties: { ...properties },
    enrichment: {
      productArea: categoryFor(event.eventType),
      category: categoryFor(event.eventType),
      ...(region ? { region } : {}),
      ...(lifecycleStage ? { lifecycleStage } : {}),
    },
  };
}
