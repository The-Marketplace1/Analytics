export type ActorType = "customer" | "professional" | "staff" | "system" | "anonymous";
export type Platform = "web" | "ios" | "android" | "api" | "unknown";
export type Environment = "development" | "test" | "staging" | "production";
export type AnalyticsRole = "ingest" | "customer" | "professional" | "analyst" | "admin";

export interface AnalyticsPrincipal {
  subject: string;
  roles: AnalyticsRole[];
}

export interface ConsentState {
  analytics: boolean;
  personalised?: boolean;
  updatedAt?: string;
}

export interface EventActor {
  type: ActorType;
  userId?: string;
}

export interface AnalyticsEvent {
  eventId: string;
  eventType: string;
  version: number;
  occurredAt: string;
  actor: EventActor;
  anonymousId?: string;
  userId?: string;
  sessionId?: string;
  platform: Platform;
  application: string;
  environment: Environment;
  resourceType?: string;
  resourceId?: string;
  properties: Record<string, unknown>;
  consent: ConsentState;
}

export interface EnrichedAnalyticsEvent extends AnalyticsEvent {
  properties: Record<string, unknown>;
  enrichment: {
    productArea: string;
    category: string;
    region?: string;
    lifecycleStage?: string;
  };
}

export interface AnalyticsReport {
  from: string;
  to: string;
  environment?: Environment;
  eventCount: number;
  uniqueActors: number;
  uniqueSessions: number;
  eventCounts: Record<string, number>;
  funnel: {
    bookingStarted: number;
    bookingCompleted: number;
    bookingConversionRate: number;
  };
  byPlatform: Record<string, number>;
}

export interface DeletionRequest {
  userId: string;
  reason?: string;
}
