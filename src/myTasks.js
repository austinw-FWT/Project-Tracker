/**
 * myTasks.js — project tasks assigned to a person, shown live on their
 * Daily Task Board (Hot List) and Field Mode Today screen.
 *
 * The task lives in ONE place: project.tasks. Boards read it; they don't copy
 * it. So checking it off anywhere checks it off everywhere, reassigning moves
 * it to the new person's board, and it shows up even for someone who has
 * never opened their board.
 *
 * Completed tasks stay on your board (checked) until YOU remove them — the
 * ✕ sets task.clearedFromBoard. That only hides it from your board; the task
 * stays in the project's Tasks tab as history.
 */
import { localIso } from "./projectSchedule.js";

/** Stable handle for a task: its id, or (legacy tasks without one) index + text. */
export const taskRef = (t, i) => (t.id ? { id: t.id } : { index: i, text: t.text });
const matches = (t, i, ref) => (ref.id ? t.id === ref.id : i === ref.index && t.text === ref.text);

/** [{ project, task, ref }] for `name`: open first (by job), then completed-but-not-cleared. */
export function assignedTasks(projects, name) {
  if (!name) return [];
  const out = [];
  for (const p of projects || []) {
    (p.tasks || []).forEach((t, i) => {
      if (!t || t.assignee !== name || t.clearedFromBoard) return;
      // Completed tasks with no doneAt were finished before boards showed them — keep those off.
      if (t.done && !t.doneAt) return;
      out.push({ project: p, task: t, ref: taskRef(t, i) });
    });
  }
  return out.sort((a, b) => (a.task.done - b.task.done) || (a.project.jobNumber || a.project.name || "").localeCompare(b.project.jobNumber || b.project.name || ""));
}

/** New tasks array for a project with one task checked/unchecked. */
export function setTaskDone(project, ref, done, by) {
  return (project.tasks || []).map((t, i) => matches(t, i, ref)
    ? { ...t, done, doneAt: done ? new Date().toISOString() : null, doneBy: done ? (by || "") : null, ...(done ? {} : { clearedFromBoard: false }) }
    : t);
}

/** Fields to stamp on a task when it's assigned — including to yourself, so it badges like any other. */
export function assignmentStamp(assignee, by) {
  return assignee ? { assignedAt: new Date().toISOString(), assignedBy: by || "", clearedFromBoard: false } : { assignedAt: null, assignedBy: null };
}

/** Take one completed task off the assignee's board. It stays in the project. */
export function clearFromBoard(project, ref) {
  return (project.tasks || []).map((t, i) => matches(t, i, ref) ? { ...t, clearedFromBoard: true } : t);
}

/** New tasks array with one task reassigned. */
export function setTaskAssignee(project, ref, assignee, by) {
  return (project.tasks || []).map((t, i) => matches(t, i, ref) ? { ...t, assignee: assignee || "", ...assignmentStamp(assignee, by) } : t);
}

/** Old behaviour copied task text onto boards; hide those copies when the live task is shown. */
export function isStaleCopy(item, linked) {
  if (!item || item.done || !item.text) return false;
  const txt = item.text.trim().toLowerCase();
  return linked.some(l => !l.task.done && (l.task.text || "").trim().toLowerCase() === txt);
}

/* ── "New" badge ──────────────────────────────────────────────
   Each assignment stamps task.assignedAt. Each person keeps
   memberPrivate.tasksSeenAt = when they last looked at their tasks.
   New = open, assigned to me, assignedAt after tasksSeenAt.
   Tasks assigned before this feature have no assignedAt and never count
   as new, so nobody gets a wall of old items on day one. */
export function isNewTask(task, seenAt) {
  if (!task || task.done || !task.assignedAt) return false;
  return !seenAt || task.assignedAt > seenAt;
}
export const newTaskCount = (linked, seenAt) => linked.filter(l => isNewTask(l.task, seenAt)).length;
