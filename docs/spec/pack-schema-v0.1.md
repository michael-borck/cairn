# Content pack schema v0.1

A `.learnpack` is a zip containing a manifest, curriculum, items, rubrics, misconceptions, labs, policy, media, and licence.

## Layout

```
docker-fundamentals.learnpack
├── manifest.json
├── curriculum.json
├── items.json
├── rubrics.json
├── misconceptions.json
├── labs.json
├── policy.json
├── media/
├── LICENSE
└── CHANGELOG.md
```

## manifest.json

```json
{
  "schemaVersion": "0.1",
  "id": "docker-fundamentals",
  "version": "1.0.0",
  "title": "Docker Fundamentals",
  "description": "A hands-on introduction to containers, images, networking, and volumes.",
  "author": {
    "name": "Michael",
    "url": "https://example.com"
  },
  "license": "CC-BY-4.0",
  "source": "https://example.com/source",
  "language": "en",
  "audience": "adult-self-learner",
  "level": "beginner",
  "estimatedMinutes": 180,
  "engine": {
    "minVersion": "0.1.0"
  },
  "requires": {
    "ai": false,
    "docker": true,
    "appNetwork": false
  },
  "entries": {
    "curriculum": "curriculum.json",
    "items": "items.json",
    "rubrics": "rubrics.json",
    "misconceptions": "misconceptions.json",
    "labs": "labs.json",
    "policy": "policy.json"
  }
}
```

No checksum in the manifest. The catalog stores the artifact hash.

## curriculum.json

Modules group skills for display. Skills are the mastery unit.

```json
{
  "modules": [
    {
      "id": "containers",
      "title": "Containers",
      "order": 1,
      "skillIds": ["what-is-a-container", "run-a-container"]
    }
  ],
  "skills": [
    {
      "id": "run-a-container",
      "title": "Run a container",
      "description": "Start, inspect, stop, and remove a container.",
      "prerequisites": ["what-is-a-container"],
      "difficulty": 2,
      "masteryThreshold": 0.9,
      "estimatedMinutes": 20,
      "tags": ["docker", "containers"]
    }
  ]
}
```

Rules:

- Skill IDs are stable and never reused.
- Prerequisites form a directed acyclic graph.
- `masteryThreshold` overrides the policy default for that skill.
- `difficulty` is 1 to 5. The engine maps it to an initial Elo value.

## items.json

Items are a discriminated union on `type`. V1 types: `mcq`, `short_answer`, `teach_back`, `worked_example`, `lab`, `reflection`.

### Base fields

```ts
type ItemType =
  | "mcq"
  | "short_answer"
  | "teach_back"
  | "worked_example"
  | "lab"
  | "reflection";

interface ItemBase {
  id: string;
  type: ItemType;
  skillIds: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  prompt: string;
  media?: MediaRef[];
  hints: Hint[];
  explanation?: string;
  misconceptionIds?: string[];
  source?: SourceRef;
  estimatedSeconds?: number;
  tags?: string[];
  variantOf?: string;
}

interface Hint {
  level: 1 | 2 | 3 | 4;
  text: string;
  revealsAnswer?: boolean;
}

interface MediaRef {
  type: "image" | "diagram" | "video";
  path: string;
  alt: string;
}

interface SourceRef {
  title: string;
  url?: string;
  license: string;
}
```

### Item types

```ts
interface MCQItem extends ItemBase {
  type: "mcq";
  options: {
    id: string;
    text: string;
    misconceptionId?: string;
  }[];
  correctOptionId: string;
  confidencePrompt?: boolean;
}

interface ShortAnswerItem extends ItemBase {
  type: "short_answer";
  scoring: {
    mode: "exact" | "contains" | "regex" | "rubric";
    value?: string;
    rubricId?: string;
  };
  modelAnswer?: string;
}

interface TeachBackItem extends ItemBase {
  type: "teach_back";
  rubricId: string;
  modelAnswer?: string;
}

interface WorkedExampleItem extends ItemBase {
  type: "worked_example";
  steps: {
    title: string;
    body: string;
    media?: MediaRef[];
  }[];
  checkpoint?: {
    prompt: string;
    answer: string;
  };
}

interface LabItem extends ItemBase {
  type: "lab";
  labId: string;
}

interface ReflectionItem extends ItemBase {
  type: "reflection";
  prompts: string[];
}
```

### Example MCQ

