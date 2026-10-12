import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import clsx from "clsx";
import { api, ApiError, type ChatMsg, type Deck } from "../lib/api";
import { useLang } from "../lib/i18n";
import { AiNotice, Button, Card, EmptyState, ErrorState, PageBg, Spinner, TextInput } from "../components/ui";
import Creature, { OrangeBlob } from "../components/creatures";
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
    <div>
      <PageBg variant="sky" />
      <div className="mx-auto flex max-w-3xl flex-col" style={{ height: "calc(100vh - 12rem)" }}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Creature kind="orange" size={56} className="animate-float" />
            <h1 className="text-[26px] font-extrabold tracking-tight text-ink">{t("chat.title")}</h1>
          </div>
          {decksQ.data ? (
            <label className="chip !py-2.5">
              <select
                value={deckId}
                onChange={(e) => setDeckId(e.target.value)}
                className="max-w-[180px] cursor-pointer bg-transparent text-sm font-extrabold text-ink outline-none"
                aria-label={t("chat.selectDeck")}
              >
                <option value="">{t("chat.selectDeck")}</option>
                {decksQ.data.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined}
        </div>

        <Card className="flex flex-1 flex-col overflow-hidden !p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <EmptyState title={t("common.empty")} hint={t("chat.placeholder")} />
            )}
            {messages.map((m, i) => (
              <div key={i} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" ? (
                  <div className="mr-auto flex max-w-[85%] items-start gap-2">
                    <OrangeBlob size={36} className="mt-1 shrink-0 animate-float" />
                    <div className="card rounded-2xl rounded-tl-md p-3.5">
                      <Markdown text={m.content} />
                    </div>
                  </div>
                ) : (
                  <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-peach p-3.5">
                    <p className="text-sm font-semibold text-ink">{m.content}</p>
                  </div>
                )}
              </div>
            ))}
            {chatMut.isPending && (
              <div className="flex justify-start">
                <div className="card mr-auto rounded-2xl rounded-tl-md p-3.5">
                  <span className="flex items-center gap-2">
                    <Spinner className="h-5 w-5" />
                    <span className="text-sm font-bold text-muted">{t("common.loading")}</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-[#ECECF1] p-3">
            {aiMissing && (
              <div className="mb-3">
                <AiNotice message={t("common.aiNotConfigured")} />
              </div>
            )}
            {decksQ.isError && <ErrorState message={t("common.error")} />}
            <div className="flex items-center gap-2">
              <TextInput
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("chat.placeholder")}
                className="!rounded-full !py-3.5"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Button
                variant="accent"
                onClick={send}
                disabled={chatMut.isPending || !input.trim()}
                aria-label={t("btn.send")}
                className="shrink-0 !h-[52px] !w-[52px] !rounded-full !p-0"
              >
                <Send className="h-5 w-5" strokeWidth={2.75} />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
