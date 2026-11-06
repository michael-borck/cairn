import { invoke } from "@tauri-apps/api/core";
import type { ContentPack, Item } from "@cairn/content";

export type AIMode = "off" | "assist" | "full";

export interface AISettings {
  mode: AIMode;
  baseUrl: string;
  model: string;
}

const SETTINGS_KEY = "cairn.ai.v1";

export const DEFAULT_AI_SETTINGS: AISettings = {
  mode: "off",
  baseUrl: "http://127.0.0.1:11434",
  model: "llama3.1:8b",
};

function isMode(value: unknown): value is AIMode {
  return value === "off" || value === "assist" || value === "full";
}

export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    return {
      mode: isMode(parsed.mode) ? parsed.mode : "off",
      baseUrl:
        typeof parsed.baseUrl === "string" && parsed.baseUrl
          ? parsed.baseUrl
          : DEFAULT_AI_SETTINGS.baseUrl,
      model:
        typeof parsed.model === "string" && parsed.model
          ? parsed.model
          : DEFAULT_AI_SETTINGS.model,
    };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAISettings(settings: AISettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function askOllama(
  settings: AISettings,
  system: string,
  prompt: string
): Promise<string> {
  if (settings.mode === "off") throw new Error("AI is off.");
  return invoke<string>("ollama_chat", {
    baseUrl: settings.baseUrl,
    model: settings.model,
    system,
    prompt,
  });
}

function skillLabel(item: Item, pack: ContentPack): string {
  return item.skillIds
    .map(
      (id) =>
        pack.curriculum.skills.find((skill) => skill.id === id)?.title ?? id
    )
    .join(", ");
}

export function itemContext(item: Item, pack: ContentPack): string {
  const skills = skillLabel(item, pack);
  if (item.type === "mcq") {
    return [
      `Skills: ${skills}`,
      `Question: ${item.prompt}`,
      `Options: ${item.options.map((option) => option.text).join(" | ")}`,
    ].join("\n");
  }
  if (item.type === "explain") {
    return [`Skills: ${skills}`, `Reading: ${item.prompt}`, item.body].join("\n");
  }
  if (item.type === "worked_example") {
    return [
      `Skills: ${skills}`,
      `Worked example: ${item.prompt}`,
      ...item.steps.map((step) => `${step.title}: ${step.body}`),
    ].join("\n");
  }
  if (item.type === "lab") {
    return [`Skills: ${skills}`, `Lab: ${item.prompt}`].join("\n");
  }
  return [`Skills: ${skills}`, `Task: ${item.prompt}`].join("\n");
}

export function hintPrompt(
  item: Item,
  pack: ContentPack
): { system: string; prompt: string } {
  return {
    system:
      "You are Cairn, a concise tutor. Give one short hint in at most two sentences. Do not reveal the answer. Use plain language.",
    prompt: [
      itemContext(item, pack).slice(0, 2400),
      "Give one hint that helps the learner think. Do not give the answer.",
    ].join("\n\n"),
  };
}

export function feedbackPrompt(
  item: Item,
  pack: ContentPack,
  answer: string,
  correct: boolean | undefined
): { system: string; prompt: string } {
  return {
    system:
      "You are Cairn, a concise tutor. Give feedback in at most three short sentences. Do not invent facts.",
    prompt: [
      itemContext(item, pack).slice(0, 2400),
      `Learner answer: ${answer || "(no text answer)"}`,
      `Marked: ${
        correct === undefined ? "self-assessed" : correct ? "correct" : "incorrect"
      }`,
      "Give one specific next step or correction.",
    ].join("\n\n"),
  };
}