```json
{
  "id": "port-mapping-mcq-1",
  "type": "mcq",
  "skillIds": ["port-mapping"],
  "difficulty": 2,
  "prompt": "Which command publishes container port 80 on host port 8080?",
  "options": [
    {
      "id": "a",
      "text": "docker run -p 80:8080 nginx",
      "misconceptionId": "port-order-reversed"
    },
    {
      "id": "b",
      "text": "docker run -p 8080:80 nginx"
    },
    {
      "id": "c",
      "text": "docker run -p 8080 nginx",
      "misconceptionId": "missing-container-port"
    }
  ],
  "correctOptionId": "b",
  "confidencePrompt": true,
  "hints": [
    {
      "level": 1,
      "text": "The port mapping has two sides. Which side is the host?"
    },
    {
      "level": 2,
      "text": "The syntax is host:container."
    }
  ],
  "explanation": "`-p 8080:80` maps host port 8080 to container port 80.",
  "estimatedSeconds": 45
}
```

## rubrics.json

Used for teach-back, short-answer, and optional AI grading.

```json
{
  "id": "explain-port-mapping",
  "title": "Explain port mapping",
  "criteria": [
    {
      "id": "host-port",
      "label": "Identifies the host port",
      "weight": 0.5,
      "levels": {
        "0": "Missing",
        "1": "Partial",
        "2": "Clear"
      }
    },
    {
      "id": "container-port",
      "label": "Identifies the container port",
      "weight": 0.5,
      "levels": {
        "0": "Missing",
        "1": "Partial",
        "2": "Clear"
      }
    }
  ]
}
```

## misconceptions.json

```json
{
  "id": "port-order-reversed",
  "label": "Reverses host and container ports",
  "skillIds": ["port-mapping"],
  "description": "The learner maps 80:8080 instead of 8080:80.",
  "remediation": {
    "strategy": "contrast",
    "explanation": "The host port comes first. The container port comes second.",
    "itemIds": ["port-mapping-mcq-2", "port-mapping-lab-1"]
  }
}
```

## labs.json

V1 labs are learner-run. The app does not execute containers.

```json
{
  "id": "run-nginx",
  "title": "Run nginx",
  "skillIds": ["run-a-container"],
  "platforms": ["macos", "linux", "windows"],
  "setup": ["docker --version"],
  "task": "Run nginx and confirm it responds on localhost:8080.",
  "commands": ["docker run -d --name web -p 8080:80 nginx:1.27"],
  "checks": [
    {
      "id": "running",
      "type": "manual",
      "prompt": "Does `docker ps` show the container?",
      "answer": "yes"
    },
    {
      "id": "http",
      "type": "manual",
      "prompt": "Does http://localhost:8080 show the nginx welcome page?",
      "answer": "yes"
    }
  ],
  "hints": [
    {
      "level": 1,
      "text": "Check that the container is running with `docker ps`."
    },
    {
      "level": 2,
      "text": "Check the port mapping. The left side is the host port."
    }
  ],
  "solution": "docker run -d --name web -p 8080:80 nginx:1.27",
  "cleanup": ["docker stop web", "docker rm web"],
  "security": {
    "executesOnHost": false,
    "network": true
  }
}
```

Add `type: "paste_output"` later if the app should check copied terminal output.

## policy.json

Pack-level policy overrides. Keep it small and versioned.

```json
{
  "id": "default-v1",
  "targetSuccessMin": 0.75,
  "targetSuccessMax": 0.85,
  "masteryThreshold": 0.9,
  "reviewIntervalsDays": [1, 3, 7, 21, 60],
  "hysteresis": {
    "observations": 2,
    "minItemsBetweenChanges": 3
  },
  "wrongStreak": {
    "similarItem": 1,
    "switchRepresentation": 2,
    "prerequisite": 3
  },
  "help": {
    "startLevelByMastery": {
      "0.0": 2,
      "0.4": 1,
      "0.7": 0
    },
    "escalateAfterWrong": 2,
    "fadeAfterCorrect": 2
  },
  "confidenceSampleRate": 0.2
}
```

## AI boundary

No free-form prompts in packs. This is a security rule.

- Packs provide content, rubrics, hints, and misconception mappings.
- The engine owns prompt templates.
- AI output must match a typed schema.
- AI-generated item variants are ephemeral and labelled. They are not written into the pack unless a human approves them.
- AI mode off works with all static content.

## Validation

Reject:

- Duplicate IDs.
- Missing skill references.
- Prerequisite cycles.
- MCQ items with a missing `correctOptionId`.
- Labs without checks or cleanup.
- Hints that reveal the answer at level 1.
- External media URLs outside an allowlist.
- Executable content in v1 labs.
- Missing licence, changelog, or `minEngineVersion`.
- Packs above the size cap.
- Free-form AI prompt fields.

Warn on:

- Skills with fewer than three practice items.
- Skills with no worked example or explanatory activity.
- Distractors without a misconception mapping.
- Items with no hints.
- Labs without platform notes.

## Versioning

- Packs use semantic versioning.
- Skill IDs and item IDs are stable.
- Deprecate with `deprecated: true` and `replacedBy`.
- Item variants use `variantOf`.
- Decisions record `packVersion`, `policyVersion`, and `engineVersion`.
- On update, preserve learner state for stable skill IDs and archive removed skills.
