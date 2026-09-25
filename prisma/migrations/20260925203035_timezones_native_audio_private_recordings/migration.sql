-- Per-user time zone. Existing users (including sample students) default to Asia/Kolkata.
ALTER TABLE "User" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- Reference audio is explicitly "native" audio; the synthesized voice is a client-side fallback.
-- Renamed (not dropped) so existing URLs are preserved.
ALTER TABLE "Vocabulary" RENAME COLUMN "audioUrl" TO "native_audio_url";
ALTER TABLE "ExampleSentence" RENAME COLUMN "audioUrl" TO "native_audio_url";

-- Student recordings are stored privately and referenced by storage key, not a public URL.
ALTER TABLE "PronunciationAttempt" RENAME COLUMN "audioUrl" TO "audio_key";
