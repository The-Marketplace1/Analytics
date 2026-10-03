import { z } from "zod";

const actorSchema = z.object({
  type: z.enum(["customer", "professional", "staff", "system", "anonymous"]),
  userId: z.string().min(1).max(200).optional(),
}).strict();

export const consentSchema = z.object({
  analytics: z.boolean(),
  personalised: z.boolean().optional(),
  updatedAt: z.string().datetime().optional(),
}).strict();

export const analyticsEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().regex(/^[a-z][a-z0-9_.-]{1,119}$/),
  version: z.number().int().positive().max(100),
  occurredAt: z.string().datetime(),
  actor: actorSchema,
  anonymousId: z.string().min(1).max(200).optional(),
  userId: z.string().min(1).max(200).optional(),
  sessionId: z.string().min(1).max(200).optional(),
  platform: z.enum(["web", "ios", "android", "api", "unknown"]),
  application: z.string().min(1).max(100),
  environment: z.enum(["development", "test", "staging", "production"]),
  resourceType: z.string().min(1).max(100).optional(),
  resourceId: z.string().min(1).max(200).optional(),
  properties: z.record(z.union([z.string().max(200), z.number().finite(), z.boolean()])),
  consent: consentSchema,
}).strict();

export const eventBatchSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(100),
}).strict();

export type EventInput = z.infer<typeof analyticsEventSchema>;
