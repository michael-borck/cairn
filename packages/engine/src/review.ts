import type { SkillState } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
export const REVIEW_TARGET_RETENTION = 0.8;

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

export function retrievability(state: SkillState, now: Date): number {
  if (!state.lastSeenAt) return 1;
  const days = Math.max(
    0,
    (now.getTime() - new Date(state.lastSeenAt).getTime()) / DAY_MS
  );
  return Math.pow(2, -days / Math.max(0.25, state.halfLifeDays));
}

export function scheduleRetentionReview(
  state: SkillState,
  now: Date,
  targetRetention = REVIEW_TARGET_RETENTION
): ReviewSchedule {
  const days = Math.max(
    0.25,
    Math.max(0.25, state.halfLifeDays) *
      Math.log2(1 / Math.min(0.99, Math.max(0.5, targetRetention)))
  );
  return {
    reviewIntervalDays: days,
    nextReviewAt: new Date(now.getTime() + days * DAY_MS).toISOString(),
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
