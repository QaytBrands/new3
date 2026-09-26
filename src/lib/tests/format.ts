import type { Article } from "@prisma/client";

export function articleText(article: Article | null | undefined): string | null {
  return article ? article.toLowerCase() : null;
}

/** "der Hund" for nouns with an article, otherwise just the word. */
export function withArticle(v: { german: string; article: Article | null }): string {
  const a = articleText(v.article);
  return a ? `${a} ${v.german}` : v.german;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace the target word in a sentence with a gap. Returns null if the word isn't found. */
export function gapSentence(sentence: string, word: string): string | null {
  const re = new RegExp(`(^|[^\\p{L}])${escapeRegExp(word)}(?=$|[^\\p{L}])`, "iu");
  if (!re.test(sentence)) return null;
  return sentence.replace(re, (_m, pre: string) => `${pre}_____`);
}
