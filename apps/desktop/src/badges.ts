import type { ContentPack } from "@cairn/content";
import type { EvidenceEvent, LearnerState } from "@cairn/engine";

export interface Badge {
  id: string;
  label: string;
  description: string;
  earned: boolean;
}

function chronological(events: EvidenceEvent[]): EvidenceEvent[] {
  return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function itemType(pack: ContentPack, itemId: string): string | undefined {
  return pack.items.find((item) => item.id === itemId)?.type;
}

function completedType(
  pack: ContentPack,
  events: EvidenceEvent[],
  type: string
): boolean {
  return events.some(
    (event) => itemType(pack, event.itemId) === type && event.correct !== false
  );
}

function hasComeback(events: EvidenceEvent[]): boolean {
  const missed = new Set<string>();
  for (const event of events) {
    for (const skillId of event.skillIds) {
      if (event.correct === false) missed.add(skillId);
      if (event.correct === true && missed.has(skillId)) return true;
    }
  }
  return false;
}

function distinctDays(events: EvidenceEvent[]): number {
  return new Set(
    events.map((event) => new Date(event.timestamp).toDateString())
  ).size;
}

export function computeBadges(
  pack: ContentPack,
  learner: LearnerState | null,
  events: EvidenceEvent[]
): Badge[] {
  const ordered = chronological(events);
  const calibrations = learner?.calibration;
  return [
    {
      id: "explain-it-back",
      label: "Explain it back",
      description: "Complete a teach-back activity.",
      earned: completedType(pack, ordered, "teach_back"),
    },
    {
      id: "comeback",
      label: "Comeback",
      description: "Get a skill right after missing it.",
      earned: hasComeback(ordered),
    },
    {
      id: "help-seeker",
      label: "Help seeker",
      description: "Use a hint and then get the answer right.",
      earned: ordered.some((event) => event.hintsUsed > 0 && event.correct),
    },
    {
      id: "calibrated",
      label: "Calibrated",
      description: "Match confidence to performance over 10 answers.",
      earned: Boolean(
        calibrations &&
          calibrations.answered >= 10 &&
          calibrations.brierScore <= 0.18
      ),
    },
    {
      id: "hands-on",
      label: "Hands-on",
      description: "Complete a lab.",
      earned: completedType(pack, ordered, "lab"),
    },
    {
      id: "consistent",
      label: "Consistent",
      description: "Practise on three different days.",
      earned: distinctDays(ordered) >= 3,
    },
  ];
}
