"use client";

import { useState } from "react";
import clsx from "clsx";

export function speakGerman(text: string, rate = 0.9): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  u.rate = rate;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("de"));
  if (voice) u.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}

/**
 * Plays the uploaded reference recording when available; otherwise falls back to the
 * browser's German speech synthesis and labels it as a synthesized voice.
 */
export function AudioButton({
  text,
  audioUrl,
  size = "md",
  label,
  showSource = false,
}: {
  text: string;
  audioUrl?: string | null;
  size?: "sm" | "md" | "lg";
  label?: string;
  showSource?: boolean;
}) {
  const [playing, setPlaying] = useState(false);

  async function play(rate: number) {
    setPlaying(true);
    try {
      if (audioUrl) {
        const a = new Audio(audioUrl);
        a.playbackRate = rate < 0.8 ? 0.75 : 1;
        a.onended = () => setPlaying(false);
        await a.play();
        return;
      }
      speakGerman(text, rate);
    } catch {
      speakGerman(text, rate);
    }
    setTimeout(() => setPlaying(false), 900);
  }

  const dims = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-12 w-12";
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => play(1)}
          aria-label={label ?? `Play pronunciation of ${text}`}
          className={clsx(
            dims,
            "flex items-center justify-center rounded-full bg-brand-600 text-white shadow-md transition hover:bg-brand-700 active:scale-95",
            playing && "ring-4 ring-brand-100",
          )}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={size === "lg" ? "h-7 w-7" : "h-5 w-5"} aria-hidden>
            <path d="M3 10v4a1 1 0 0 0 1 1h3l4 4V5L7 9H4a1 1 0 0 0-1 1zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
          </svg>
        </button>
        {size !== "sm" && (
          <button
            type="button"
            onClick={() => play(0.6)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            aria-label={`Play slowly: ${text}`}
          >
            🐢 Slow
          </button>
        )}
      </div>
      {showSource && (
        <span className="text-[11px] text-slate-400">{audioUrl ? "Reference recording" : "Synthesized voice"}</span>
      )}
    </div>
  );
}
