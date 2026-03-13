import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";
import type { PageType } from "@/lib/types/database";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface InventoryPage {
  url: string;
  title: string | null;
  h1: string | null;
  page_type: PageType;
  priority: number;
}

export const SuggestionSchema = z.object({
  target_url: z.string().url(),
  anchor_text: z.string().min(1).max(200),
  anchor_refinement: z.string().nullable().optional(),
  relevance_score: z.number().min(0).max(1),
  confidence: z.enum(["low", "medium", "high"]),
  paragraph_index: z.number().int().min(0),
  sentence_index: z.number().int().min(0),
  char_start: z.number().int().min(0),
  char_end: z.number().int().min(0),
  justification: z.string().min(10),
});

export type Suggestion = z.infer<typeof SuggestionSchema>;

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    suggestions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          target_url: { type: SchemaType.STRING },
          anchor_text: { type: SchemaType.STRING },
          anchor_refinement: { type: SchemaType.STRING },
          relevance_score: { type: SchemaType.NUMBER },
          confidence: { type: SchemaType.STRING },
          paragraph_index: { type: SchemaType.NUMBER },
          sentence_index: { type: SchemaType.NUMBER },
          char_start: { type: SchemaType.NUMBER },
          char_end: { type: SchemaType.NUMBER },
          justification: { type: SchemaType.STRING },
        },
        required: [
          "target_url",
          "anchor_text",
          "relevance_score",
          "confidence",
          "paragraph_index",
          "sentence_index",
          "char_start",
          "char_end",
          "justification",
        ],
      },
    },
  },
  required: ["suggestions"],
};

function buildPrompt(draft: string, inventory: InventoryPage[]): string {
  const inventoryLines = inventory
    .map((p, i) =>
      [
        `${i + 1}. URL: ${p.url}`,
        `   Title: ${p.title ?? "N/A"}`,
        `   H1: ${p.h1 ?? "N/A"}`,
        `   Type: ${p.page_type} (priority ${p.priority})`,
      ].join("\n")
    )
    .join("\n\n");

  return `You are an expert SEO internal linking specialist. Your task is to suggest as many high-quality internal links as naturally fit the article (aim for 8–15), using only URLs from the provided site inventory. Suggest fewer only if the article genuinely lacks enough relevant anchor opportunities.

## ARTICLE DRAFT
${draft}

## SITE INVENTORY (${inventory.length} pages)
${inventoryLines}

## INSTRUCTIONS
For each suggestion:
1. Find a phrase in the draft that naturally anchors to the target URL — the phrase must appear verbatim in the draft.
2. Provide exact character positions (char_start, char_end) within the full draft string (0-indexed). The substring draft[char_start:char_end] MUST equal the anchor_text exactly.
3. Provide paragraph_index (0-based) and sentence_index (0-based within paragraph) for context.
4. Score relevance_score from 0.0 to 1.0 (only suggest if >= 0.6).
5. Set confidence: "high" if exact topical match, "medium" if partial match, "low" if loose.
6. anchor_refinement: if the natural phrase could be slightly improved for SEO, suggest a better version (otherwise omit).
7. justification: 1–2 sentences explaining WHY this link is valuable for readers and SEO.

## RULES
- Never suggest the same URL twice (no duplicates).
- Never link to the article's own URL.
- NEVER use headings (H1, H2, H3, H4) as anchor text. Headings are lines that start with "#", "##", "###", or are short standalone title-like lines (e.g. all caps, numbered section titles like "1. Do X", "What You Need to Know"). Always pick anchor text from body paragraphs, not section headings.
- Prefer high-priority pages (blog_post, service, product, landing) over low-priority ones.
- Only use anchor text that exists verbatim in the draft.
- Do not suggest links if relevance_score < 0.6.

Return JSON matching the schema.`;
}

