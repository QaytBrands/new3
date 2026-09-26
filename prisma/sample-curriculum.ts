import type { Article, PrismaClient } from "@prisma/client";

type W = [german: string, english: string, article: Article | null, plural: string | null, pos: string, ipa: string, phonetic: string, exDe: string, exEn: string];

export const SAMPLE_CURRICULUM: { title: string; days: { title: string; words: W[] }[] }[] = [
  {
    title: "Greetings",
    days: [
      {
        title: "Hello & goodbye",
        words: [
          ["Hallo", "hello", null, null, "interjection", "haˈloː", "hah-LOH", "Hallo, wie geht's?", "Hello, how are you?"],
          ["Tschüss", "bye", null, null, "interjection", "tʃʏs", "chüss", "Tschüss, bis morgen!", "Bye, see you tomorrow!"],
          ["Morgen", "morning", "DER", "Morgen", "noun", "ˈmɔʁɡn̩", "MOR-gen", "Guten Morgen, Anna!", "Good morning, Anna!"],
          ["Abend", "evening", "DER", "Abende", "noun", "ˈaːbn̩t", "AH-bent", "Guten Abend, Herr Müller.", "Good evening, Mr Müller."],
          ["Nacht", "night", "DIE", "Nächte", "noun", "naxt", "nakht", "Gute Nacht, schlaf gut!", "Good night, sleep well!"],
          ["Tag", "day", "DER", "Tage", "noun", "taːk", "tahk", "Guten Tag, wie geht es Ihnen?", "Good day, how are you?"],
          ["danke", "thank you", null, null, "interjection", "ˈdaŋkə", "DAHN-kuh", "Danke für die Hilfe.", "Thank you for the help."],
          ["bitte", "please", null, null, "adverb", "ˈbɪtə", "BIT-tuh", "Einen Kaffee, bitte.", "A coffee, please."],
        ],
      },
      {
        title: "Introducing yourself",
        words: [
          ["Name", "name", "DER", "Namen", "noun", "ˈnaːmə", "NAH-muh", "Mein Name ist Lara.", "My name is Lara."],
          ["heißen", "to be called", null, null, "verb", "ˈhaɪ̯sn̩", "HY-sen", "Wie heißen Sie?", "What is your name?"],
          ["kommen", "to come", null, null, "verb", "ˈkɔmən", "KOM-men", "Ich komme aus Spanien.", "I come from Spain."],
          ["wohnen", "to live (reside)", null, null, "verb", "ˈvoːnən", "VOH-nen", "Wir wohnen in Berlin.", "We live in Berlin."],
          ["Land", "country", "DAS", "Länder", "noun", "lant", "lahnt", "Das Land ist sehr schön.", "The country is very beautiful."],
          ["Stadt", "city", "DIE", "Städte", "noun", "ʃtat", "shtaht", "Die Stadt ist groß.", "The city is big."],
          ["Sprache", "language", "DIE", "Sprachen", "noun", "ˈʃpʁaːxə", "SHPRAH-khuh", "Deutsch ist eine schöne Sprache.", "German is a beautiful language."],
        ],
      },
      {
        title: "Polite phrases",
        words: [
          ["Entschuldigung", "excuse me / sorry", "DIE", "Entschuldigungen", "noun", "ɛntˈʃʊldɪɡʊŋ", "ent-SHOOL-di-goong", "Entschuldigung, wo ist der Bahnhof?", "Excuse me, where is the station?"],
          ["ja", "yes", null, null, "adverb", "jaː", "yah", "Ja, das stimmt.", "Yes, that's right."],
          ["nein", "no", null, null, "adverb", "naɪ̯n", "nine", "Nein, danke.", "No, thank you."],
          ["Herr", "Mr / gentleman", "DER", "Herren", "noun", "hɛʁ", "hair", "Das ist Herr Schmidt.", "This is Mr Schmidt."],
          ["Frau", "Mrs / woman", "DIE", "Frauen", "noun", "fʁaʊ̯", "frow", "Frau Weber ist Lehrerin.", "Mrs Weber is a teacher."],
          ["freuen", "to be glad", null, null, "verb", "ˈfʁɔɪ̯ən", "FROY-en", "Ich freue mich.", "I am glad."],
        ],
      },
    ],
  },
  {
    title: "Family",
    days: [
      {
        title: "Parents & children",
        words: [
          ["Familie", "family", "DIE", "Familien", "noun", "faˈmiːli̯ə", "fah-MEE-lee-uh", "Meine Familie ist groß.", "My family is big."],
          ["Mutter", "mother", "DIE", "Mütter", "noun", "ˈmʊtɐ", "MOO-ter", "Meine Mutter heißt Eva.", "My mother is called Eva."],
          ["Vater", "father", "DER", "Väter", "noun", "ˈfaːtɐ", "FAH-ter", "Mein Vater kocht gern.", "My father likes to cook."],
          ["Kind", "child", "DAS", "Kinder", "noun", "kɪnt", "kint", "Das Kind spielt im Garten.", "The child plays in the garden."],
          ["Eltern", "parents", null, null, "noun (plural)", "ˈɛltɐn", "EL-tern", "Meine Eltern wohnen in Wien.", "My parents live in Vienna."],
          ["Baby", "baby", "DAS", "Babys", "noun", "ˈbeːbi", "BAY-bee", "Das Baby schläft.", "The baby is sleeping."],
        ],
      },
      {
        title: "Siblings",
        words: [
          ["Bruder", "brother", "DER", "Brüder", "noun", "ˈbʁuːdɐ", "BROO-der", "Mein Bruder ist zehn.", "My brother is ten."],
          ["Schwester", "sister", "DIE", "Schwestern", "noun", "ˈʃvɛstɐ", "SHVES-ter", "Meine Schwester studiert.", "My sister is studying."],
          ["Geschwister", "siblings", null, null, "noun (plural)", "ɡəˈʃvɪstɐ", "guh-SHVIS-ter", "Hast du Geschwister?", "Do you have siblings?"],
          ["Sohn", "son", "DER", "Söhne", "noun", "zoːn", "zohn", "Ihr Sohn heißt Paul.", "Her son is called Paul."],
          ["Tochter", "daughter", "DIE", "Töchter", "noun", "ˈtɔxtɐ", "TOKH-ter", "Die Tochter ist sehr klug.", "The daughter is very clever."],
          ["alt", "old", null, null, "adjective", "alt", "ahlt", "Wie alt bist du?", "How old are you?"],
        ],
      },
      {
        title: "Relatives",
        words: [
          ["Großmutter", "grandmother", "DIE", "Großmütter", "noun", "ˈɡʁoːsˌmʊtɐ", "GROHS-moo-ter", "Meine Großmutter backt Kuchen.", "My grandmother bakes cake."],
          ["Großvater", "grandfather", "DER", "Großväter", "noun", "ˈɡʁoːsˌfaːtɐ", "GROHS-fah-ter", "Der Großvater liest die Zeitung.", "The grandfather reads the newspaper."],
          ["Onkel", "uncle", "DER", "Onkel", "noun", "ˈɔŋkl̩", "ONG-kel", "Mein Onkel wohnt in Hamburg.", "My uncle lives in Hamburg."],
          ["Tante", "aunt", "DIE", "Tanten", "noun", "ˈtantə", "TAHN-tuh", "Meine Tante hat einen Hund.", "My aunt has a dog."],
          ["verheiratet", "married", null, null, "adjective", "fɛɐ̯ˈhaɪ̯ʁaːtət", "fair-HY-rah-tet", "Sie ist verheiratet.", "She is married."],
          ["Hund", "dog", "DER", "Hunde", "noun", "hʊnt", "hoont", "Der Hund bellt laut.", "The dog barks loudly."],
        ],
      },
    ],
  },
];

