/** Cloze deletion: {{c1::answer}} syntax. Parse + render helpers. */
import type { ReactNode } from "react";

const CLOZE_RE = /\{\{c\d+::([^}:]+?)(?:::([^}]+?))?\}\}/g;

export interface ClozePart {
  text: string;
  hidden: boolean;
}

/** Split text into plain/hidden parts. Handles {{c1::answer}} and {{c1::answer::hint}}. */
export function parseCloze(s: string): ClozePart[] {
  const parts: ClozePart[] = [];
  const re = new RegExp(CLOZE_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push({ text: s.slice(last, m.index), hidden: false });
    parts.push({ text: (m[1] ?? "").trim(), hidden: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ text: s.slice(last), hidden: false });
  if (parts.length === 0) parts.push({ text: s, hidden: false });
  return parts;
}

export function hasCloze(s: string): boolean {
  return /\{\{c\d+::/.test(s);
}

/** Strip cloze markup, keeping the answers (for backs / exports). */
export function stripCloze(s: string): string {
  return s.replace(/\{\{c\d+::([^}:]+?)(?:::([^}]+?))?\}\}/g, "$1");
}

/**
 * Render text with cloze parts. Hidden + unrevealed -> blank _____.
 * Hidden + revealed -> highlighted answer.
 */
export function ClozeText({ text, revealed }: { text: string; revealed: boolean }): ReactNode {
  const parts = parseCloze(text);
  return (
    <>
      {parts.map((p, i) =>
        p.hidden ? (
          revealed ? (
            <span key={i} className="rounded bg-peach px-1 font-extrabold">
              {p.text}
            </span>
          ) : (
            <span
              key={i}
              className="mx-1 inline-block min-w-[3.5rem] border-b-[3px] border-dashed border-muted/60 text-center font-extrabold text-muted/60"
            >
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            </span>
          )
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
