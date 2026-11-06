import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { ContentPack, Item, Lab, MCQItem, Rubric } from "@cairn/content";
import {
  createEngine,
  type AdaptiveEngine,
  type Decision,
  type EvidenceEvent,
  type Explanation,
  type LearnerState,
  type ReviewItem,
} from "@cairn/engine";

import "./App.css";
import {
  choosePackDirectory,
  entryForPack,
  loadBuiltinPacks,
  loadImportedPack,
  loadPack,
  readPackFile,
  saveImportedPack,
  type PackEntry,
} from "./packs";
import { createPersistentStorage, type AppStorage } from "./storage";

const LEARNER_ID = "local";
const ACTION_LABEL: Record<Decision["action"], string> = {
  diagnose: "Diagnose",
  explain: "Explain",
  worked_example: "Worked example",
  practice: "Practice",
  review: "Review",
  remediate: "Repair",
  challenge: "Challenge",
  complete: "Complete",
};

type ShellStatus = "connecting" | "ready" | "error";
type Confidence = "" | "guess" | "unsure" | "sure";

interface Pending {
  correct?: boolean;
  score: number;
  response: unknown;
  misconceptionIds?: string[];
  feedback: string;
}

function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `cairn-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function averageMastery(pack: ContentPack, learner: LearnerState | null): number {
  if (!learner) return 0;
  const values = pack.curriculum.skills.map(
    (skill) => learner.skills[skill.id]?.mastery ?? 0
  );
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function labFor(pack: ContentPack, item: Item | null): Lab | undefined {
  if (!item || item.type !== "lab") return undefined;
  return pack.labs.find((lab) => lab.id === item.labId);
}

function rubricFor(pack: ContentPack, item: Item | null): Rubric | undefined {
  if (!item) return undefined;
  if (item.type === "teach_back") {
    return pack.rubrics.find((rubric) => rubric.id === item.rubricId);
  }
  if (item.type === "short_answer" && item.scoring.rubricId) {
    return pack.rubrics.find((rubric) => rubric.id === item.scoring.rubricId);
  }
  return undefined;
}

function App() {
  const [shell, setShell] = useState<ShellStatus>("connecting");
  const [packs, setPacks] = useState<PackEntry[]>([]);
  const [active, setActive] = useState<{
    entry: PackEntry;
    pack: ContentPack;
  } | null>(null);
  const [engine, setEngine] = useState<AdaptiveEngine | null>(null);
  const [store, setStore] = useState<AppStorage | null>(null);
  const [learner, setLearner] = useState<LearnerState | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [confidence, setConfidence] = useState<Confidence>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Open the built-in Docker pack or import a .json pack."
  );
  const [error, setError] = useState(false);
  const activityStartedAt = useRef(Date.now());

  const currentItem =
    active && decision?.itemId
      ? (active.pack.items.find((item) => item.id === decision.itemId) ?? null)
      : null;
  const currentLab = active ? labFor(active.pack, currentItem) : undefined;
  const currentRubric = active ? rubricFor(active.pack, currentItem) : undefined;

  function resetActivity(): void {
    setPending(null);
    setSelectedOption(null);
    setTextAnswer("");
    setConfidence("");
    activityStartedAt.current = Date.now();
  }

  async function getStorage(): Promise<AppStorage> {
    if (store) return store;
    const next = await createPersistentStorage();
    setStore(next);
    return next;
  }

  async function refresh(nextEngine: AdaptiveEngine): Promise<void> {
    setLearner(await nextEngine.getState(LEARNER_ID));
    setReviewQueue(await nextEngine.reviewQueue(LEARNER_ID));
  }

  async function openPack(entry: PackEntry): Promise<void> {
    setBusy(true);
    setError(false);
    setMessage(`Loading ${entry.title}...`);
    try {
      const pack = await loadPack(entry);
      const storage = await getStorage();
      const nextEngine = createEngine({
        pack,
        storage,
        now: () => new Date(),
        idFactory: newId,
      });
      const state = await nextEngine.getState(LEARNER_ID);
      setActive({ entry, pack });
      setEngine(nextEngine);
      setLearner(state);
      setReviewQueue(await nextEngine.reviewQueue(LEARNER_ID));
      setDecision(null);
      setExplanation(null);
      resetActivity();
      setMessage(`Loaded ${pack.manifest.title}.`);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function startSession(): Promise<void> {
    if (!engine) return;
    setBusy(true);
    setError(false);
    try {
      const next = await engine.next({
        learnerId: LEARNER_ID,
        session: { availableMinutes: 25, mode: "auto" },
      });
      setDecision(next);
      setExplanation(await engine.explain(next.id));
      await refresh(engine);
      resetActivity();
      setMessage("Session started.");
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function advance(nextEngine: AdaptiveEngine): Promise<void> {
    const next = await nextEngine.next({
      learnerId: LEARNER_ID,
      session: { availableMinutes: 25, mode: "auto" },
    });
    setDecision(next);
    setExplanation(await nextEngine.explain(next.id));
    await refresh(nextEngine);
    resetActivity();
  }

  async function record(input: {
    correct?: boolean;
    score: number;
    response: unknown;
    misconceptionIds?: string[];
    evidenceSource?: EvidenceEvent["evidenceSource"];
  }): Promise<void> {
    if (!engine || !active || !currentItem) return;
    setBusy(true);
    setError(false);
    try {
      const selfReported =
        currentItem.type !== "mcq" &&
        !(
          currentItem.type === "short_answer" &&
          currentItem.scoring.mode !== "rubric"
        );
      const event: EvidenceEvent = {
        id: newId(),
        learnerId: LEARNER_ID,
        packId: active.pack.manifest.id,
        packVersion: active.pack.manifest.version,
        itemId: currentItem.id,
        skillIds: currentItem.skillIds,
        timestamp: new Date().toISOString(),
        response: input.response,
        correct: input.correct,
        score: input.score,
        confidence: confidence || undefined,
        hintsUsed: 0,
        attempts: 1,
        durationMs: Math.max(1000, Date.now() - activityStartedAt.current),
        evidenceSource:
          input.evidenceSource ?? (selfReported ? "self" : "learner"),
        misconceptionIds: input.misconceptionIds,
      };
      const result = await engine.record(event);
      setLearner(result.state);
      await advance(engine);
      setMessage("Recorded. The engine chose the next activity.");
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function chooseOption(item: MCQItem, optionId: string): void {
    if (pending) return;
    const option = item.options.find((entry) => entry.id === optionId);
    const correct = optionId === item.correctOptionId;
    setSelectedOption(optionId);
    setPending({
      correct,
      score: correct ? 1 : 0,
      response: optionId,
      misconceptionIds: option?.misconceptionId
        ? [option.misconceptionId]
        : undefined,
      feedback: correct
        ? item.explanation ?? "Correct."
        : `Not quite. ${item.explanation ?? "Compare the feedback and try the next activity."}`,
    });
  }

  function submitText(item: Item): void {
    if (pending) return;
    if (item.type === "short_answer") {
      const normalize = (value: string) => value.trim().toLowerCase();
      const expected = item.scoring.value ?? "";
      let correct: boolean | undefined;
      if (item.scoring.mode === "exact") {
        correct = normalize(textAnswer) === normalize(expected);
      } else if (item.scoring.mode === "contains") {
        correct = normalize(textAnswer).includes(normalize(expected));
      } else if (item.scoring.mode === "regex") {
        try {
          correct = new RegExp(expected, "i").test(textAnswer);
        } catch {
          correct = false;
        }
      }
      setPending({
        correct,
        score: correct === undefined ? 0.7 : correct ? 1 : 0,
        response: textAnswer,
        feedback:
          correct === undefined
            ? `Compare with: ${item.modelAnswer ?? "the rubric."}`
            : correct
              ? item.explanation ?? "Correct."
              : `Compare with: ${item.modelAnswer ?? expected}`,
      });
      return;
    }
    setPending({
      score: 0.7,
      response: textAnswer,
      feedback:
        item.type === "teach_back" && item.modelAnswer
          ? `Compare with: ${item.modelAnswer}`
          : "Saved. Reflection is part of the record.",
    });
  }

  async function continueAfterPending(): Promise<void> {
    if (!pending) return;
    await record({
      correct: pending.correct,
      score: pending.score,
      response: pending.response,
      misconceptionIds: pending.misconceptionIds,
    });
  }

  async function markSelfComplete(): Promise<void> {
    await record({
      score: 0.7,
      response: "completed",
      evidenceSource: "self",
    });
  }

  async function applyOverride(
    type: "easier" | "harder" | "more_help" | "less_help"
  ): Promise<void> {
    if (!engine || !decision) return;
    setBusy(true);
    setError(false);
    try {
      const next = await engine.override({
        learnerId: LEARNER_ID,
        decisionId: decision.id,
        choice: { type },
      });
      setDecision(next);
      setExplanation(await engine.explain(next.id));
      await refresh(engine);
      resetActivity();
      setMessage("Decision updated. The change is logged.");
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function importFolder(): Promise<void> {
    setBusy(true);
    setError(false);
    setMessage("Choose a pack folder...");
    try {
      const pack = await choosePackDirectory();
      if (!pack) {
        setMessage("Folder import cancelled.");
        return;
      }
      saveImportedPack(pack);
      const entry = entryForPack(pack, "local");
      setPacks((current) => [
        entry,
        ...current.filter((item) => item.id !== entry.id),
      ]);
      await openPack(entry);
      setMessage(`Imported ${pack.manifest.title}.`);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function importPack(file: File | undefined): Promise<void> {
    if (!file) return;
    setBusy(true);
    setError(false);
    setMessage("Validating pack...");
    try {
      const pack = await readPackFile(file);
      saveImportedPack(pack);
      const entry = entryForPack(pack, "local");
      setPacks((current) => [
        entry,
        ...current.filter((item) => item.id !== entry.id),
      ]);
      await openPack(entry);
      setMessage(`Imported ${pack.manifest.title}.`);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function resetProgress(): Promise<void> {
    if (!engine) return;
    const storage = await getStorage();
    await storage.reset(LEARNER_ID);
    setLearner(await engine.getState(LEARNER_ID));
    setReviewQueue(await engine.reviewQueue(LEARNER_ID));
    setDecision(null);
    setExplanation(null);
    resetActivity();
    setMessage("Progress reset for this pack.");
  }

  useEffect(() => {
    invoke<string>("health")
      .then(() => setShell("ready"))
      .catch(() => setShell("error"));

    void (async () => {
      const builtins = await loadBuiltinPacks();
      const imported = loadImportedPack();
      const local = imported ? entryForPack(imported, "local") : null;
      const list = local
        ? [local, ...builtins.filter((entry) => entry.id !== local.id)]
        : builtins;
      setPacks(list);
      if (list.length === 0) {
        setMessage("No packs found. Import a .json pack to begin.");
      }
    })();
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">✦</span>
          <span>
            Cairn <span className="muted">adaptive learning</span>
          </span>
        </div>
        <span className={`status ${error ? "error" : shell}`}>
          {error ? message : shell === "ready" ? message : "Connecting to shell..."}
        </span>
      </header>

      <aside className="sidebar">
        <div className="eyebrow">Packs</div>
        <div className="pack-list">
          {packs.map((entry) => (
            <button
              key={`${entry.source}-${entry.id}`}
              type="button"
              className={`library-item ${active?.entry.id === entry.id ? "active" : ""}`}
              onClick={() => void openPack(entry)}
              disabled={busy}
            >
              <span className="library-title">{entry.title}</span>
              <span className="library-meta">
                {entry.source} · v{entry.version}
              </span>
            </button>
          ))}
        </div>

        <label className="import-button">
          Import pack
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              void importPack(file);
              event.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void importFolder()}
          disabled={busy}
        >
          Import folder
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={() => void resetProgress()}
          disabled={!engine || busy}
        >
          Reset progress
        </button>

        <div className="sidebar-note">
          <strong>Local-first.</strong> Your answers and progress stay in this
          app. AI is optional.
        </div>
      </aside>

      <main className="main">
        {!active ? (
          <>
            <section className="hero">
              <p className="eyebrow">Local-first adaptive learning</p>
              <h1>Learn with a path you can see and steer.</h1>
              <p className="lede">
                Cairn builds a skill map, diagnoses where you are, and adapts
                difficulty, help, and review. Every decision has a reason and an
                override.
              </p>
            </section>
            <section className="pack-grid">
              {packs.map((entry) => (
                <button
                  key={`${entry.source}-${entry.id}`}
                  type="button"
                  className="pack-card"
                  onClick={() => void openPack(entry)}
                  disabled={busy}
                >
                  <h2>{entry.title}</h2>
                  <p>{entry.description}</p>
                  <span>
                    {entry.source} pack · v{entry.version}
                  </span>
                </button>
              ))}
            </section>
          </>
        ) : (
          <>
            <header className="pack-head">
              <div>
                <p className="eyebrow">
                  {active.entry.source} pack · v{active.pack.manifest.version}
                </p>
                <h1>{active.pack.manifest.title}</h1>
                <p className="lede">{active.pack.manifest.description}</p>
              </div>
              <div className="pack-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => void startSession()}
                  disabled={busy || Boolean(decision)}
                >
                  Start session
                </button>
              </div>
            </header>

            <div className="workspace">
              <section className="session-card">
                {!decision ? (
                  <PackOverview
                    pack={active.pack}
                    busy={busy}
                    onStart={() => void startSession()}
                  />
                ) : decision.action === "complete" ? (
                  <div className="complete">
                    <p className="eyebrow">Path complete</p>
                    <h2>No unmastered skills remain.</h2>
                    <p>
                      Review still matters. The queue will bring skills back
                      when they are due.
                    </p>
                    <button
                      type="button"
                      className="button"
                      onClick={() => void resetProgress()}
                    >
                      Reset progress
                    </button>
                  </div>
                ) : currentItem ? (
                  <ActivityView
                    item={currentItem}
                    lab={currentLab}
                    rubric={currentRubric}
                    pending={pending}
                    selectedOption={selectedOption}
                    textAnswer={textAnswer}
                    confidence={confidence}
                    busy={busy}
                    onSelectOption={(optionId) =>
                      currentItem.type === "mcq"
                        ? chooseOption(currentItem, optionId)
                        : undefined
                    }
                    onTextChange={setTextAnswer}
                    onConfidence={setConfidence}
                    onSubmitText={() => submitText(currentItem)}
                    onContinue={() => void continueAfterPending()}
                    onSelfComplete={() => void markSelfComplete()}
                  />
                ) : (
                  <p>No item selected for this decision.</p>
                )}
              </section>

              <aside className="right-rail">
                <WhyPanel
                  decision={decision}
                  explanation={explanation}
                  busy={busy}
                  onOverride={(type) => void applyOverride(type)}
                />
                <MasteryMap pack={active.pack} learner={learner} />
                <ReviewPanel pack={active.pack} items={reviewQueue} />
              </aside>
            </div>
          </>
        )}

        <footer className="footer">
          <span>Cairn v0.1 shell</span>
          <span>Tauri 2 · React · TypeScript</span>
        </footer>
      </main>
    </div>
  );
}

function PackOverview({
  pack,
  busy,
  onStart,
}: {
  pack: ContentPack;
  busy: boolean;
  onStart: () => void;
}) {
  return (
    <div className="overview">
      <p className="eyebrow">Ready to begin</p>
      <h2>Start with a short diagnostic.</h2>
      <p>
        The engine will choose the first activity, show its reasoning, and let
        you adjust difficulty or help at any point.
      </p>
      <div className="stat-row">
        <span>{pack.curriculum.skills.length} skills</span>
        <span>{pack.items.length} items</span>
        <span>{pack.labs.length} labs</span>
        <span>{pack.manifest.estimatedMinutes} min</span>
      </div>
      <button type="button" className="button" onClick={onStart} disabled={busy}>
        Start session
      </button>
    </div>
  );
}

function WhyPanel({
  decision,
  explanation,
  busy,
  onOverride,
}: {
  decision: Decision | null;
  explanation: Explanation | null;
  busy: boolean;
  onOverride: (type: "easier" | "harder" | "more_help" | "less_help") => void;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Why this?</h2>
        {decision && <span>{percent(decision.confidence)}</span>}
      </div>
      {decision ? (
        <>
          <p className="decision-action">{ACTION_LABEL[decision.action]}</p>
          <p>{explanation?.short ?? decision.reason}</p>
          <ul className="evidence">
            {decision.evidence.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
          {decision.action !== "complete" && (
            <div className="override-row">
              <button
                type="button"
                className="ghost-button small"
                disabled={busy}
                onClick={() => onOverride("easier")}
              >
                Easier
              </button>
              <button
                type="button"
                className="ghost-button small"
                disabled={busy}
                onClick={() => onOverride("harder")}
              >
                Harder
              </button>
              <button
                type="button"
                className="ghost-button small"
                disabled={busy}
                onClick={() => onOverride("more_help")}
              >
                More help
              </button>
              <button
                type="button"
                className="ghost-button small"
                disabled={busy}
                onClick={() => onOverride("less_help")}
              >
                Less help
              </button>
            </div>
          )}
        </>
      ) : (
        <p>Start a session to see the engine's reasoning.</p>
      )}
    </div>
  );
}

function MasteryMap({
  pack,
  learner,
}: {
  pack: ContentPack;
  learner: LearnerState | null;
}) {
  const modules = [...pack.curriculum.modules].sort((a, b) => a.order - b.order);
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Mastery</h2>
        <span>{percent(averageMastery(pack, learner))}</span>
      </div>
      {modules.map((module) => (
        <div key={module.id} className="mastery-group">
          <h3>{module.title}</h3>
          {module.skillIds.map((skillId) => {
            const skill = pack.curriculum.skills.find((item) => item.id === skillId);
            if (!skill) return null;
            const mastery = learner?.skills[skill.id]?.mastery ?? 0;
            return (
              <div key={skill.id} className="skill-row">
                <div className="skill-label">
                  <span>{skill.title}</span>
                  <span>{percent(mastery)}</span>
                </div>
                <div className="skill-bar">
                  <div style={{ width: percent(mastery) }} />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ReviewPanel({
  pack,
  items,
}: {
  pack: ContentPack;
  items: ReviewItem[];
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Due review</h2>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p>Nothing due.</p>
      ) : (
        items.map((item) => {
          const skill = pack.curriculum.skills.find(
            (entry) => entry.id === item.skillId
          );
          return (
            <div key={item.skillId} className="review-row">
              <span>{skill?.title ?? item.skillId}</span>
              <span>{percent(item.mastery)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

function ConfidenceSelect({
  value,
  onChange,
  disabled,
}: {
  value: Confidence;
  onChange: (value: Confidence) => void;
  disabled: boolean;
}) {
  return (
    <label className="confidence">
      How sure?
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as Confidence)}
      >
        <option value="">Skip</option>
        <option value="guess">Guess</option>
        <option value="unsure">Unsure</option>
        <option value="sure">Sure</option>
      </select>
    </label>
  );
}

function RubricView({ rubric }: { rubric: Rubric }) {
  return (
    <div className="rubric">
      <div className="eyebrow">Rubric</div>
      {rubric.criteria.map((criterion) => (
        <p key={criterion.id}>{criterion.label}</p>
      ))}
    </div>
  );
}

function ActivityView({
  item,
  lab,
  rubric,
  pending,
  selectedOption,
  textAnswer,
  confidence,
  busy,
  onSelectOption,
  onTextChange,
  onConfidence,
  onSubmitText,
  onContinue,
  onSelfComplete,
}: {
  item: Item;
  lab?: Lab;
  rubric?: Rubric;
  pending: Pending | null;
  selectedOption: string | null;
  textAnswer: string;
  confidence: Confidence;
  busy: boolean;
  onSelectOption: (optionId: string) => void;
  onTextChange: (value: string) => void;
  onConfidence: (value: Confidence) => void;
  onSubmitText: () => void;
  onContinue: () => void;
  onSelfComplete: () => void;
}) {
  const feedback = pending ? (
    <div className={`feedback ${pending.correct === false ? "bad" : "good"}`}>
      <p>{pending.feedback}</p>
      <button type="button" className="button" onClick={onContinue} disabled={busy}>
        Continue
      </button>
    </div>
  ) : null;

  if (item.type === "mcq") {
    return (
      <div className="activity">
        <p className="eyebrow">{item.skillIds.join(" · ")}</p>
        <h2>{item.prompt}</h2>
        <div className="options">
          {item.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`option ${selectedOption === option.id ? "selected" : ""}`}
              onClick={() => onSelectOption(option.id)}
              disabled={busy || Boolean(pending)}
            >
              {option.text}
            </button>
          ))}
        </div>
        <ConfidenceSelect
          value={confidence}
          onChange={onConfidence}
          disabled={Boolean(pending)}
        />
        {feedback}
      </div>
    );
  }

  if (
    item.type === "short_answer" ||
    item.type === "teach_back" ||
    item.type === "reflection"
  ) {
    return (
      <div className="activity">
        <p className="eyebrow">{item.skillIds.join(" · ")}</p>
        <h2>{item.prompt}</h2>
        {item.type === "reflection" && (
          <ul className="prompt-list">
            {item.prompts.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
        )}
        {rubric && <RubricView rubric={rubric} />}
        <textarea
          value={textAnswer}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Write your answer..."
          disabled={busy || Boolean(pending)}
        />
        {!pending && (
          <button
            type="button"
            className="button"
            onClick={onSubmitText}
            disabled={busy || !textAnswer.trim()}
          >
            Submit
          </button>
        )}
        {feedback}
      </div>
    );
  }

  if (item.type === "explain") {
    return (
      <div className="activity">
        <p className="eyebrow">{item.skillIds.join(" · ")}</p>
        <h2>{item.prompt}</h2>
        <div className="prose">{item.body}</div>
        <button type="button" className="button" onClick={onSelfComplete} disabled={busy}>
          Continue
        </button>
      </div>
    );
  }

  if (item.type === "worked_example") {
    return (
      <div className="activity">
        <p className="eyebrow">{item.skillIds.join(" · ")}</p>
        <h2>{item.prompt}</h2>
        <ol className="steps">
          {item.steps.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
        <button type="button" className="button" onClick={onSelfComplete} disabled={busy}>
          Continue
        </button>
      </div>
    );
  }

  if (item.type === "lab") {
    return (
      <div className="activity">
        <p className="eyebrow">{item.skillIds.join(" · ")}</p>
        <h2>{item.prompt}</h2>
        {lab ? (
          <>
            <h3>{lab.title}</h3>
            <p>{lab.task}</p>
            <div className="eyebrow">Commands</div>
            <pre>{lab.commands.join("\n")}</pre>
            <div className="eyebrow">Checks</div>
            <ul className="prompt-list">
              {lab.checks.map((check) => (
                <li key={check.id}>{check.prompt}</li>
              ))}
            </ul>
            <div className="eyebrow">Cleanup</div>
            <pre>{lab.cleanup.join("\n")}</pre>
          </>
        ) : (
          <p>Lab details are missing from this pack.</p>
        )}
        <button type="button" className="button" onClick={onSelfComplete} disabled={busy}>
          Mark complete
        </button>
      </div>
    );
  }

  return (
    <div className="activity">
      <h2>Unsupported activity</h2>
      <p>This item type is not supported in the desktop shell yet.</p>
    </div>
  );
}

export default App;
