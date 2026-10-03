import { MemoryAnalyticsProvider } from "./memory.js";
import { ProviderDispatcher } from "./contracts.js";

export function createProviderDispatcher(): {
  dispatcher: ProviderDispatcher;
  memory: MemoryAnalyticsProvider;
} {
  const memory = new MemoryAnalyticsProvider();
  return { dispatcher: new ProviderDispatcher([memory]), memory };
}

export { MemoryAnalyticsProvider } from "./memory.js";
export { ProviderDispatcher } from "./contracts.js";
export type { AnalyticsProvider } from "./contracts.js";
