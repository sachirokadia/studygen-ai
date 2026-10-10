import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useLang } from "../lib/i18n";
import { AiNotice, Button, Card, Field, PageHeader, TextInput } from "../components/ui";

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
        <ul key={`ul-${out.length}`} className="mb-3 list-disc space-y-1 pl-6">
          {list}
        </ul>,
      );
      list = [];
    }
    if (ordered.length > 0) {
      out.push(
        <ol key={`ol-${out.length}`} className="mb-3 list-decimal space-y-1 pl-6">
          {ordered}
        </ol>,
      );
      ordered = [];
    }
  };

  const flushOrderedOnly = () => {
    if (ordered.length > 0) {
      out.push(
        <ol key={`ol-${out.length}`} className="mb-3 list-decimal space-y-1 pl-6">
          {ordered}
        </ol>,
      );
      ordered = [];
    }
  };

  const flushListOnly = () => {
    if (list.length > 0) {
      out.push(
        <ul key={`ul-${out.length}`} className="mb-3 list-disc space-y-1 pl-6">
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
      out.push(<h4 key={i} className="mb-1 mt-4 text-base font-semibold">{inline(trimmed.slice(4), `h${i}`)}</h4>);
    } else if (trimmed.startsWith("## ")) {
      flushLists();
      out.push(<h3 key={i} className="mb-1 mt-4 text-lg font-semibold">{inline(trimmed.slice(3), `h${i}`)}</h3>);
    } else if (trimmed.startsWith("# ")) {
      flushLists();
      out.push(<h2 key={i} className="mb-2 mt-4 text-xl font-bold">{inline(trimmed.slice(2), `h${i}`)}</h2>);
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
      out.push(<p key={i} className="mb-2 text-sm leading-relaxed text-slate-700">{inline(trimmed, `p${i}`)}</p>);
    }
  });
  flushLists();
  return out;
}

export function Markdown({ text }: { text: string }) {
  return <div>{renderMarkdown(text)}</div>;
}

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
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("explain.title")} />
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Field label={t("explain.topic")}>
              <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("explain.topicPh")} />
            </Field>
          </div>
          <div>
            <Field label={t("explain.level")}>
              <select value={level} onChange={(e) => setLevel(e.target.value as Level)} className="input">
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <Button onClick={() => { setAiMissing(false); explainMut.mutate(); }} disabled={explainMut.isPending || !topic.trim()} className="mt-4 w-full sm:w-auto">
          <Sparkles className="h-4 w-4" />
          {explainMut.isPending ? t("common.loading") : t("explain.explainBtn")}
        </Button>
        {aiMissing && (
          <div className="mt-4">
            <AiNotice message={t("common.aiNotConfigured")} />
          </div>
        )}
        {explainMut.isError && !aiMissing && <p className="mt-3 text-sm text-red-600">{t("common.error")}</p>}
      </Card>

      {explainMut.data && (
        <Card className="mt-4">
          <Markdown text={explainMut.data.explanation} />
        </Card>
      )}
    </div>
  );
}
