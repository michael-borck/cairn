import type { ContentPack } from "@cairn/content";
import type { LearnerState } from "@cairn/engine";

export interface CalendarSkill {
  id: string;
  title: string;
  mastery: number;
  dueAt: string;
}

export interface CalendarDay {
  date: string;
  label: string;
  overdue: boolean;
  today: boolean;
  skills: CalendarSkill[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function buildReviewCalendar(
  pack: ContentPack,
  learner: LearnerState | null,
  days = 14,
  now = new Date()
): CalendarDay[] {
  const start = startOfDay(now);
  const overdue: CalendarSkill[] = [];
  const scheduled = new Map<string, CalendarSkill[]>();

  for (const skill of pack.curriculum.skills) {
    const state = learner?.skills[skill.id];
    if (!state?.nextReviewAt) continue;
    const due = new Date(state.nextReviewAt);
    const dueDay = startOfDay(due);
    const entry: CalendarSkill = {
      id: skill.id,
      title: skill.title,
      mastery: state.mastery,
      dueAt: state.nextReviewAt,
    };
    if (dueDay.getTime() < start.getTime()) {
      overdue.push(entry);
      continue;
    }
    const offset = Math.round(
      (dueDay.getTime() - start.getTime()) / DAY_MS
    );
    if (offset >= days) continue;
    const key = dateKey(dueDay);
    const list = scheduled.get(key) ?? [];
    list.push(entry);
    scheduled.set(key, list);
  }

  const calendar: CalendarDay[] = [];
  if (overdue.length > 0) {
    calendar.push({
      date: "overdue",
      label: "Overdue",
      overdue: true,
      today: false,
      skills: overdue.sort((a, b) => a.mastery - b.mastery),
    });
  }

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start.getTime() + offset * DAY_MS);
    const key = dateKey(date);
    calendar.push({
      date: key,
      label:
        offset === 0
          ? "Today"
          : date.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
      overdue: false,
      today: offset === 0,
      skills: (scheduled.get(key) ?? []).sort((a, b) => a.mastery - b.mastery),
    });
  }

  return calendar;
}
