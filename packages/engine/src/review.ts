import type { SkillState } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReviewSchedule {
  reviewIntervalDays: number;
  nextReviewAt: string;
}

export function scheduleReview(
  state: SkillState,
  correct: boolean,
  now: Date,
  intervals: number[]
): ReviewSchedule {
  const current = state.reviewIntervalDays;
  let index = intervals.indexOf(current);
  if (index < 0) index = current === 0 ? -1 : 0;
  const nextIndex = correct
    ? Math.min(index + 1, intervals.length - 1)
    : Math.max(0, index - 1);
  const interval = intervals[nextIndex] ?? intervals[0] ?? 1;
  return {
    reviewIntervalDays: interval,
    nextReviewAt: new Date(now.getTime() + interval * DAY_MS).toISOString(),
  };
}

export function isReviewDue(state: SkillState, now: Date): boolean {
  if (!state.nextReviewAt) return false;
  return new Date(state.nextReviewAt).getTime() <= now.getTime();
}

export function overdueDays(state: SkillState, now: Date): number {
  if (!state.nextReviewAt) return 0;
  const due = new Date(state.nextReviewAt).getTime();
  return Math.max(0, (now.getTime() - due) / DAY_MS);
}

export function earliestReviewAt(states: SkillState[]): string | undefined {
  const dates = states
    .map((state) => state.nextReviewAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  return dates[0];
}
