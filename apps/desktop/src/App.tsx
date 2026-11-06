import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import "./App.css";
import { runSmokeTest } from "./engine-smoke";

type ShellStatus = "connecting" | "ready" | "error";

function App() {
  const [shell, setShell] = useState<ShellStatus>("connecting");
  const [smoke, setSmoke] = useState("Not run yet.");
  const [smokeError, setSmokeError] = useState(false);

  useEffect(() => {
    invoke<string>("health")
      .then(() => setShell("ready"))
      .catch(() => setShell("error"));
  }, []);

  async function checkEngine() {
    setSmokeError(false);
    setSmoke("Running...");
    try {
      setSmoke(await runSmokeTest());
    } catch (error) {
      setSmokeError(true);
      setSmoke(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">✦</span>
          <span>
            Cairn <span className="muted">adaptive learning</span>
          </span>
        </div>
        <span className={`status ${shell}`}>
          {shell === "ready"
            ? "Desktop shell connected"
            : shell === "error"
              ? "Shell connection failed"
              : "Connecting to shell..."}
        </span>
      </header>

      <aside className="sidebar">
        <div className="eyebrow">Library</div>
        <button type="button" className="library-item active">
          <span className="library-title">Getting started</span>
          <span className="library-meta">No pack loaded</span>
        </button>
        <button type="button" className="library-item" disabled>
          <span className="library-title">Docker Fundamentals</span>
          <span className="library-meta">Next step</span>
        </button>

        <div className="sidebar-note">
          <strong>Local-first.</strong> Your notes, answers, and progress stay on
          this machine. AI is optional.
        </div>
      </aside>

      <main className="main">
        <section className="hero">
          <p className="eyebrow">Specification to shell</p>
          <h1>Learn with a path you can see and steer.</h1>
          <p className="lede">
            Cairn builds a skill map, diagnoses where you are, and adapts
            difficulty, help, and review. Every decision has a reason and an
            override.
          </p>
        </section>

        <section className="cards">
          <article className="card">
            <h2>Engine</h2>
            <p>
              BKT-lite, review scheduling, next-activity policy, and decision
              explanations.
            </p>
            <button type="button" className="button" onClick={checkEngine}>
              Run engine smoke test
            </button>
            <pre className={`output ${smokeError ? "error" : ""}`}>{smoke}</pre>
          </article>

          <article className="card">
            <h2>Content</h2>
            <p>
              Docker fundamentals is the first pack: 9 skills, 37 items, and 5
              learner-run labs.
            </p>
            <span className="pill">Pack import is next</span>
          </article>

          <article className="card">
            <h2>Controls</h2>
            <p>
              Difficulty, help, AI, and path controls are planned for the
              session view.
            </p>
            <span className="pill">Human agency first</span>
          </article>
        </section>

        <footer className="footer">
          <span>Cairn v0.1 shell</span>
          <span>Tauri 2 · React · TypeScript</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