/** Check if a character position falls on a heading-like line */
function isHeadingLine(text: string, charPos: number): boolean {
  // Find the start of the line containing charPos
  const lineStart = text.lastIndexOf("\n", charPos - 1) + 1;
  const lineEnd = text.indexOf("\n", charPos);
  const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();

  // Markdown headings
  if (/^#{1,4}\s/.test(line)) return true;

  // Short standalone title-like lines (numbered sections, all-caps, etc.)
  if (
    line.length < 100 &&
    line.length > 0 &&
    (
      /^\d+\.\s+[A-Z]/.test(line) || // "1. Section Title"
      line === line.toUpperCase()     // "ALL CAPS HEADING"
    ) &&
    !line.includes(". ") // exclude normal sentences with periods mid-line
  ) {
    return true;
  }

  return false;
}

export async function getSuggestions(
  draft: string,
  inventory: InventoryPage[]
): Promise<Suggestion[]> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.2,
    },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const prompt = buildPrompt(draft, inventory);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      const raw = JSON.parse(text);
      const parsed = z
        .object({ suggestions: z.array(SuggestionSchema) })
        .parse(raw);

      // Post-validate: verify anchor_text matches draft at char positions
      const validated: Suggestion[] = [];
      for (const s of parsed.suggestions) {
        let start = s.char_start;
        let end = s.char_end;
        const slice = draft.slice(start, end);
        if (slice !== s.anchor_text) {
          // Try to auto-correct by searching for anchor_text
          const idx = draft.indexOf(s.anchor_text);
          if (idx === -1) continue; // Not found, drop
          start = idx;
          end = idx + s.anchor_text.length;
        }

        // Skip if anchor text is inside a heading line
        if (isHeadingLine(draft, start)) continue;

        validated.push({ ...s, char_start: start, char_end: end });
      }

      // Deduplicate by target_url
      const seen = new Set<string>();
      return validated.filter((s) => {
        if (seen.has(s.target_url)) return false;
        seen.add(s.target_url);
        return true;
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Brief backoff before retry
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error("Gemini suggestion failed after 2 attempts");
}

function buildExternalPrompt(draft: string): string {
  return `You are an expert SEO specialist. Your task is to suggest relevant EXTERNAL links for an article. These are outbound links to reputable third-party sources that add value for readers — tools, studies, industry blogs, well-known companies, or any credible site directly relevant to the content.

## ARTICLE DRAFT
${draft}

## INSTRUCTIONS
For each suggestion:
1. Find a phrase in the draft that would benefit from an external link — the phrase must appear verbatim in the draft.
2. Suggest a real, relevant external URL that the reader would genuinely find useful (e.g. the homepage of a tool mentioned, a study backing a claim, a well-known industry blog post, a company site referenced in the article).
3. Provide exact character positions (char_start, char_end) within the full draft string (0-indexed). The substring draft[char_start:char_end] MUST equal the anchor_text exactly.
4. Provide paragraph_index (0-based) and sentence_index (0-based within paragraph) for context.
5. Score relevance_score from 0.0 to 1.0 (only suggest if >= 0.7).
6. Set confidence: "high" if it's the obvious best source, "medium" if it's a strong fit, "low" if it's a reasonable option.
7. justification: 1–2 sentences explaining WHY this external link adds value for the reader.

## RULES
- Prioritise relevance over domain authority — a niche tool's homepage beats a generic Wikipedia article.
- Only suggest real, working URLs for sites that actually exist.
- NEVER use headings (H1, H2, H3, H4) as anchor text. Pick anchor text from body paragraphs only.
- Never suggest the same URL twice.
- Aim for 3–8 external links depending on how many natural opportunities exist.
- Only use anchor text that exists verbatim in the draft.
- Do not suggest links if relevance_score < 0.7.

Return JSON matching the schema.`;
}

export async function getExternalSuggestions(
  draft: string
): Promise<Suggestion[]> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.3,
    },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const prompt = buildExternalPrompt(draft);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      const raw = JSON.parse(text);
      const parsed = z
        .object({ suggestions: z.array(SuggestionSchema) })
        .parse(raw);

      const validated: Suggestion[] = [];
      for (const s of parsed.suggestions) {
        let start = s.char_start;
        let end = s.char_end;
        const slice = draft.slice(start, end);
        if (slice !== s.anchor_text) {
          const idx = draft.indexOf(s.anchor_text);
          if (idx === -1) continue;
          start = idx;
          end = idx + s.anchor_text.length;
        }
        if (isHeadingLine(draft, start)) continue;
        validated.push({ ...s, char_start: start, char_end: end });
      }

      const seen = new Set<string>();
      return validated.filter((s) => {
        if (seen.has(s.target_url)) return false;
        seen.add(s.target_url);
        return true;
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error("External suggestions failed after 2 attempts");
}
