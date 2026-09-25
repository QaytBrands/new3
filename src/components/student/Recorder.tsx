"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

type EngineResult = {
  provider: string;
  capabilities: { transcription: boolean; scoring: boolean; phonemeFeedback: boolean };
  transcription: string | null;
  transcriptMatches: boolean | null;
  score: number | null;
  errors: string[];
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

function createRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "de-DE";
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.continuous = false;
  return r;
}

const MAX_MS = 6000;

/**
 * Records the student's pronunciation, transcribes it with the browser's speech recognition
 * where available, and sends both to the server's PronunciationEngine.
 */
export function Recorder({
  vocabularyId,
  expected,
  onSaved,
  compact = false,
}: {
  vocabularyId: string;
  expected: string;
  onSaved?: (attemptId: string, result: EngineResult) => void;
  compact?: boolean;
}) {
  const [state, setState] = useState<"idle" | "recording" | "recorded" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [supportsStt, setSupportsStt] = useState(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const transcript = useRef<string | null>(null);
  const blob = useRef<Blob | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSupportsStt(!!createRecognition());
    return () => {
      if (timer.current) clearTimeout(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  async function start() {
    setError(null);
    setResult(null);
    transcript.current = null;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording isn't supported in this browser.");
      setState("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        blob.current = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob.current));
        setState("recorded");
      };
      recorder.current = mr;
      mr.start();

      const rec = createRecognition();
      if (rec) {
        rec.onresult = (e) => {
          transcript.current = e.results[0]?.[0]?.transcript ?? null;
        };
        rec.onerror = () => {};
        try {
          rec.start();
          recognition.current = rec;
        } catch {
          recognition.current = null;
        }
      }
      setState("recording");
      timer.current = setTimeout(stop, MAX_MS);
    } catch {
      setError("Microphone access was blocked. Allow microphone access to record.");
      setState("error");
    }
  }

  function stop() {
    if (timer.current) clearTimeout(timer.current);
    recognition.current?.stop();
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function send() {
    setState("saving");
    // Give the recogniser a moment to deliver its final result.
    await new Promise((r) => setTimeout(r, 400));
    const fd = new FormData();
    fd.set("vocabularyId", vocabularyId);
    if (transcript.current) fd.set("transcript", transcript.current);
    if (blob.current) fd.set("audio", blob.current, "recording");
    try {
      const res = await fetch("/api/recordings", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { id: string; result: EngineResult };
      setResult(json.result);
      setState("saved");
      onSaved?.(json.id, json.result);
    } catch {
      setError("Couldn't save the recording. Please try again.");
      setState("recorded");
    }
  }

  return (
    <div className={clsx("flex flex-col items-center gap-3", compact ? "" : "py-2")}>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {state !== "recording" ? (
          <button type="button" onClick={start} disabled={state === "saving"} className="btn-secondary border-rose-200 text-rose-700">
            <span className="inline-block h-3 w-3 rounded-full bg-rose-500" aria-hidden />
            {state === "idle" || state === "error" ? "Record" : "Record again"}
          </button>
        ) : (
          <button type="button" onClick={stop} className="btn bg-rose-600 text-white">
            <span className="inline-block h-3 w-3 animate-pulse rounded-sm bg-white" aria-hidden /> Stop
          </button>
        )}
        {audioUrl && state !== "recording" && (
          <button type="button" onClick={() => new Audio(audioUrl).play()} className="btn-secondary">▶ Play mine</button>
        )}
        {state === "recorded" && (
          <button type="button" onClick={send} className="btn-primary">Check</button>
        )}
        {state === "saving" && <span className="text-sm text-slate-500">Analysing…</span>}
      </div>
      {state === "recording" && <p className="text-sm text-rose-600">Recording… say “{expected}”</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!supportsStt && state === "idle" && (
        <p className="text-center text-xs text-slate-400">Speech recognition isn't available in this browser; your recording will be saved without a transcript.</p>
      )}
      {result && (
        <div className="w-full rounded-xl bg-slate-50 p-3 text-sm">
          {result.transcription ? (
            <p>
              We heard: <strong>“{result.transcription}”</strong>{" "}
              {result.transcriptMatches ? (
                <span className="font-semibold text-emerald-600">✓ matches</span>
              ) : (
                <span className="font-semibold text-amber-600">— doesn’t match “{expected}”</span>
              )}
            </p>
          ) : (
            <p className="text-slate-500">Recording saved. No transcript was available.</p>
          )}
          {result.score !== null ? (
            <p className="mt-1">Pronunciation score: <strong>{Math.round(result.score)}</strong>/100</p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">Pronunciation scoring isn’t available yet — compare your recording with the reference audio.</p>
          )}
        </div>
      )}
    </div>
  );
}
