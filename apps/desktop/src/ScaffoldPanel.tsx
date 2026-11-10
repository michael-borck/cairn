import { useEffect, useRef, useState } from "react";
import type { Scaffold } from "@cairn/content";

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[.,!?]/g, "");
}

function answerMatches(input: string, expected: string): boolean {
  const answer = normalize(input);
  const target = normalize(expected);
  if (!answer || !target) return false;
  if (answer === target) return true;
  return (
    answer.startsWith(`${target} `) ||
    answer.endsWith(` ${target}`) ||
    answer.includes(` ${target} `)
  );
}

export function ScaffoldPanel({
  scaffolds,
  onHelpUsed,
  defaultOpen = false,
}: {
  scaffolds: Scaffold[];
  onHelpUsed: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reported = useRef(false);

  useEffect(() => {
    if (defaultOpen && !reported.current) {
      reported.current = true;
      onHelpUsed();
    }
  }, [defaultOpen, onHelpUsed]);

  if (scaffolds.length === 0) return null;

  return (
    <div className="scaffold-panel">
      <button
        type="button"
        className="ghost-button small"
        aria-expanded={open}
        onClick={() => {
          if (!open) onHelpUsed();
          setOpen((value) => !value);
        }}
      >
        {open ? "Hide scaffold" : "Break this down"}
      </button>
      {open && (
        <div className="scaffold-body">
          <p className="scaffold-intro">
            Work through these smaller steps, then try the main question again.
          </p>
          {scaffolds.map((scaffold) => (
            <ScaffoldStep
              key={scaffold.id}
              scaffold={scaffold}
              depth={0}
              onHelpUsed={onHelpUsed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ScaffoldActivity({
  scaffold,
  parentPrompt,
  busy,
  onHelpUsed,
  onSubmit,
}: {
  scaffold: Scaffold;
  parentPrompt: string;
  busy: boolean;
  onHelpUsed: () => void;
  onSubmit: (result: {
    correct: boolean;
    score: number;
    response: unknown;
  }) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    correct: boolean;
    score: number;
    response: unknown;
  } | null>(null);
  const [visibleHints, setVisibleHints] = useState(0);
  const hints = (scaffold.hints ?? []).slice(0, visibleHints);

  function check(): void {
    if (pending) return;
    const correct =
      scaffold.kind === "mcq"
        ? selected === scaffold.correctOptionId
        : answerMatches(answer, scaffold.answer ?? "");
    setPending({
      correct,
      score: correct ? 1 : 0,
      response: scaffold.kind === "mcq" ? selected : answer,
    });
  }

  return (
    <div className="activity scaffold-activity">
      <p className="eyebrow">Smaller step</p>
      <h2>{scaffold.prompt}</h2>
      <p className="scaffold-parent">From: {parentPrompt}</p>

      {scaffold.kind === "mcq" ? (
        <div className="options">
          {(scaffold.options ?? []).map((option) => (
            <button
              key={option.id}
              type="button"
              className={`option ${selected === option.id ? "selected" : ""}`}
              onClick={() => setSelected(option.id)}
              disabled={busy || Boolean(pending)}
            >
              {option.text}
            </button>
          ))}
        </div>
      ) : (
        <input
          className="scaffold-answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (pending) onSubmit(pending);
              else check();
            }
          }}
          placeholder="Your answer"
          aria-label={scaffold.prompt}
          disabled={busy || Boolean(pending)}
        />
      )}

      {!pending && (
        <button
          type="button"
          className="button"
          onClick={check}
          disabled={
            busy || (scaffold.kind === "mcq" ? !selected : !answer.trim())
          }
        >
          Check
        </button>
      )}

      {(scaffold.hints ?? []).length > 0 && (
        <div className="hints">
          {hints.map((hint, index) => (
            <p key={`${hint.level}-${index}`}>
              <strong>Hint {index + 1}</strong> {hint.text}
            </p>
          ))}
          {visibleHints < (scaffold.hints ?? []).length && (
            <button
              type="button"
              className="ghost-button small"
              onClick={() => {
                setVisibleHints((count) => count + 1);
                onHelpUsed();
              }}
              disabled={busy || Boolean(pending)}
            >
              Show hint {visibleHints + 1}
            </button>
          )}
        </div>
      )}

      {pending && (
        <div className={`feedback ${pending.correct ? "good" : "bad"}`}>
          <p>
            {pending.correct
              ? "Correct. Keep going."
              : "Not quite. The next step will be smaller if this one has a sub-step."}
          </p>
          <button
            type="button"
            className="button"
            onClick={() => onSubmit(pending)}
            disabled={busy}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

function ScaffoldStep({
  scaffold,
  depth,
  onHelpUsed,
}: {
  scaffold: Scaffold;
  depth: number;
  onHelpUsed: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [visibleHints, setVisibleHints] = useState(0);
  const [done, setDone] = useState(false);

  const hints = (scaffold.hints ?? []).slice(0, visibleHints);

  function check(): void {
    if (done) return;
    if (scaffold.kind === "mcq") {
      setResult(selected === scaffold.correctOptionId ? "correct" : "wrong");
      return;
    }
    setResult(answerMatches(answer, scaffold.answer ?? "") ? "correct" : "wrong");
  }

  return (
    <div className={`scaffold-step depth-${depth} ${done ? "done" : ""}`}>
      <div className="scaffold-step-head">
        <span className="scaffold-step-label">
          {depth === 0 ? "Scaffold" : `Smaller step ${depth}`}
        </span>
        {done && <span className="scaffold-done">Done</span>}
      </div>
      <p className="scaffold-prompt">{scaffold.prompt}</p>

      {scaffold.kind === "mcq" ? (
        <div className="scaffold-options">
          {(scaffold.options ?? []).map((option) => (
            <button
              key={option.id}
              type="button"
              className={`option ${selected === option.id ? "selected" : ""}`}
              onClick={() => {
                setSelected(option.id);
                setResult(null);
              }}
              disabled={done}
            >
              {option.text}
            </button>
          ))}
        </div>
      ) : (
        <div className="checkpoint-row">
          <input
            value={answer}
            onChange={(event) => {
              setAnswer(event.target.value);
              setResult(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                check();
              }
            }}
            placeholder="Your answer"
            aria-label={scaffold.prompt}
            disabled={done}
          />
        </div>
      )}

      {!done && (
        <div className="scaffold-actions">
          <button
            type="button"
            className="ghost-button small"
            onClick={check}
            disabled={
              scaffold.kind === "mcq" ? !selected : !answer.trim()
            }
          >
            Check
          </button>
        </div>
      )}

      {result && !done && (
        <p className={`checkpoint-result ${result}`}>
          {result === "correct"
            ? "Correct. You can mark this step done."
            : "Not quite. Try a hint or a smaller step."}
        </p>
      )}

      {!done && (scaffold.hints ?? []).length > 0 && (
        <div className="scaffold-hints">
          {hints.map((hint, index) => (
            <p key={`${hint.level}-${index}`}>
              <strong>Hint {index + 1}</strong> {hint.text}
            </p>
          ))}
          {visibleHints < (scaffold.hints ?? []).length && (
            <button
              type="button"
              className="ghost-button small"
              onClick={() => {
                setVisibleHints((count) => count + 1);
                onHelpUsed();
              }}
            >
              Show hint {visibleHints + 1}
            </button>
          )}
        </div>
      )}

      {result === "correct" && !done && (
        <button
          type="button"
          className="button small"
          onClick={() => setDone(true)}
        >
          Mark step done
        </button>
      )}

      {result === "wrong" && (scaffold.scaffolds ?? []).length > 0 && (
        <div className="scaffold-children">
          <p>Try a smaller step:</p>
          {(scaffold.scaffolds ?? []).map((child) => (
            <ScaffoldStep
              key={child.id}
              scaffold={child}
              depth={depth + 1}
              onHelpUsed={onHelpUsed}
            />
          ))}
        </div>
      )}
    </div>
  );
}
