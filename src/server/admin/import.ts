"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";
import { splitExamples, validateCsvRecords, type CsvRow } from "@/lib/validation";
import { audit } from "./common";

export type ImportState = {
  error?: string;
  committed?: boolean;
  preview?: {
    toCreate: number;
    skipped: { line: number; reason: string }[];
    errors: { line: number; messages: string[] }[];
    newChapters: string[];
    newLessons: string[];
    sample: { line: number; level: string; chapter: string; day: number; german: string; english: string; article: string | null }[];
  };
};

const MAX_BYTES = 2 * 1024 * 1024;

type Plan = {
  rows: { line: number; row: CsvRow }[];
  skipped: { line: number; reason: string }[];
  errors: { line: number; messages: string[] }[];
  newChapters: Map<string, { levelId: string; title: string }>;
  newLessons: Set<string>;
};

const chapterKey = (levelId: string, title: string) => `${levelId}::${title.toLowerCase()}`;

async function plan(text: string, canCreateStructure: boolean): Promise<Plan> {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy" });
  const { valid, errors } = validateCsvRecords(parsed.data);
  const result: Plan = { rows: [], skipped: [], errors: [...errors], newChapters: new Map(), newLessons: new Set() };

  const levels = await prisma.level.findMany({
    include: { chapters: { include: { lessons: { include: { vocabulary: { select: { german: true, english: true } } } } } } },
  });
  const levelByCode = new Map(levels.map((l) => [l.code.toUpperCase(), l]));
  const counts = new Map<string, number>(); // "levelId::chapter::day" → words after import
  const seen = new Set<string>();

  for (const { line, row } of valid) {
    const level = levelByCode.get(row.level.toUpperCase());
    if (!level) {
      result.errors.push({ line, messages: [`level: “${row.level}” does not exist — create it first`] });
      continue;
    }
    const chapter = level.chapters.find((c) => c.title.toLowerCase() === row.chapter.toLowerCase());
    const lesson = chapter?.lessons.find((l) => l.dayNumber === row.day);
    if ((!chapter || !lesson) && !canCreateStructure) {
      result.errors.push({ line, messages: ["chapter/day does not exist and you don't have permission to create chapters"] });
      continue;
    }
    const lessonKey = `${chapterKey(level.id, row.chapter)}::${row.day}`;
    const dupKey = `${lessonKey}::${row.german.toLowerCase()}::${row.english.toLowerCase()}`;
    if (seen.has(dupKey) || lesson?.vocabulary.some((v) => v.german.toLowerCase() === row.german.toLowerCase() && v.english.toLowerCase() === row.english.toLowerCase())) {
      result.skipped.push({ line, reason: `“${row.german}” already exists in that lesson` });
      continue;
    }
    const n = (counts.get(lessonKey) ?? lesson?.vocabulary.length ?? 0) + 1;
    if (n > level.wordsPerLesson) {
      result.errors.push({ line, messages: [`day ${row.day} of “${row.chapter}” would exceed ${level.wordsPerLesson} words per lesson`] });
      continue;
    }
    counts.set(lessonKey, n);
    seen.add(dupKey);
    if (!chapter) result.newChapters.set(chapterKey(level.id, row.chapter), { levelId: level.id, title: row.chapter });
    if (!lesson) result.newLessons.add(`${level.code} · ${row.chapter} · Day ${row.day}`);
    result.rows.push({ line, row });
  }
  result.errors.sort((a, b) => a.line - b.line);
  return result;
}

async function readFile(fd: FormData): Promise<string> {
  const file = fd.get("file");
  if (!(file instanceof Blob) || file.size === 0) throw new Error("Choose a CSV file.");
  if (file.size > MAX_BYTES) throw new Error("File is larger than 2 MB.");
  return file.text();
}

export async function importVocabulary(_: ImportState, fd: FormData): Promise<ImportState> {
  const actor = await assertPermission("MANAGE_VOCABULARY");
  const canCreate = hasPermission(actor, "MANAGE_CHAPTERS");
  let text: string;
  try {
    text = await readFile(fd);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const p = await plan(text, canCreate);
  const preview: ImportState["preview"] = {
    toCreate: p.rows.length,
    skipped: p.skipped,
    errors: p.errors,
    newChapters: [...p.newChapters.values()].map((c) => c.title),
    newLessons: [...p.newLessons],
    sample: p.rows.slice(0, 10).map(({ line, row }) => ({ line, level: row.level, chapter: row.chapter, day: row.day, german: row.german, english: row.english, article: row.article })),
  };

  if (fd.get("intent") !== "commit") return { preview };
  if (p.errors.length) return { preview, error: "Fix the errors before importing." };
  if (p.rows.length === 0) return { preview, error: "Nothing to import." };

  await prisma.$transaction(
    async (tx) => {
      const chapterIds = new Map<string, string>();
      const lessonIds = new Map<string, string>();
      for (const { row } of p.rows) {
        const level = await tx.level.findUniqueOrThrow({ where: { code: row.level.toUpperCase() } });
        const ck = chapterKey(level.id, row.chapter);
        let chapterId = chapterIds.get(ck);
        if (!chapterId) {
          const existing = await tx.chapter.findFirst({ where: { levelId: level.id, title: { equals: row.chapter, mode: "insensitive" } } });
          chapterId = existing?.id ?? (await tx.chapter.create({ data: { levelId: level.id, title: row.chapter, order: (await tx.chapter.count({ where: { levelId: level.id } })) + 1 } })).id;
          chapterIds.set(ck, chapterId);
        }
        const lk = `${chapterId}::${row.day}`;
        let lessonId = lessonIds.get(lk);
        if (!lessonId) {
          const existing = await tx.lesson.findUnique({ where: { chapterId_dayNumber: { chapterId, dayNumber: row.day } } });
          lessonId = existing?.id ?? (await tx.lesson.create({ data: { chapterId, dayNumber: row.day, order: row.day, title: `Day ${row.day}` } })).id;
          lessonIds.set(lk, lessonId);
        }
        const order = (await tx.vocabulary.count({ where: { lessonId } })) + 1;
        const examples = splitExamples(row.example_de, row.example_en);
        await tx.vocabulary.create({
          data: {
            lessonId, order,
            german: row.german, english: row.english, article: row.article, plural: row.plural, partOfSpeech: row.partOfSpeech,
            ipa: row.ipa, phonetic: row.phonetic, audioUrl: row.audioUrl, difficulty: row.difficulty, tags: row.tags,
            sentences: examples.length ? { create: examples.map((e, i) => ({ german: e.german, english: e.english || "—", order: i })) } : undefined,
          },
        });
      }
    },
    { timeout: 120_000 },
  );
  await audit(actor.id, "vocabulary.import", undefined, { rows: p.rows.length });
  revalidatePath("/admin/curriculum");
  return { committed: true, preview };
}