/**
 * Creates the sample A1 course (2 chapters × 3 days, daily and weekly tests) plus an empty A2 level.
 * Does nothing if level A1 already exists. Returns true when it created the course.
 */
export async function seedSampleCurriculum(prisma: PrismaClient): Promise<boolean> {
  const existing = await prisma.level.findUnique({ where: { code: "A1" } });
  if (existing) {
    return false;
  }
  {
    const level = await prisma.level.create({
      data: { code: "A1", name: "Beginner", description: "Everyday basics", order: 1 },
    });
    await prisma.level.create({ data: { code: "A2", name: "Elementary", order: 2 } });
    for (const [ci, ch] of SAMPLE_CURRICULUM.entries()) {
      const chapter = await prisma.chapter.create({
        data: { levelId: level.id, title: ch.title, order: ci + 1 },
      });
      for (const [di, day] of ch.days.entries()) {
        const lesson = await prisma.lesson.create({
          data: { chapterId: chapter.id, dayNumber: di + 1, title: day.title, order: di + 1 },
        });
        for (const [wi, w] of day.words.entries()) {
          await prisma.vocabulary.create({
            data: {
              lessonId: lesson.id,
              german: w[0], english: w[1], article: w[2], plural: w[3], partOfSpeech: w[4], ipa: w[5], phonetic: w[6],
              order: wi + 1,
              tags: [ch.title.toLowerCase()],
              sentences: { create: [{ german: w[7], english: w[8] }] },
            },
          });
        }
        await prisma.test.create({
          data: {
            kind: "DAILY", title: `${ch.title} – Day ${di + 1} test`, lessonId: lesson.id,
            questionCount: day.words.length, passingScore: 70,
            questionTypes: ["DE_TO_EN", "EN_TO_DE", "ARTICLE", "SPELLING", "SENTENCE", "LISTENING"],
          },
        });
      }
      await prisma.test.create({
        data: {
          kind: "WEEKLY", title: `${ch.title} – Weekly test`, chapterId: chapter.id,
          questionCount: 15, passingScore: 75, timeLimitSec: 15 * 60,
          questionTypes: ["DE_TO_EN", "EN_TO_DE", "ARTICLE", "SPELLING", "SENTENCE", "LISTENING"],
        },
      });
    }
  }
  return true;
}
