import { STARTER_PACK } from "./authoring";

export interface MaterialSection {
  heading: string;
  body: string;
}

export interface ExtractedMaterial {
  title: string;
  sourceName: string;
  sections: MaterialSection[];
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function titleFromName(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "imported-material"
  );
}

function markdownSections(text: string, fallbackTitle: string): MaterialSection[] {
  const sections: MaterialSection[] = [];
  let heading = fallbackTitle;
  let lines: string[] = [];

  const push = () => {
    const body = cleanText(lines.join("\n"));
    if (body) sections.push({ heading, body });
    lines = [];
  };

  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (match) {
      push();
      heading = match[2].trim();
    } else {
      lines.push(line);
    }
  }
  push();
  return sections;
}

function sectionsFromHtml(html: string, fallbackTitle: string): MaterialSection[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sections: MaterialSection[] = [];
  let heading = fallbackTitle;
  let blocks: string[] = [];

  const push = () => {
    const body = cleanText(blocks.join("\n\n"));
    if (body) sections.push({ heading, body });
    blocks = [];
  };

  for (const node of doc.body.querySelectorAll(
    "h1,h2,h3,h4,h5,h6,p,li,pre,blockquote"
  )) {
    const text = (node.textContent ?? "").trim();
    if (!text) continue;
    if (/^H[1-6]$/.test(node.tagName)) {
      push();
      heading = text;
      continue;
    }
    blocks.push(node.tagName === "LI" ? `- ${text}` : text);
  }
  push();

  if (sections.length === 0) {
    const body = cleanText(doc.body.textContent ?? "");
    if (body) sections.push({ heading: fallbackTitle, body });
  }
  return sections;
}

async function docxSections(file: File, title: string): Promise<MaterialSection[]> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.convertToHtml({
    arrayBuffer: await file.arrayBuffer(),
  });
  return sectionsFromHtml(result.value, title);
}

function joinPath(base: string, href: string): string {
  const parts = `${base}/${href}`.split("/");
  const output: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") output.pop();
    else output.push(part);
  }
  return output.join("/");
}

async function epubSections(
  file: File,
  fallbackTitle: string
): Promise<{ title: string; sections: MaterialSection[] }> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const containerEntry = zip.file("META-INF/container.xml");
  const container = containerEntry
    ? new DOMParser().parseFromString(
        await containerEntry.async("text"),
        "application/xml"
      )
    : null;
  const rootfile = container?.getElementsByTagName("rootfile")[0];
  let opfPath = rootfile?.getAttribute("full-path") ?? "";
  if (!opfPath) {
    opfPath =
      Object.keys(zip.files).find((name) => name.endsWith(".opf")) ?? "";
  }
  if (!opfPath) throw new Error("EPUB has no package document.");
  const opfEntry = zip.file(opfPath);
  if (!opfEntry) throw new Error("EPUB package document is missing.");
  const opf = new DOMParser().parseFromString(
    await opfEntry.async("text"),
    "application/xml"
  );
  const title =
    opf.getElementsByTagName("dc:title")[0]?.textContent?.trim() ||
    opf.getElementsByTagName("title")[0]?.textContent?.trim() ||
    fallbackTitle;
  const base = opfPath.split("/").slice(0, -1).join("/");
  const manifest = new Map<string, string>();
  for (const item of opf.getElementsByTagName("item")) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest.set(id, joinPath(base, href));
  }

  const sections: MaterialSection[] = [];
  for (const itemref of opf.getElementsByTagName("itemref")) {
    const id = itemref.getAttribute("idref");
    const path = id ? manifest.get(id) : undefined;
    if (!path) continue;
    const entry = zip.file(path) ?? zip.file(decodeURIComponent(path));
    if (!entry) continue;
    sections.push(
      ...sectionsFromHtml(await entry.async("text"), title)
    );
  }
  return { title, sections };
}

async function pdfSections(file: File, title: string): Promise<MaterialSection[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const document = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  const sections: MaterialSection[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    const body = cleanText(text);
    if (body) {
      sections.push({ heading: `${title} · page ${pageNumber}`, body });
    }
  }
  return sections;
}

export async function extractMaterial(file: File): Promise<ExtractedMaterial> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const title = titleFromName(file.name);

  if (extension === "md" || extension === "markdown") {
    return {
      title,
      sourceName: file.name,
      sections: markdownSections(await file.text(), title),
    };
  }

  if (extension === "html" || extension === "htm") {
    return {
      title,
      sourceName: file.name,
      sections: sectionsFromHtml(await file.text(), title),
    };
  }

  if (extension === "docx") {
    return {
      title,
      sourceName: file.name,
      sections: await docxSections(file, title),
    };
  }

  if (extension === "epub") {
    const epub = await epubSections(file, title);
    return {
      title: epub.title,
      sourceName: file.name,
      sections: epub.sections,
    };
  }

  if (extension === "pdf") {
    return {
      title,
      sourceName: file.name,
      sections: await pdfSections(file, title),
    };
  }

  throw new Error(`Unsupported material type: .${extension || "unknown"}`);
}

export function packFromMaterial(material: ExtractedMaterial): unknown {
  const sections = material.sections
    .filter((section) => section.body.trim())
    .slice(0, 40);
  if (sections.length === 0) {
    throw new Error("No readable text was found in this file.");
  }

  const title = material.title || titleFromName(material.sourceName);
  const id = `imported-${slugify(title)}`;
  const skillId = "imported-material";
  const words = sections.reduce(
    (sum, section) => sum + section.body.split(/\s+/).filter(Boolean).length,
    0
  );
  const items: any[] = sections.map((section, index) => ({
    id: `section-${index + 1}`,
    type: "explain",
    skillIds: [skillId],
    difficulty: 2,
    prompt: section.heading || `Section ${index + 1}`,
    body: section.body.slice(0, 12000),
    hints: [],
    estimatedSeconds: Math.max(
      60,
      Math.round(section.body.split(/\s+/).filter(Boolean).length / 3)
    ),
  }));
  items.push({
    id: "imported-reflection",
    type: "reflection",
    skillIds: [skillId],
    difficulty: 2,
    prompt: "Reflect on the material",
    prompts: [
      "What was the main idea?",
      "What is still unclear?",
      "How would you explain it to someone else?",
    ],
    hints: [],
  });

  return {
    manifest: {
      schemaVersion: "0.1",
      id,
      version: "0.1.0",
      title,
      description: `Draft pack imported from ${material.sourceName}. Add practice items before using it.`,
      author: { name: "You" },
      license: "CC-BY-4.0",
      language: "en",
      audience: "adult-self-learner",
      level: "beginner",
      estimatedMinutes: Math.max(10, Math.round(words / 200)),
      engine: { minVersion: "0.1.0" },
      requires: { ai: false, docker: false, appNetwork: false },
      entries: {
        curriculum: "curriculum.json",
        items: "items.json",
        rubrics: "rubrics.json",
        misconceptions: "misconceptions.json",
        labs: "labs.json",
        policy: "policy.json",
      },
    },
    curriculum: {
      modules: [
        {
          id: "imported",
          title: "Imported material",
          order: 1,
          skillIds: [skillId],
        },
      ],
      skills: [
        {
          id: skillId,
          title,
          description: `Imported from ${material.sourceName}.`,
          prerequisites: [],
          difficulty: 2,
          masteryThreshold: 0.9,
          tags: ["imported"],
        },
      ],
    },
    items,
    rubrics: [],
    misconceptions: [],
    labs: [],
    policy: structuredClone(STARTER_PACK.policy),
  };
}
