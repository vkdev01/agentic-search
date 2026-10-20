/**
 * Chat-screen content and labels. Edit here to change the welcome suggestions or provider names.
 */

/** Suggested questions on the welcome screen. */
export const EXAMPLE_QUESTIONS = [
  "What changed in the latest Next.js release?",
  "Compare Sarvam-105B with other open models for Indian languages",
  "How does the Model Context Protocol work?",
  "Compare PostgreSQL, MySQL and MongoDB for a startup backend",
];

const SEARCH_PROVIDER_LABELS: Record<string, string> = { searxng: "SearXNG", mock: "mock results" };

/** Display name for the API's search provider id (from GET /health). */
export const searchProviderLabel = (id: string) => SEARCH_PROVIDER_LABELS[id] ?? id;
