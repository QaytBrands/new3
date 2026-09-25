import { BrowserTranscriptEngine, NullEngine } from "./engines";
import type { PronunciationEngine } from "./types";

export type { PronunciationEngine, PronunciationResult } from "./types";

const engines: Record<string, () => PronunciationEngine> = {
  "browser-transcript": () => new BrowserTranscriptEngine(),
  none: () => new NullEngine(),
  // Register future scoring providers here, e.g. "azure": () => new AzurePronunciationEngine(...)
};

export function getPronunciationEngine(name = process.env.PRONUNCIATION_ENGINE): PronunciationEngine {
  return (engines[name ?? ""] ?? engines["browser-transcript"])();
}
