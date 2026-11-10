import { describe, expect, it } from "vitest";
import { validatePack, type ContentPack } from "@cairn/content";

import { buildLearnpack } from "../src/authoring";
import { readPackFile } from "../src/packs";
import { validPack } from "../../../packages/content/test/fixtures";

const pack = validatePack(validPack).pack as ContentPack;

describe("learnpack export and import", () => {
  it("writes the required archive files", async () => {
    const blob = await buildLearnpack(pack);
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    for (const name of [
      "manifest.json",
      "curriculum.json",
      "items.json",
      "rubrics.json",
      "misconceptions.json",
      "labs.json",
      "policy.json",
      "LICENSE",
      "CHANGELOG.md",
    ]) {
      expect(zip.file(name), name).toBeTruthy();
    }
  });

  it("round-trips through a .learnpack file", async () => {
    const blob = await buildLearnpack(pack);
    const file = new File([await blob.arrayBuffer()], "test.learnpack", {
      type: "application/zip",
    });
    const imported = await readPackFile(file);
    expect(imported.manifest.id).toBe(pack.manifest.id);
    expect(imported.items).toHaveLength(pack.items.length);
  });
});
