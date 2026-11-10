import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import {
  findScaffold,
  type ContentPack,
  type Item,
  type Lab,
  type MCQItem,
  type Rubric,
} from "@cairn/content";
import {
  createEngine,
  ENGINE_VERSION,
  helpLevelFor,
  isMastered,
  type AdaptiveEngine,
  type Decision,
  type EvidenceEvent,
  type Explanation,
  type LearnerState,
  type ReviewItem,
} from "@cairn/engine";

import "./App.css";
import {
  ItemsForm,
  MetadataForm,
  ModulesForm,
  PolicyForm,
  PracticeGenerator,
  SkillsForm,
  type PackData,
} from "./AuthoringForms";
import {
  exportPack,
  formatPackText,
  starterPackText,
  validatePackText,
  type DraftResult,
} from "./authoring";
import {
  askOllama,
  feedbackPrompt,
  hintPrompt,
  loadAISettings,
  saveAISettings,
  type AIMode,
  type AISettings,
} from "./ai";
import {
  choosePackDirectory,
  entryForPack,
  loadBuiltinPacks,
  loadInstalledPacks,
  loadPack,
  readPackFile,
  removeInstalledPack,
  saveImportedPack,
  type PackEntry,
} from "./packs";
import { extractMaterial, packFromMaterial } from "./material-import";
import { computeBadges } from "./badges";
import { buildReviewCalendar } from "./review-calendar";
import { buildCairnExport, saveCairnExport } from "./export";
import { createPersistentStorage, type AppStorage } from "./storage";
import { ScaffoldActivity, ScaffoldPanel } from "./ScaffoldPanel";
import { CatalogPanel } from "./CatalogPanel";

const LEARNER_ID = "local";
const ACTION_LABEL: Record<Decision["action"], string> = {
  diagnose: "Diagnose",
  explain: "Explain",
  worked_example: "Worked example",
  practice: "Practice",
  review: "Review",
  remediate: "Repair",
  challenge: "Challenge",
  scaffold: "Smaller step",
  complete: "Complete",
};

