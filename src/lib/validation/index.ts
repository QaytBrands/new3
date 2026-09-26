import { z } from "zod";
import { isAllowedAudioUrl } from "@/lib/audio";

const optionalText = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional()
  .transform((s) => s ?? null);

export const articleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((s) => (s === "" || s === "-" ? null : s))
  .nullable()
  .optional()
  .transform((s) => s ?? null)
  .refine((s) => s === null || ["der", "die", "das"].includes(s), "Article must be der, die or das")
  .transform((s) => (s ? (s.toUpperCase() as "DER" | "DIE" | "DAS") : null));

const nativeAudioUrlSchema = optionalText.refine(
  (v) => v === null || (v.length <= 2000 && isAllowedAudioUrl(v)),
  "Native audio URL must be an https:// URL or a site path starting with /",
);

export const tagsSchema = z
  .string()
  .optional()
  .transform((s) =>
    (s ?? "")
      .split(/[;,]/)
      .map((t) => t.trim())
      .filter(Boolean),
  );

export const vocabularySchema = z.object({
  german: z.string().trim().min(1, "German word is required").max(200),
  english: z.string().trim().min(1, "English meaning is required").max(300),
  article: articleSchema,
  plural: optionalText,
  partOfSpeech: optionalText,
  ipa: optionalText,
  phonetic: optionalText,
  nativeAudioUrl: nativeAudioUrlSchema,
  difficulty: z.coerce.number().int().min(1).max(5).default(1),
  tags: tagsSchema,
});

export type VocabularyInput = z.infer<typeof vocabularySchema>;

export const sentenceSchema = z.object({
  german: z.string().trim().min(1).max(500),
  english: z.string().trim().min(1).max(500),
  nativeAudioUrl: nativeAudioUrlSchema,
});

export const csvRowSchema = vocabularySchema.extend({
  level: z.string().trim().min(1, "level is required").max(20),
  chapter: z.string().trim().min(1, "chapter is required").max(200),
  day: z.coerce.number().int().min(1, "day must be ≥ 1").max(366),
  example_de: z.string().optional(),
  example_en: z.string().optional(),
});

export type CsvRow = z.infer<typeof csvRowSchema>;

export const CSV_COLUMNS = [
  "level",
  "chapter",
  "day",
  "german",
  "english",
  "article",
  "plural",
  "part_of_speech",
  "ipa",
  "phonetic",
  "native_audio_url",
  "example_de",
  "example_en",
  "difficulty",
  "tags",
] as const;

/** Map snake_case CSV headers to schema keys. */
export function normalizeCsvRecord(record: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) {
    const key = k.trim().toLowerCase();
    const mapped =
      key === "part_of_speech"
        ? "partOfSpeech"
        : key === "native_audio_url" || key === "audio_url" // audio_url: legacy header
          ? "nativeAudioUrl"
          : key;
    out[mapped] = v ?? "";
  }
  return out;
}

/** Multiple example sentences are separated by " | " in both example columns. */
export function splitExamples(de?: string, en?: string): { german: string; english: string }[] {
  const des = (de ?? "").split("|").map((s) => s.trim());
  const ens = (en ?? "").split("|").map((s) => s.trim());
  const out: { german: string; english: string }[] = [];
  for (let i = 0; i < des.length; i++) {
    if (des[i]) out.push({ german: des[i], english: ens[i] ?? "" });
  }
  return out;
}

export type CsvValidation = {
  valid: { line: number; row: CsvRow }[];
  errors: { line: number; messages: string[] }[];
};

export function validateCsvRecords(records: Record<string, string>[]): CsvValidation {
  const result: CsvValidation = { valid: [], errors: [] };
  records.forEach((rec, i) => {
    const line = i + 2; // header is line 1
    const parsed = csvRowSchema.safeParse(normalizeCsvRecord(rec));
    if (parsed.success) result.valid.push({ line, row: parsed.data });
    else
      result.errors.push({
        line,
        messages: parsed.error.issues.map((iss) => `${iss.path.join(".") || "row"}: ${iss.message}`),
      });
  });
  return result;
}
