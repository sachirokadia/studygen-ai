import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import clsx from "clsx";
import { api, ApiError, type ChatMsg, type Deck } from "../lib/api";
import { useLang } from "../lib/i18n";
import { AiNotice, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, TextInput } from "../components/ui";
import { Markdown } from "./Explain";

export default function Chat() {
  const { t } = useLang();
  const [deckId, setDeckId] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [aiMissing, setAiMissing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const decksQ = useQuery({ queryKey: ["decks"], queryFn: () => api.get<Deck[]>("/decks") });

  const chatMut = useMutation({
    mutationFn: (msgs: ChatMsg[]) =>
      api.post<{ reply: string }>("/ai/chat", { deckId: deckId || undefined, messages: msgs }),
    onSuccess: (res, msgs) => {
      setMessages([...msgs, { role: "assistant", content: res.reply }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 503) {
        setAiMissing(true);
        setMessages((m) => m.slice(0, -1));
      }
    },
  });

  const send = () => {
    const text = input.trim();
    if (!text || chatMut.isPending) return;
    setAiMissing(false);
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    chatMut.mutate(next);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col" style={{ height: "calc(100vh - 12rem)" }}>
      <PageHeader
        title={t("chat.title")}
        action={
          decksQ.data ? (
            <select value={deckId} onChange={(e) => setDeckId(e.target.value)} className="input !w-auto text-sm">
              <option value="">{t("chat.selectDeck")}</option>
              {decksQ.data.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      <Card className="flex flex-1 flex-col overflow-hidden !p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <EmptyState title={t("common.empty")} hint={t("chat.placeholder")} />
          )}
          {messages.map((m, i) => (
            <div key={i} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={clsx(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                  m.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800",
                )}
              >
                {m.role === "assistant" ? <Markdown text={m.content} /> : m.content}
              </div>
            </div>
          ))}
          {chatMut.isPending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500">
                <LoadingState label={t("common.loading")} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-slate-100 p-3">
          {aiMissing && (
            <div className="mb-3">
              <AiNotice message={t("common.aiNotConfigured")} />
            </div>
          )}
          {decksQ.isError && <ErrorState message={t("common.error")} />}
          <div className="flex gap-2">
            <TextInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("chat.placeholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button onClick={send} disabled={chatMut.isPending || !input.trim()} aria-label={t("btn.send")}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
