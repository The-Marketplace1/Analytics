export const supportedEventAreas = [
  "registration",
  "onboarding",
  "authentication",
  "discovery",
  "booking",
  "availability",
  "payment",
  "communication",
  "notification",
  "review",
  "dispute",
  "engagement",
  "feature",
] as const;

export type SupportedEventArea = (typeof supportedEventAreas)[number];
