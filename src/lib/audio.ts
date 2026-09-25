/**
 * Pronunciation audio resolution. A native-speaker recording (`nativeAudioUrl`) is always
 * preferred; otherwise the client uses the browser's German speech synthesis, and the UI must
 * label it as synthesized.
 */
export type AudioSource =
  | { kind: "native"; url: string; text: string }
  | { kind: "synthesized"; text: string; lang: "de-DE" };

export function resolveAudioSource(text: string, nativeAudioUrl?: string | null): AudioSource {
  const url = nativeAudioUrl?.trim();
  return url ? { kind: "native", url, text } : { kind: "synthesized", text, lang: "de-DE" };
}

export const AUDIO_SOURCE_LABELS: Record<AudioSource["kind"], string> = {
  native: "Native recording",
  synthesized: "Synthesized voice",
};

/** Accepts https URLs or site-relative paths; rejects other schemes (javascript:, data:, http:). */
export function isAllowedAudioUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
