import { hasPermission, type Actor } from "./permissions";

/**
 * Who may listen to a student's pronunciation recording: the student who made it, admins, and
 * staff holding VIEW_PROGRESS. Nobody else — in particular, never another student.
 */
export function canAccessRecording(viewer: (Actor & { id: string }) | null | undefined, recording: { userId: string }): boolean {
  if (!viewer || viewer.active === false) return false;
  if (viewer.role === "STUDENT") return viewer.id === recording.userId;
  return hasPermission(viewer, "VIEW_PROGRESS");
}
