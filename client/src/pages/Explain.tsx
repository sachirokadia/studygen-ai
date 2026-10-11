import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "../lib/api";
import { useLang } from "../lib/i18n";
import { AiNotice, Button, Field, HangTag, PageBg, TextInput } from "../components/ui";
import Creature from "../components/creatures";

type Level = "eli5" | "simple" | "detailed";

/** Minimal markdown renderer: headings, bold, bullets, numbered lists, paragraphs. */
function renderMarkdown(md: string): ReactNode[] {
  const lines = md.split("\n");
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  let ordered: ReactNode[] = [];

  const flushLists = () => {
    if (list.length > 0) {
      out.push(
        <ul key={`ul-${out.length}`} className="mb-3 list-disc space-y-1 pl-6 font-body text-sm font-semibold text-ink/80">
          {list}
        </ul>,
      );
      list = [];
    }
    if (ordered.length > 0) {
      out.push(
        <ol key={`ol-${out.length}`} className="mb-3 list-decimal space-y-1 pl-6 font-body text-sm font-semibold text-ink/80">
          {ordered}
        </ol>,
      );
      ordered = [];
    }
  };

  const flushOrderedOnly = () => {
    if (ordered.length > 0) {
      out.push(
        <ol key={`ol-${out.length}`} className="mb-3 list-decimal space-y-1 pl-6 font-body text-sm font-semibold text-ink/80">
          {ordered}
        </ol>,
      );
      ordered = [];
    }
  };

  const flushListOnly = () => {
    if (list.length > 0) {
      out.push(
        <ul key={`ul-${out.length}`} className="mb-3 list-disc space-y-1 pl-6 font-body text-sm font-semibold text-ink/80">
          {list}
        </ul>,
      );
      list = [];
    }
  };

  const inline = (text: string, key: string): ReactNode => {
    // **bold**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={key}>
        {parts.map((p, i) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <strong key={i}>{p.slice(2, -2)}</strong>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
      </span>
    );
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("### ")) {
      flushLists();
      out.push(<h4 key={i} className="mb-1 mt-4 font-display text-xl font-extrabold uppercase text-ink">{inline(trimmed.slice(4), `h${i}`)}</h4>);
    } else if (trimmed.startsWith("## ")) {
      flushLists();
      out.push(<h3 key={i} className="mb-1 mt-4 font-display text-2xl font-extrabold uppercase text-ink">{inline(trimmed.slice(3), `h${i}`)}</h3>);
    } else if (trimmed.startsWith("# ")) {
      flushLists();
      out.push(<h2 key={i} className="mb-2 mt-4 font-display text-3xl font-extrabold uppercase text-ink">{inline(trimmed.slice(2), `h${i}`)}</h2>);
    } else if (/^[-*] /.test(trimmed)) {
      flushOrderedOnly();
      list.push(<li key={i}>{inline(trimmed.slice(2), `li${i}`)}</li>);
    } else if (/^\d+\. /.test(trimmed)) {
      flushListOnly();
      ordered.push(<li key={i}>{inline(trimmed.replace(/^\d+\. /, ""), `li${i}`)}</li>);
    } else if (trimmed === "") {
      flushLists();
    } else {
      flushLists();
      out.push(<p key={i} className="mb-2 font-body text-sm font-semibold leading-relaxed text-ink/80">{inline(trimmed, `p${i}`)}</p>);
    }
  });
  flushLists();
  return out;
}

export function Markdown({ text }: { text: string }) {
  return <div>{renderMarkdown(text)}</div>;
}

const LEVEL_COLORS: Record<Level, string> = { eli5: "bg-sunny", simple: "bg-sky", detailed: "bg-blush" };

export default function Explain() {
  const { t } = useLang();
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<Level>("simple");
  const [aiMissing, setAiMissing] = useState(false);

  const explainMut = useMutation({
    mutationFn: () => api.post<{ explanation: string }>("/ai/explain", { topic: topic.trim(), level }),
    onError: (err) => {
      if (err instanceof ApiError && err.status === 503) setAiMissing(true);
    },
  });

  const levels: { id: Level; label: string }[] = [
    { id: "eli5", label: t("explain.eli5") },
    { id: "simple", label: t("explain.simple") },
    { id: "detailed", label: t("explain.detailed") },
  ];

  return (
    <div>
      <PageBg variant="sky" />
      <div className="paper-card washi relative mx-auto max-w-2xl p-6 pt-7">
        <div className="mb-4 flex items-center gap-4">
          <Creature kind="chick" size={88} className="animate-bob" />
          <h1 className="title-chunky">{t("explain.title")}</h1>
        </div>
        <div className="space-y-4">
          <Field label={t("explain.topic")}>
            <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("explain.topicPh")} />
          </Field>
          <Field label={t("explain.level")}>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("explain.level")}>
              {levels.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLevel(l.id)}
                  aria-pressed={level === l.id}
                  className={clsx(
                    "pill cursor-pointer transition",
                    LEVEL_COLORS[l.id],
                    level === l.id ? "shadow-chunky" : "opacity-70 hover:opacity-100",
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </Field>
          <Button
            variant="blue"
            onClick={() => { setAiMissing(false); explainMut.mutate(); }}
            disabled={explainMut.isPending || !topic.trim()}
            className="w-full"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.75} />
            {explainMut.isPending ? t("common.loading") : t("explain.explainBtn")}
          </Button>
          {aiMissing && (
            <div className="mt-4">
              <AiNotice message={t("common.aiNotConfigured")} />
            </div>
          )}
          {explainMut.isError && !aiMissing && <p className="mt-3 font-body text-sm font-bold text-red-700">{t("common.error")}</p>}
        </div>
      </div>

      {explainMut.data && (
        <div className="paper-card washi relative mx-auto mt-6 max-h-[60vh] max-w-2xl overflow-y-auto p-6 pt-7">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <HangTag color={LEVEL_COLORS[level]}>
              {levels.find((l) => l.id === level)?.label}
            </HangTag>
            <span className="font-display text-xl font-extrabold uppercase text-ink/60">{topic.trim()}</span>
          </div>
          <Markdown text={explainMut.data.explanation} />
        </div>
      )}
    </div>
  );
}
