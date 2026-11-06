# Interactive fiction with Ink

- Status: Idea, not scheduled
- Date: 2026-11-06
- Related: [ADR 0004](../adr/0004-versioned-content-packs.md), [ADR 0009](../adr/0009-no-free-form-prompts-in-packs.md), [Pack schema](../spec/pack-schema-v0.1.md), [Engine contract](../spec/engine-contract-v0.1.md)

## Summary

Add interactive fiction as a content type. Authors write branching scenarios in Ink. The app runs compiled Ink JSON with `inkjs` in the Tauri webview. The engine treats the story as an activity: it selects it, records evidence, and updates mastery.

This is mostly content, with a small runtime adapter. It is not a core engine feature. The engine stays activity-agnostic.

## Why Ink

Ink is a narrative scripting language from inkle. It supports knots, stitches, choices, variables, tags, and external functions. It compiles to JSON and runs offline.

It fits Cairn because it is:

- Deterministic and testable.
- Small and offline.
- Cheap to run.
- Authorable without a server.
- Good for scenarios where the path matters more than one answer.

Useful contexts:

- Docker incident and troubleshooting scenarios.
- Security incident response.
- Customer support and communication practice.
- Ethics, policy, and workplace decisions.
- Clinical or safety decision exercises.
- Any case study where learners need to make a sequence of choices.

## Non-goals

- Ink is not a learner model. It does not estimate mastery.
- It does not replace items, worked examples, or labs.
- It is not AI roleplay. It is authored and deterministic.
- It is not a visual novel engine or a full story authoring GUI in v1.

## Fit with Cairn

The engine boundary stays the same:

- A new item type, `interactive_fiction`.
- The engine selects the story like any other activity.
- The renderer plays the story.
- The story emits evidence events.
- The engine updates mastery and chooses what comes next.

Keep narrative state separate from learner state. Ink variables track the story. The engine tracks mastery, misconceptions, and review.

## Content model

Add a `stories/` directory to the pack:

```
docker-fundamentals.learnpack
├── stories/
│   ├── docker-incident.ink
│   └── docker-incident.ink.json
├── items.json
└── ...
```

Store both the source `.ink` and the compiled `.ink.json`. Authors can edit the source. The app loads the compiled JSON.

Example item:

```json
{
  "id": "docker-incident-1",
  "type": "interactive_fiction",
  "skillIds": ["container-networking", "container-debugging"],
  "difficulty": 3,
  "prompt": "A deployment is failing. Work the incident.",
  "story": "stories/docker-incident.ink.json",
  "entry": "start",
  "initialVariables": {
    "difficulty": "standard",
    "helpLevel": "hint"
  },
  "estimatedMinutes": 12,
  "evidence": {
    "choiceTags": true,
    "endings": ["resolved", "escalated"],
    "reflectionItemId": "docker-incident-reflection"
  }
}
```

This schema is a sketch, not final. It needs validation against the pack schema before implementation.

## Evidence

A single ending is weak evidence. A learner can reach a good ending by guessing. Do not map "good ending" to "mastered."

Use several signals:

- Key choices tagged with skill IDs.
- Misconception tags on bad choices.
- A reflection or teach-back item after the story.
- A short quiz on the concepts the story covered.
- Recovery after a bad choice.
- Time and hint use as flags, not mastery signals.

Ink tags can annotate authored choices:

```ink
* [Check the port mapping]
    # evidence:skill=port-mapping
    # evidence:correct=true
    -> inspect_ports
```

For dynamic evidence, bind a small host function:

```ts
story.BindExternalFunction("recordChoice", (choiceId: string, tag: string) => {
  evidenceBridge.record(choiceId, tag);
});
```

Keep the bridge allowlisted. Do not expose file, network, or shell access to the story.

Evidence weights should be lower than a direct item response unless the choice requires a specific concept. The engine should record the choice, the skill, the misconception if any, and whether the learner recovered.

## Adaptive use

There are two levels of adaptation.

Outside the story: the engine chooses which story, difficulty, or help level to present based on mastery and review state.

Inside the story: pass initial variables such as `difficulty`, `helpLevel`, and `skillFocus`. Let the story branch on those values. Ink variables handle narrative state, not learner state.

Follow-up options:

- Restart with more help.
- Present a worked example.
- Run a short practice set on the weak skill.
- Ask for a teach-back explanation.
- Schedule a review item.

Do not allow a story ending alone to skip a module. Use the same challenge and retention rules as other activities.

## Runtime

- `inkjs` runs in the Tauri webview. No Rust plugin is needed.
- Compile `.ink` to `.json` at authoring or build time with `inklecate` or Inky.
- Do not compile stories at runtime.
- Save Ink state as JSON keyed by story ID and story version.
- If the story changes, reset or migrate saved state. Do not assume old state loads.
- Test on macOS, Windows, and Linux webviews.

Accessibility:

- Keyboard navigation for choices.
- Screen reader labels for choice text and state changes.
- No timed choices by default.
- Transcript or summary after the story.
- Reduced motion option for any animation.

Localization:

- Compile one story per language.
- Store language in the manifest.
- Keep story IDs stable across languages.

## Authoring

For the first spike:

1. Write the story in Inky or a text editor.
2. Compile to JSON.
3. Add evidence tags to key choices.
4. Add a reflection item.
5. Validate the pack.
6. Preview the story in the app.

A future content studio can add a story preview, tag browser, and evidence mapping. A full visual story editor is out of scope.

## AI boundary

- No free-form system prompts in stories.
- AI can suggest hints or feedback, but cannot rewrite story state.
- AI-generated Ink is draft material only. Compile it, validate it, and get human review.
- Story content gets no tool access.
- AI off must still play every story.

## Risks

- Weak assessment if endings are the only evidence.
- Branch explosion and authoring cost.
- State compatibility across story versions.
- Reading load and accessibility.
- Tag or external-function misuse.
- AI-generated stories that are unsafe, inconsistent, or unplayable.
- Scope creep into a visual novel engine.

## Spike proposal

One Docker incident story, 10 to 15 minutes.

- Three key choices.
- Two or three endings.
- One reflection item.
- Evidence tags on key choices.
- Save and resume.
- Runs on macOS, Windows, and Linux.

Acceptance:

- Story loads offline.
- Choices emit evidence.
- Engine updates mastery.
- Save and resume works.
- Reflection influences mastery.
- No unscoped external functions.
- Keyboard and screen reader pass.

## Open questions

- Is this a v1.5 spike or a v2 pack type?
- Who authors the first story?
- How much evidence weight should a key choice carry?
- Do we need a transcript export?
- Do we need a visual story editor, or is Inky enough?
- How do we handle localization and story versioning?
- Do we bundle `inklecate` for authors, or require them to install Inky?

## Recommendation

Do not put interactive fiction in the 12-week v1 core. Add a single-story spike in v1.5 after the item and lab formats are stable. If the spike works, make `interactive_fiction` a first-class content type and document it in the pack schema. Do not let it become the learner model.