type ShellStatus = "connecting" | "ready" | "error";
type AdaptiveMode = "auto" | "manual";
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
  const [history, setHistory] = useState<EvidenceEvent[]>([]);
  const [aiSettings, setAISettings] = useState<AISettings>(() => loadAISettings());
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [aiError, setAiError] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [adaptiveMode, setAdaptiveMode] = useState<AdaptiveMode>(() =>
    localStorage.getItem("cairn.adaptive.v1") === "manual" ? "manual" : "auto"
  );
  const [decision, setDecision] = useState<Decision | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [confidence, setConfidence] = useState<Confidence>("");
  const [hintsUsed, setHintsUsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Open the built-in Docker pack or import a .json pack."
  );
  const [error, setError] = useState(false);
  const [authoring, setAuthoring] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftResult, setDraftResult] = useState<DraftResult | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const activityStartedAt = useRef(Date.now());

  const currentItem =
    active && decision?.itemId
      ? (active.pack.items.find((item) => item.id === decision.itemId) ?? null)
      : null;
  const currentScaffold =
    currentItem && decision?.scaffoldId
      ? findScaffold(currentItem.scaffolds ?? [], decision.scaffoldId)
      : undefined;
  const currentLab = active ? labFor(active.pack, currentItem) : undefined;
  const currentRubric = active ? rubricFor(active.pack, currentItem) : undefined;

  function resetActivity(): void {
    setPending(null);
    setSelectedOption(null);
    setTextAnswer("");
    setConfidence("");
    setHintsUsed(0);
    setAiHint(null);
    setAiError(false);
    activityStartedAt.current = Date.now();
  }

  function rememberInstalledPack(
    pack: ContentPack,
    persist = true
  ): PackEntry {
    if (persist) saveImportedPack(pack);
    const entry = entryForPack(pack, "local");
    setPacks((current) => [
      entry,
      ...current.filter((item) => item.id !== entry.id),
    ]);
    return entry;
  }

  async function refreshPackList(): Promise<PackEntry[]> {
    const builtins = await loadBuiltinPacks();
    const installed = loadInstalledPacks().map((pack) =>
      entryForPack(pack, "local")
    );
    const installedIds = new Set(installed.map((entry) => entry.id));
    const list = [
      ...installed,
      ...builtins.filter((entry) => !installedIds.has(entry.id)),
    ];
    setPacks(list);
    return list;
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
    const storage = await getStorage();
    setHistory(await storage.listEvents(LEARNER_ID));
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
      setHistory(await storage.listEvents(LEARNER_ID));
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

  function updateAdaptiveMode(mode: AdaptiveMode): void {
    setAdaptiveMode(mode);
    localStorage.setItem("cairn.adaptive.v1", mode);
    setDecision(null);
    setExplanation(null);
    resetActivity();
    setMessage(
      mode === "manual"
        ? "Manual mode: choose an activity from the pack."
        : "Auto mode: the engine will choose the next activity."
    );
  }

  function startManualItem(item: Item): void {
    if (!active) return;
    const skillId = item.skillIds[0] ?? "";
    const mastery = learner?.skills[skillId]?.mastery ?? 0;
    const helpLevel = learner
      ? helpLevelFor(
          learner,
          mastery,
          learner.skills[skillId]?.consecutiveWrong ?? 0
        )
      : 0;
    setDecision({
      id: newId(),
      learnerId: LEARNER_ID,
      action: "practice",
      itemId: item.id,
      skillIds: item.skillIds,
      reasonCode: "learner_override",
      reason: "You chose this activity in manual mode.",
      evidence: ["manual selection"],
      confidence: mastery,
      helpLevel,
      alternatives: [],
      packVersion: active.pack.manifest.version,
      policyVersion: active.pack.policy.id,
      engineVersion: ENGINE_VERSION,
      createdAt: new Date().toISOString(),
    });
    setExplanation(null);
    resetActivity();
    setMessage("Manual activity selected.");
  }

  async function startSession(): Promise<void> {
    if (!engine) return;
    if (adaptiveMode === "manual") {
      setDecision(null);
      setExplanation(null);
      resetActivity();
      setMessage("Manual mode: choose an activity from the pack.");
      return;
    }
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
    if (!engine || !active || !currentItem || !decision) return;
    setBusy(true);
    setError(false);
    try {
      const selfReported =
        !decision.scaffoldId &&
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
        hintsUsed,
        attempts: 1,
        durationMs: Math.max(1000, Date.now() - activityStartedAt.current),
        evidenceSource:
          input.evidenceSource ?? (selfReported ? "self" : "learner"),
        action: decision.action,
        decisionId: decision.id,
        scaffoldId: decision.scaffoldId,
        misconceptionIds: input.misconceptionIds,
      };
      const result = await engine.record(event);
      setLearner(result.state);
      if (adaptiveMode === "manual") {
        await refresh(engine);
        resetActivity();
        setDecision(null);
        setMessage("Recorded. Choose another activity.");
        return;
      }
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

  function updateAISettings(patch: Partial<AISettings>): void {
    const next = { ...aiSettings, ...patch };
    setAISettings(next);
    saveAISettings(next);
    setAiHint(null);
    setAiError(false);
  }

  async function askAI(kind: "hint" | "feedback"): Promise<void> {
    if (!currentItem || !active || aiSettings.mode === "off") return;
    setAiBusy(true);
    setAiError(false);
    setAiHint(null);
    try {
      const answer = pending
        ? currentItem.type === "mcq"
          ? (currentItem.options.find(
              (option) => option.id === String(pending.response)
            )?.text ?? String(pending.response))
          : String(pending.response ?? textAnswer)
        : textAnswer;
      const prompts =
        kind === "feedback" && pending
          ? feedbackPrompt(
              currentItem,
              active.pack,
              answer,
              pending.correct
            )
          : hintPrompt(currentItem, active.pack);
      setAiHint(
        await askOllama(aiSettings, prompts.system, prompts.prompt)
      );
    } catch (cause) {
      setAiError(true);
      setAiHint(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setAiBusy(false);
    }
  }

  async function startChallenge(skillId: string): Promise<void> {
    if (!engine) return;
    setBusy(true);
    setError(false);
    try {
      const next = await engine.challenge({ learnerId: LEARNER_ID, skillId });
      setDecision(next);
      setExplanation(await engine.explain(next.id));
      await refresh(engine);
      resetActivity();
      setMessage("Optional challenge started.");
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function startNewPack(): void {
    setAuthoring(true);
    setDraft(starterPackText());
    setDraftResult(null);
    setDraftMessage("Starter pack loaded. Edit the JSON, then validate.");
    setError(false);
  }

  function editActivePack(): void {
    if (!active) return;
    setAuthoring(true);
    setDraft(JSON.stringify(active.pack, null, 2));
    setDraftResult(null);
    setDraftMessage("Editing the loaded pack. Saving replaces the local copy.");
    setError(false);
  }

  function validateDraft(): DraftResult {
    const result = validatePackText(draft);
    setDraftResult(result);
    setDraftMessage(
      result.errors.length === 0
        ? result.warnings.length === 0
          ? "Valid pack."
          : `Valid with ${result.warnings.length} warning(s).`
        : `${result.errors.length} error(s). Fix them before saving.`
    );
    return result;
  }

  function formatDraft(): void {
    try {
      setDraft(formatPackText(draft));
      setDraftResult(null);
      setDraftMessage("JSON formatted.");
    } catch (cause) {
      setDraftResult({
        errors: [
          `JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
        ],
        warnings: [],
      });
      setDraftMessage("Could not format invalid JSON.");
    }
  }

  async function saveDraft(): Promise<void> {
    const result = validateDraft();
    if (!result.pack) return;
    const entry = rememberInstalledPack(result.pack);
    await openPack(entry);
    setAuthoring(false);
    setMessage(`Saved ${result.pack.manifest.title} to the local library.`);
  }

  async function exportDraft(): Promise<void> {
    const result = validateDraft();
    if (!result.pack) return;
    const exported = await exportPack(result.pack);
    setDraftMessage(exported ? "Pack exported." : "Export cancelled.");
  }

  async function importMaterial(file: File | undefined): Promise<void> {
    if (!file) return;
    setBusy(true);
    setError(false);
    setMessage(`Extracting ${file.name}...`);
    try {
      const material = await extractMaterial(file);
      const pack = packFromMaterial(material);
      const text = JSON.stringify(pack, null, 2);
      setDraft(text);
      setDraftResult(validatePackText(text));
      setDraftMessage(
        `Draft from ${file.name}. Review it and add practice items before saving.`
      );
      setAuthoring(true);
      setMessage(`Imported material from ${file.name}.`);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function importDraft(file: File | undefined): Promise<void> {
    if (!file) return;
    try {
      setDraft(await file.text());
      setDraftResult(null);
      setDraftMessage("Imported draft. Validate before saving.");
    } catch (cause) {
      setDraftMessage(cause instanceof Error ? cause.message : String(cause));
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
      const entry = rememberInstalledPack(pack);
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
      const entry = rememberInstalledPack(pack);
      await openPack(entry);
      setMessage(`Imported ${pack.manifest.title}.`);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function exportLearnerData(): Promise<void> {
    if (!active || !learner) return;
    setBusy(true);
    setError(false);
    try {
      const storage = await getStorage();
      const events = await storage.listEvents(LEARNER_ID);
      const decisions = await storage.listDecisions(LEARNER_ID);
      const saved = await saveCairnExport(
        buildCairnExport({
          pack: active.pack,
          learner,
          events,
          decisions,
        })
      );
      setMessage(
        saved
          ? `Exported ${events.length} events and ${decisions.length} decisions.`
          : "Export cancelled."
      );
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
    setHistory([]);
    setDecision(null);
    setExplanation(null);
    resetActivity();
    setMessage("Progress reset for this pack.");
  }

  function removeActivePack(): void {
    if (!active || active.entry.source !== "local") return;
    if (
      !window.confirm(
        `Remove ${active.entry.title} from the local library?`
      )
    ) {
      return;
    }
    removeInstalledPack(active.entry.id);
    setActive(null);
    setEngine(null);
    setLearner(null);
    setReviewQueue([]);
    setHistory([]);
    setDecision(null);
    setExplanation(null);
    resetActivity();
    void refreshPackList();
    setMessage(`Removed ${active.entry.title} from the local library.`);
  }

  useEffect(() => {
    invoke<string>("health")
      .then(() => setShell("ready"))
      .catch(() => setShell("error"));

    void (async () => {
      const list = await refreshPackList();
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

        <button
          type="button"
          className="ghost-button"
          onClick={startNewPack}
          disabled={busy}
        >
          New pack
        </button>

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
          onClick={() => setCatalogOpen(true)}
          disabled={busy}
        >
          Browse catalog
        </button>

        <label
          className="import-button"
          title="Markdown, HTML, DOCX, EPUB, or PDF"
        >
          Import material
          <input
            type="file"
            accept=".md,.markdown,.html,.htm,.docx,.epub,.pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              void importMaterial(file);
              event.target.value = "";
            }}
          />
        </label>

        <button
          type="button"
          className="ghost-button"
          onClick={() => void exportLearnerData()}
          disabled={!active || !learner || busy}
        >
          Export data
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
        {authoring ? (
          <AuthoringView
            draft={draft}
            result={draftResult}
            message={draftMessage}
            busy={busy}
            onDraft={(value) => {
              setDraft(value);
              setDraftResult(null);
            }}
            onValidate={() => void validateDraft()}
            onSave={() => void saveDraft()}
            onExport={() => void exportDraft()}
            onFormat={formatDraft}
            onBack={() => {
              setAuthoring(false);
              setDraftResult(null);
              setDraftMessage("");
            }}
            onImport={(file) => void importDraft(file)}
            aiSettings={aiSettings}
            onAISettings={updateAISettings}
          />
        ) : !active ? (
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
                <label className="mode-select">
                  Adaptive
                  <select
                    value={adaptiveMode}
                    onChange={(event) =>
                      updateAdaptiveMode(event.target.value as AdaptiveMode)
                    }
                  >
                    <option value="auto">Auto</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
                {active.entry.source === "local" && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={removeActivePack}
                    disabled={busy}
                  >
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={editActivePack}
                  disabled={busy}
                >
                  Edit pack
                </button>
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
                  adaptiveMode === "manual" ? (
                    <ManualPicker pack={active.pack} onPick={startManualItem} />
                  ) : (
                    <PackOverview
                      pack={active.pack}
                      busy={busy}
                      onStart={() => void startSession()}
                    />
                  )
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
                ) : currentItem && currentScaffold ? (
                  <ScaffoldActivity
                    key={decision.id}
                    scaffold={currentScaffold}
                    parentPrompt={currentItem.prompt}
                    busy={busy}
                    onHelpUsed={() => setHintsUsed((count) => count + 1)}
                    onSubmit={(result) => void record(result)}
                  />
                ) : currentItem ? (
                  <ActivityView
                    key={decision.id}
                    item={currentItem}
                    lab={currentLab}
                    rubric={currentRubric}
                    pending={pending}
                    selectedOption={selectedOption}
                    textAnswer={textAnswer}
                    confidence={confidence}
                    helpLevel={decision.helpLevel}
                    busy={busy}
                    aiMode={aiSettings.mode}
                    aiHint={aiHint}
                    aiBusy={aiBusy}
                    aiError={aiError}
                    onAskAI={(kind) => void askAI(kind)}
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
                    onHintUsed={() => setHintsUsed((count) => count + 1)}
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
                <BadgesPanel
                  pack={active.pack}
                  learner={learner}
                  events={history}
                />
                <ChallengePanel
                  pack={active.pack}
                  learner={learner}
                  busy={busy}
                  onChallenge={(skillId) => void startChallenge(skillId)}
                />
                <ReviewPanel pack={active.pack} items={reviewQueue} />
                <ReviewCalendar
                  pack={active.pack}
                  learner={learner}
                  onReview={() => void startSession()}
                />
                <HistoryPanel pack={active.pack} events={history} />
                <AIPanel settings={aiSettings} onChange={updateAISettings} />
              </aside>
            </div>
          </>
        )}

        <footer className="footer">
          <span>Cairn v0.1 shell</span>
          <span>Tauri 2 · React · TypeScript</span>
        </footer>
      </main>

      {catalogOpen && (
        <CatalogPanel
          installed={Object.fromEntries(
            packs
              .filter((entry) => entry.source === "local")
              .map((entry) => [entry.id, entry.version])
          )}
          onInstalled={(pack) => {
            const entry = rememberInstalledPack(pack, false);
            setCatalogOpen(false);
            void openPack(entry);
          }}
          onClose={() => setCatalogOpen(false)}
        />
      )}
    </div>
  );
}

type AuthoringTab = "metadata" | "modules" | "skills" | "items" | "policy" | "json";

function AuthoringView({
  draft,
  result,
  message,
  busy,
  onDraft,
  onValidate,
  onSave,
  onExport,
  onFormat,
  onBack,
  onImport,
  aiSettings,
  onAISettings,
}: {
  draft: string;
  result: DraftResult | null;
  message: string;
  busy: boolean;
  aiSettings: AISettings;
  onAISettings: (patch: Partial<AISettings>) => void;
  onDraft: (value: string) => void;
  onValidate: () => void;
  onSave: () => void;
  onExport: () => void;
  onFormat: () => void;
  onBack: () => void;
  onImport: (file: File | undefined) => void;
}) {
  const errors = result?.errors ?? [];
  const warnings = result?.warnings ?? [];
  const [tab, setTab] = useState<AuthoringTab>("metadata");
  const data = useMemo<PackData | null>(() => {
    try {
      return JSON.parse(draft) as PackData;
    } catch {
      return null;
    }
  }, [draft]);
  const tabs: { id: AuthoringTab; label: string }[] = [
    { id: "metadata", label: "Metadata" },
    { id: "modules", label: "Modules" },
    { id: "skills", label: "Skills" },
    { id: "items", label: "Items" },
    { id: "policy", label: "Policy" },
    { id: "json", label: "JSON" },
  ];
  function update(mutator: (draftData: PackData) => void): void {
    if (!data) return;
    const next = structuredClone(data);
    mutator(next);
    onDraft(JSON.stringify(next, null, 2));
  }
  return (
    <>
      <header className="pack-head">
        <div>
          <p className="eyebrow">Authoring</p>
          <h1>Pack editor</h1>
          <p className="lede">
            Edit the JSON pack, validate it against the real schema, then save it
            to the local library or export it as a file.
          </p>
        </div>
        <div className="pack-actions">
          <button type="button" className="ghost-button" onClick={onBack}>
            Back
          </button>
        </div>
      </header>

      <div className="workspace">
        <section className="session-card authoring-card">
          <div className="authoring-toolbar">
            <button
              type="button"
              className="button"
              onClick={onValidate}
              disabled={busy}
            >
              Validate
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={onSave}
              disabled={busy}
            >
              Save to library
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={onExport}
              disabled={busy}
            >
              Export
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={onFormat}
              disabled={busy}
            >
              Format JSON
            </button>
            <label className="ghost-button small">
              Import draft
              <input
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(event) => {
                  onImport(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            <span className="muted">{message}</span>
          </div>
          <div className="authoring-tabs" role="tablist">
            {tabs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                className={`authoring-tab ${tab === entry.id ? "active" : ""}`}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          {tab === "json" ? (
            <textarea
              className="authoring-editor"
              value={draft}
              onChange={(event) => onDraft(event.target.value)}
              spellCheck={false}
              aria-label="Pack JSON"
            />
          ) : data ? (
            tab === "metadata" ? (
              <MetadataForm data={data} update={update} />
            ) : tab === "modules" ? (
              <ModulesForm data={data} update={update} />
            ) : tab === "skills" ? (
              <SkillsForm data={data} update={update} />
            ) : tab === "items" ? (
              <>
                <PracticeGenerator
                  data={data}
                  update={update}
                  aiSettings={aiSettings}
                />
                <ItemsForm data={data} update={update} />
              </>
            ) : (
              <PolicyForm data={data} update={update} />
            )
          ) : (
            <p className="hint">
              Fix the JSON in the JSON tab before using the form editor.
            </p>
          )}
        </section>

        <aside className="right-rail">
          <div className="panel">
            <div className="panel-head">
              <h2>Validation</h2>
              <span>
                {errors.length
                  ? `${errors.length} errors`
                  : warnings.length
                    ? `${warnings.length} warnings`
                    : result
                      ? "ok"
                      : "not run"}
              </span>
            </div>
            {!result ? (
              <p>Run validate before saving.</p>
            ) : errors.length === 0 && warnings.length === 0 ? (
              <p>Valid pack. Save it to the local library or export it.</p>
            ) : (
              <>
                {errors.length > 0 && (
                  <ul className="draft-list errors">
                    {errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
                {warnings.length > 0 && (
                  <ul className="draft-list warnings">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Checklist</h2>
            </div>
            <ul className="checklist">
              <li>Manifest id, version, licence, and entries</li>
              <li>Skills with prerequisites and mastery thresholds</li>
              <li>Items linked to skills and misconceptions</li>
              <li>Policy thresholds and review intervals</li>
              <li>No free-form prompts or external media</li>
            </ul>
          </div>
          <AIPanel settings={aiSettings} onChange={onAISettings} />
        </aside>
      </div>
    </>
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

function ManualPicker({
  pack,
  onPick,
}: {
  pack: ContentPack;
  onPick: (item: Item) => void;
}) {
  const [skillId, setSkillId] = useState(
    pack.curriculum.skills[0]?.id ?? ""
  );
  const skill =
    pack.curriculum.skills.find((entry) => entry.id === skillId) ??
    pack.curriculum.skills[0];
  const items = pack.items.filter((item) =>
    item.skillIds.includes(skill?.id ?? "")
  );

  return (
    <div className="manual-picker">
      <p className="eyebrow">Manual mode</p>
      <h2>Choose an activity</h2>
      <p className="muted">
        The engine still records evidence, but it will not choose the path for
        you.
      </p>
      {pack.curriculum.skills.length === 0 ? (
        <p>This pack has no skills.</p>
      ) : (
        <>
          <label className="field-label">
            Skill
            <select
              value={skill?.id ?? ""}
              onChange={(event) => setSkillId(event.target.value)}
            >
              {pack.curriculum.skills.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
          </label>
          <div className="manual-list">
            {items.length === 0 ? (
              <p>No activities for this skill.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="manual-item"
                  onClick={() => onPick(item)}
                >
                  <span className="manual-item-type">{item.type}</span>
                  <span>{item.prompt}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
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
        {decision && <span>{percent(decision.confidence)} · help {decision.helpLevel}</span>}
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
            const mastered = learner
              ? isMastered(skill, learner, pack)
              : false;
            return (
              <div key={skill.id} className="skill-row">
                <div className="skill-label">
                  <span>{skill.title}</span>
                  <span>
                    {percent(mastery)}
                    {mastered ? " · mastered" : ""}
                  </span>
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

function BadgesPanel({
  pack,
  learner,
  events,
}: {
  pack: ContentPack;
  learner: LearnerState | null;
  events: EvidenceEvent[];
}) {
  const badges = computeBadges(pack, learner, events);
  const earned = badges.filter((badge) => badge.earned).length;
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Badges</h2>
        <span>
          {earned}/{badges.length}
        </span>
      </div>
      <div className="badge-grid">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className={`badge ${badge.earned ? "earned" : ""}`}
            title={badge.description}
          >
            <span className="badge-mark">{badge.earned ? "✦" : "·"}</span>
            <span className="badge-label">{badge.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChallengePanel({
  pack,
  learner,
  busy,
  onChallenge,
}: {
  pack: ContentPack;
  learner: LearnerState | null;
  busy: boolean;
  onChallenge: (skillId: string) => void;
}) {
  const skills = pack.curriculum.skills
    .filter((skill) => (learner ? isMastered(skill, learner, pack) : false))
    .map((skill) => ({
      skill,
      mastery: learner?.skills[skill.id]?.mastery ?? 0,
    }))
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 5);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Challenge</h2>
        <span>{skills.length}</span>
      </div>
      {skills.length === 0 ? (
        <p>Master a skill to unlock an optional challenge.</p>
      ) : (
        skills.map((entry) => (
          <div key={entry.skill.id} className="challenge-row">
            <span>{entry.skill.title}</span>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => onChallenge(entry.skill.id)}
              disabled={busy}
            >
              Challenge
            </button>
          </div>
        ))
      )}
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

function ReviewCalendar({
  pack,
  learner,
  onReview,
}: {
  pack: ContentPack;
  learner: LearnerState | null;
  onReview: () => void;
}) {
  const days = buildReviewCalendar(pack, learner);
  const [selected, setSelected] = useState(
    days.find((day) => day.skills.length > 0)?.date ?? days[0]?.date ?? ""
  );
  const selectedDay =
    days.find((day) => day.date === selected) ??
    days.find((day) => day.skills.length > 0) ??
    days[0];
  const hasAny = days.some((day) => day.skills.length > 0);
  const dueNow = days.some(
    (day) => day.overdue || (day.today && day.skills.length > 0)
  );

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Review calendar</h2>
        {dueNow && (
          <button
            type="button"
            className="ghost-button small"
            onClick={onReview}
          >
            Review now
          </button>
        )}
      </div>
      {!hasAny ? (
        <p>No reviews scheduled yet.</p>
      ) : (
        <>
          <div className="calendar-strip">
            {days.slice(0, 8).map((day) => (
              <button
                key={day.date}
                type="button"
                className={`calendar-day ${day.overdue ? "overdue" : ""} ${
                  day.today ? "today" : ""
                } ${selectedDay?.date === day.date ? "selected" : ""}`}
                onClick={() => setSelected(day.date)}
              >
                <span>
                  {day.overdue
                    ? "Overdue"
                    : day.today
                      ? "Today"
                      : day.label.split(",")[0]}
                </span>
                <strong>{day.skills.length}</strong>
              </button>
            ))}
          </div>
          {selectedDay && (
            <div className="calendar-detail">
              {selectedDay.skills.length === 0 ? (
                <p>Nothing scheduled.</p>
              ) : (
                selectedDay.skills.map((skill) => (
                  <div key={skill.id} className="review-row">
                    <span>{skill.title}</span>
                    <span>{percent(skill.mastery)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HistoryPanel({
  pack,
  events,
}: {
  pack: ContentPack;
  events: EvidenceEvent[];
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Recent</h2>
        <span>{events.length}</span>
      </div>
      {events.length === 0 ? (
        <p>No activity yet.</p>
      ) : (
        events.slice(0, 6).map((event) => {
          const item = pack.items.find((entry) => entry.id === event.itemId);
          const state =
            event.correct === true
              ? "correct"
              : event.correct === false
                ? "miss"
                : "done";
          return (
            <div key={event.id} className="history-row">
              <span className="history-label">
                {item?.prompt ?? event.itemId}
              </span>
              <span className={`history-state ${state}`}>{state}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

function AIPanel({
  settings,
  onChange,
}: {
  settings: AISettings;
  onChange: (patch: Partial<AISettings>) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>AI</h2>
        <span>{settings.mode}</span>
      </div>
      <label className="field-label">
        Mode
        <select
          value={settings.mode}
          onChange={(event) =>
            onChange({ mode: event.target.value as AIMode })
          }
        >
          <option value="off">Off</option>
          <option value="assist">Assist</option>
          <option value="full">Full</option>
        </select>
      </label>
      {settings.mode !== "off" && (
        <>
          <label className="field-label">
            Model
            <input
              value={settings.model}
              onChange={(event) => onChange({ model: event.target.value })}
            />
          </label>
          <label className="field-label">
            Ollama URL
            <input
              value={settings.baseUrl}
              onChange={(event) => onChange({ baseUrl: event.target.value })}
            />
          </label>
          <p>Local Ollama only. AI hints are optional and never recorded as answers.</p>
        </>
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
  helpLevel,
  busy,
  aiMode,
  aiHint,
  aiBusy,
  aiError,
  onAskAI,
  onSelectOption,
  onTextChange,
  onConfidence,
  onSubmitText,
  onContinue,
  onSelfComplete,
  onHintUsed,
}: {
  item: Item;
  lab?: Lab;
  rubric?: Rubric;
  pending: Pending | null;
  selectedOption: string | null;
  textAnswer: string;
  confidence: Confidence;
  helpLevel: number;
  busy: boolean;
  aiMode: AIMode;
  aiHint: string | null;
  aiBusy: boolean;
  aiError: boolean;
  onAskAI: (kind: "hint" | "feedback") => void;
  onSelectOption: (optionId: string) => void;
  onTextChange: (value: string) => void;
  onConfidence: (value: Confidence) => void;
  onSubmitText: () => void;
  onContinue: () => void;
  onSelfComplete: () => void;
  onHintUsed: () => void;
}) {
  const [visibleHints, setVisibleHints] = useState(0);
  const [checkAnswer, setCheckAnswer] = useState("");
  const [checkResult, setCheckResult] = useState<"correct" | "wrong" | null>(
    null
  );
  const hints = (item.hints ?? []).filter(
    (hint) => hint.level <= helpLevel
  );

  const checkpointBlock = (prompt: string, answer: string) => {
    const check = () => {
      const normalized = (value: string) =>
        value.trim().toLowerCase().replace(/[.,!?]/g, "");
      const expected = normalized(answer);
      setCheckResult(
        normalized(checkAnswer).includes(expected) ? "correct" : "wrong"
      );
    };

    return (
      <div className="checkpoint">
        <p className="eyebrow">Quick check</p>
        <p>{prompt}</p>
        <div className="checkpoint-row">
          <input
            value={checkAnswer}
            onChange={(event) => {
              setCheckAnswer(event.target.value);
              setCheckResult(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                check();
              }
            }}
            placeholder="Your answer"
            aria-label={prompt}
          />
          <button
            type="button"
            className="ghost-button small"
            disabled={!checkAnswer.trim()}
            onClick={check}
          >
            Check
          </button>
        </div>
        {checkResult && (
          <p className={`checkpoint-result ${checkResult}`}>
            {checkResult === "correct"
              ? "Correct."
              : "Not quite. Re-read the section and try again."}
          </p>
        )}
      </div>
    );
  };
  const hintBlock =
    hints.length > 0 ? (
      <div className="hints">
        {hints.slice(0, visibleHints).map((hint, index) => (
          <p key={`${hint.level}-${index}`}>
            <strong>Hint {index + 1}</strong> {hint.text}
          </p>
        ))}
        {visibleHints < hints.length && (
          <button
            type="button"
            className="ghost-button small"
            onClick={() => {
              setVisibleHints((count) => count + 1);
              onHintUsed();
            }}
            disabled={busy || Boolean(pending)}
          >
            Show hint {visibleHints + 1}
          </button>
        )}
      </div>
    ) : null;

  const scaffoldBlock =
    (item.scaffolds ?? []).length > 0 ? (
      <ScaffoldPanel
        scaffolds={item.scaffolds ?? []}
        onHelpUsed={onHintUsed}
        defaultOpen={helpLevel >= 3}
      />
    ) : null;

  const feedback = pending ? (
    <div className={`feedback ${pending.correct === false ? "bad" : "good"}`}>
      <p>{pending.feedback}</p>
      <button type="button" className="button" onClick={onContinue} disabled={busy}>
        Continue
      </button>
    </div>
  ) : null;

  const aiBlock =
    aiMode === "off" ? null : (
      <div className={`ai-box ${aiError ? "error" : ""}`}>
        <div className="ai-head">
          <span>AI suggestion</span>
          <button
            type="button"
            className="ghost-button small"
            onClick={() =>
              onAskAI(pending && aiMode === "full" ? "feedback" : "hint")
            }
            disabled={aiBusy || busy}
          >
            {aiBusy
              ? "Thinking..."
              : pending && aiMode === "full"
                ? "Explain my answer"
                : "Ask for a hint"}
          </button>
        </div>
        {aiHint && <p>{aiHint}</p>}
      </div>
    );

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
        {hintBlock}
        {scaffoldBlock}
        {feedback}
        {aiBlock}
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
        {hintBlock}
        {scaffoldBlock}
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
        {aiBlock}
      </div>
    );
  }

  if (item.type === "explain") {
    return (
      <div className="activity">
        <p className="eyebrow">{item.skillIds.join(" · ")}</p>
        <h2>{item.prompt}</h2>
        <div className="prose">{item.body}</div>
        {item.check && checkpointBlock(item.check.prompt, item.check.answer)}
        {hintBlock}
        {scaffoldBlock}
        <button type="button" className="button" onClick={onSelfComplete} disabled={busy}>
          Continue
        </button>
        {aiBlock}
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
        {item.checkpoint &&
          checkpointBlock(item.checkpoint.prompt, item.checkpoint.answer)}
        {hintBlock}
        {scaffoldBlock}
        <button type="button" className="button" onClick={onSelfComplete} disabled={busy}>
          Continue
        </button>
        {aiBlock}
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
        {hintBlock}
        {scaffoldBlock}
        <button type="button" className="button" onClick={onSelfComplete} disabled={busy}>
          Mark complete
        </button>
        {aiBlock}
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
