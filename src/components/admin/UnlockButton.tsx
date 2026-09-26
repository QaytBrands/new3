import { ActionForm } from "./ActionForm";
import { setUnlock } from "@/server/admin/users";

export function UnlockButton({ userId, scope, targetId, unlocked, disabled }: { userId: string; scope: "LEVEL" | "CHAPTER" | "LESSON"; targetId: string; unlocked: boolean; disabled?: boolean }) {
  if (disabled) return <span className="text-xs text-slate-400">{unlocked ? "Unlocked" : "Locked"}</span>;
  return (
    <ActionForm action={setUnlock} inline submitLabel={unlocked ? "Lock" : "Unlock"} variant={unlocked ? "secondary" : "primary"}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="mode" value={unlocked ? "lock" : "unlock"} />
    </ActionForm>
  );
}
