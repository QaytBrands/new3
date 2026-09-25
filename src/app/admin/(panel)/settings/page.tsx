import { prisma } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth/guards";
import { ActionForm, Checkbox, Field } from "@/components/admin/ActionForm";
import { saveSettings } from "@/server/admin/tests";
import { getPronunciationEngine } from "@/lib/pronunciation";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePageAdmin();
  const s = await prisma.appSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const engine = getPronunciationEngine();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>
      <section className="card p-4">
        <ActionForm action={saveSettings}>
          <h2 className="font-semibold">Automatic progression</h2>
          <p className="text-sm text-slate-500">When off, only admins/staff unlock content manually.</p>
          <Checkbox name="autoUnlockNextLesson" label="Passing a daily test unlocks the next day in the chapter" defaultChecked={s.autoUnlockNextLesson} />
          <Checkbox name="autoUnlockNextChapter" label="Passing a weekly test unlocks the next chapter in the level" defaultChecked={s.autoUnlockNextChapter} />
          <h2 className="pt-3 font-semibold">Defaults for new content</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Words per lesson"><input className="input" type="number" min={1} max={100} name="defaultWordsPerLesson" defaultValue={s.defaultWordsPerLesson} /></Field>
            <Field label="Daily test pass %"><input className="input" type="number" min={1} max={100} name="defaultDailyPassScore" defaultValue={s.defaultDailyPassScore} /></Field>
            <Field label="Weekly test pass %"><input className="input" type="number" min={1} max={100} name="defaultWeeklyPassScore" defaultValue={s.defaultWeeklyPassScore} /></Field>
          </div>
        </ActionForm>
      </section>
      <section className="card p-4 text-sm">
        <h2 className="font-semibold">Pronunciation engine</h2>
        <p className="mt-1">Active: <code>{engine.name}</code> — transcription: {engine.capabilities.transcription ? "yes (browser)" : "no"}, scoring: {engine.capabilities.scoring ? "yes" : "not available"}.</p>
        <p className="mt-1 text-slate-500">Set <code>PRONUNCIATION_ENGINE</code> to switch providers. Scores are only shown when a provider actually returns them.</p>
      </section>
    </div>
  );
}
