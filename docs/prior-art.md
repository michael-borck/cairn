# Prior art

Cairn sits in a long lineage. This document records what is borrowed, what is different, and what to learn from OATutor.

## The honest comparison

| System | Adaptive model | Content ownership | Local-first | Learner agency | Open source |
|---|---|---|---|---|---|
| Traditional LMS | Mostly fixed path | Institution | No | Low | Some |
| ALEKS | Knowledge Space Theory | Vendor | No | Medium | No |
| Knewton Alta | Prerequisite remediation | Vendor | No | Medium | No |
| Khan Academy | Mastery practice | Platform | No | Medium | Platform no, content often CC |
| Duolingo | Difficulty and engagement tuning | Platform | No | Low | No |
| Anki | Spaced repetition | User | Yes | High | Yes |
| OATutor | BKT and mastery | Curated library | Web app, not local-first | Medium | Yes |
| ChatGPT / chat tutors | LLM conversation | User prompts | Depends | High but unstructured | ChatGPT is proprietary; Llama Tutor and others are OSS |
| Cairn | BKT-lite, retention, mastery gates, review, dwell | User packs | Yes | High | Yes |

## OATutor ideas worth incorporating

OATutor is the closest open-source adaptive tutor. Cairn should learn from it without copying its product shape.

1. **Hint and scaffold hierarchy**
   OATutor supports a problem, hints, scaffolds, and sub-scaffolds. Cairn now supports a recursive scaffold tree on any item, with optional hints and nested sub-scaffolds. The learner can open it from any activity, and it opens automatically at walkthrough help levels.

2. **Skill and problem pools**
   OATutor tags problems by skill and selects from a pool. Cairn already has skills and items, but could add explicit problem pools per skill and difficulty band.

3. **BKT parameter fitting**
   OATutor uses BKT with fitted parameters. Cairn uses fixed defaults. Use pyBKT offline to fit per-skill parameters from real logs, then import them.

4. **Mastery visualization**
   OATutor shows mastery clearly. Cairn has a mastery map, but should show evidence, gate status, and next review more explicitly.

5. **A/B testing and research hooks**
   OATutor supports research experiments. Cairn has decision logs and the Ledgers harness. Add policy version, experiment arm, and propensity fields to the export.

6. **LTI integration**
   OATutor has an LTI middleware. Cairn should treat LTI as a later adapter, not a core feature.

7. **Curated open content**
   OATutor uses Creative Commons content. Cairn's packs should require clear licences and provenance.

8. **Accessibility**
   OATutor is Section 508 compliant. Cairn needs a WCAG 2.2 AA pass before a public pilot.

9. **Authoring workflow**
   OATutor has authoring notebooks. Cairn has a JSON/form editor, material import, and recursive scaffold authoring. The next step is better hint authoring, not a bigger course builder.

## What Cairn should not copy

- A math-only content shape.
- A web-first, Firebase-first deployment model.
- A fixed course library as the only content source.
- A single scalar mastery view without retention or evidence.
- Research features that are invisible to the learner.

## Cairn's niche

Cairn is for self-directed adults who bring their own material and want a tutor that runs on their machine.

It is not trying to be a better LMS, a bigger marketplace, or a new BKT. It is trying to make adaptive learning:

- private by default,
- content-owned,
- explainable,
- optional in its use of AI,
- and portable across packs.

That is the niche. The adaptive methods are inherited. The ownership model is the bet.
