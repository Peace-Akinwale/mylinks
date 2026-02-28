import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";
import type { PageType } from "@/lib/types/database";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface InventoryPage {
  url: string;
  title: string | null;
  h1: string | null;
  h2s: string[] | null;
  meta_description: string | null;
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
    .map((p, i) => {
      const h2List = p.h2s?.length ? p.h2s.slice(0, 5).join(" | ") : null;
      return [
        `${i + 1}. URL: ${p.url}`,
        `   Title: ${p.title ?? "N/A"}`,
        `   H1: ${p.h1 ?? "N/A"}`,
        h2List ? `   H2s: ${h2List}` : null,
        p.meta_description ? `   Description: ${p.meta_description}` : null,
        `   Type: ${p.page_type} (priority ${p.priority})`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return `You are an expert SEO internal linking specialist. Your task is to suggest 3–8 high-quality internal links for the given article draft, using only URLs from the provided site inventory.

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
- Prefer high-priority pages (blog_post, service, product, landing) over low-priority ones.
- Only use anchor text that exists verbatim in the draft.
- Do not suggest links if relevance_score < 0.6.

Return JSON matching the schema.`;
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
        const slice = draft.slice(s.char_start, s.char_end);
        if (slice === s.anchor_text) {
          validated.push(s);
        } else {
          // Try to auto-correct by searching for anchor_text
          const idx = draft.indexOf(s.anchor_text);
          if (idx !== -1) {
            validated.push({
              ...s,
              char_start: idx,
              char_end: idx + s.anchor_text.length,
            });
          }
          // If not found at all, drop this suggestion
        }
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
