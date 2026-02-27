interface DocContent {
  text: string;
  /** Map from character offset in plain text to Google Doc index */
  charToDocIndex: Map<number, number>;
  /** Total Google Doc content length */
  docLength: number;
}

interface DocParagraphElement {
  textRun?: {
    content: string;
    textStyle?: Record<string, unknown>;
  };
  startIndex?: number;
  endIndex?: number;
}

interface DocParagraph {
  elements?: DocParagraphElement[];
}

interface DocStructuralElement {
  paragraph?: DocParagraph;
  startIndex?: number;
  endIndex?: number;
}

interface GoogleDoc {
  body?: {
    content?: DocStructuralElement[];
  };
}

export function extractDocContent(doc: GoogleDoc): DocContent {
  const body = doc.body?.content ?? [];
  let plainText = "";
  // Map: plain-text char index → google doc index
  const charToDocIndex = new Map<number, number>();

  for (const element of body) {
    if (!element.paragraph) continue;
    for (const el of element.paragraph.elements ?? []) {
      if (!el.textRun?.content) continue;
      const content = el.textRun.content;
      const docStart = el.startIndex ?? 0;

      for (let i = 0; i < content.length; i++) {
        charToDocIndex.set(plainText.length + i, docStart + i);
      }
      plainText += content;
    }
  }

  return {
    text: plainText,
    charToDocIndex,
    docLength: plainText.length,
  };
}

export interface LinkPatch {
  char_start: number;
  char_end: number;
  url: string;
}

export interface BatchUpdateRequest {
  updateTextStyle: {
    range: { startIndex: number; endIndex: number };
    textStyle: { link: { url: string } };
    fields: string;
  };
}

export function buildBatchUpdateRequests(
  patches: LinkPatch[],
  charToDocIndex: Map<number, number>
): BatchUpdateRequest[] {
  const requests: BatchUpdateRequest[] = [];

  // Process in reverse order to preserve indices
  const sorted = [...patches].sort((a, b) => b.char_start - a.char_start);

  for (const patch of sorted) {
    const docStart = charToDocIndex.get(patch.char_start);
    const docEnd = charToDocIndex.get(patch.char_end);

    if (docStart === undefined || docEnd === undefined) continue;

    requests.push({
      updateTextStyle: {
        range: { startIndex: docStart, endIndex: docEnd },
        textStyle: { link: { url: patch.url } },
        fields: "link",
      },
    });
  }

  return requests;
}

export function extractDocIdFromUrl(input: string): string {
  // Handle full URL: https://docs.google.com/document/d/DOC_ID/edit
  const match = input.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Already a doc ID
  return input.trim();
}
