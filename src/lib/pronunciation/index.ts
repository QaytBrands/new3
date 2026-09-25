import { BrowserTranscriptEngine, NullEngine } from "./engines";
import type { PronunciationEngine } from "./types";

export type * from "./types";
export { analyzePronunciation } from "./service";

/**
 * Engine registry. To add a real scoring provider, implement `PronunciationEngine` (declaring
 * `scoring: true` etc.), register it here and set PRONUNCIATION_ENGINE to its key.
 */
const engines: Record<string, () => PronunciationEngine> = {
  "browser-transcript": () => new BrowserTranscriptEngine(),
  none: () => new NullEngine(),
};

export function getPronunciationEngine(name = process.env.PRONUNCIATION_ENGINE): PronunciationEngine {
  return (engines[name ?? ""] ?? engines["browser-transcript"])();
}
