import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Circle, Loader, Plus } from "lucide-react";
import clsx from "clsx";
import { api, type LearningPath, type PathTopic, type TopicStatus } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, Field, LoadingState, Modal, PageBg, PageHeader, Pill, TextArea, TextInput } from "../components/ui";
import Creature from "../components/creatures";

const STATUS_CYCLE: Record<TopicStatus, TopicStatus> = { todo: "doing", doing: "done", done: "todo" };

const STATUS_META: Record<TopicStatus, { icon: typeof Circle; nodeBg: string; key: "paths.todo" | "paths.doing" | "paths.done" }> = {
  todo: { icon: Circle, nodeBg: "bg-white", key: "paths.todo" },
  doing: { icon: Loader, nodeBg: "bg-butter", key: "paths.doing" },
  done: { icon: CheckCircle2, nodeBg: "bg-mint", key: "paths.done" },
};

export default function PathDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicDesc, setTopicDesc] = useState("");

  const pathQ = useQuery({ queryKey: ["path", id], queryFn: () => api.get<LearningPath>(`/paths/${id}`), enabled: !!id });

  const addTopicMut = useMutation({
    mutationFn: () =>
      api.post<PathTopic>(`/paths/${id}/topics`, { title: topicTitle.trim(), description: topicDesc.trim() || undefined }),
    onSuccess: () => {
      setModalOpen(false);
      setTopicTitle("");
      setTopicDesc("");
      queryClient.invalidateQueries({ queryKey: ["path", id] });
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ topicId, status }: { topicId: string; status: TopicStatus }) =>
      api.patch<PathTopic>(`/paths/topics/${topicId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["path", id] }),
  });

  if (pathQ.isLoading) return <LoadingState label={t("common.loading")} />;
  if (pathQ.isError)
    return <ErrorState message={t("common.error")} onRetry={() => pathQ.refetch()} retryLabel={t("common.retry")} />;
  if (!pathQ.data) return <EmptyState title={t("common.empty")} />;

  const path = pathQ.data;
  const topics = path.topics ?? [];
  const doneCount = topics.filter((x) => x.status === "done").length;
  const pct = topics.length > 0 ? Math.round((doneCount / topics.length) * 100) : 0;
  const complete = topics.length > 0 && pct === 100;

  return (
    <div>
      <PageBg variant="sky" />
      <div className="paper-card relative mx-auto max-w-3xl p-6">
        <Link to="/paths" className="mb-4 inline-flex items-center gap-1 font-display text-lg font-extrabold uppercase text-ink/60 hover:text-ink">
          <ArrowLeft className="h-5 w-5" strokeWidth={2.75} />
          {t("btn.back")}
        </Link>
        <PageHeader
          title={path.title}
          action={
            <Button variant="yellow" onClick={() => setModalOpen(true)} className="btn-sm">
              <Plus className="h-4 w-4" strokeWidth={2.75} />
              {t("paths.newTopic")}
            </Button>
          }
        />
        {topics.length > 0 && (
          <div className="mb-4">
            <Pill color={complete ? "bg-mint" : "bg-butter"}>
              {doneCount}/{topics.length} {t("paths.done")} · {pct}%
            </Pill>
          </div>
        )}
        {path.description && <p className="mb-4 font-body text-sm font-semibold text-ink/60">{path.description}</p>}

        {complete && (
          <div className="paper-card relative mb-6 flex items-center gap-4 !bg-mint/60 p-4">
            <Creature kind="dog" size={72} className="animate-bob" />
            <p className="font-display text-3xl font-extrabold uppercase">{t("paths.done")}!</p>
          </div>
        )}

        {topics.length === 0 ? (
          <EmptyState
            title={t("common.empty")}
            action={
              <Button variant="yellow" onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" strokeWidth={2.75} />
                {t("paths.newTopic")}
              </Button>
            }
          />
        ) : (
          <div className="relative ml-5 border-l-4 border-dotted border-ink/15 pl-8">
            {topics.map((topic, i) => {
              const meta = STATUS_META[topic.status];
              const Icon = meta.icon;
              return (
                <div key={topic.id} className="relative pb-5 last:pb-0">
                  <button
                    onClick={() => statusMut.mutate({ topicId: topic.id, status: STATUS_CYCLE[topic.status] })}
                    className={clsx(
                      "absolute -left-[3.35rem] top-3 flex h-10 w-10 items-center justify-center rounded-full transition hover:scale-110",
                      meta.nodeBg,
                    )}
                    style={{ boxShadow: "0 8px 18px -8px rgba(90,70,130,0.35)" }}
                    title={t(meta.key)}
                    aria-label={`Mark as ${STATUS_CYCLE[topic.status]}`}
                  >
                    <Icon className="h-5 w-5 text-ink" />
                  </button>
                  <div className="paper-card p-4">
                    <div className="flex items-center gap-2">
                      <Pill color="bg-butter">{i + 1}</Pill>
                      <p className={clsx("flex-1 font-body font-bold text-ink", topic.status === "done" && "text-ink/40 line-through")}>
                        {topic.title}
                      </p>
                    </div>
                    {topic.description && <p className="mt-1 font-body text-sm font-semibold text-ink/60">{topic.description}</p>}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="font-display text-base font-extrabold uppercase text-ink/50">{t(meta.key)}</p>
                      <Button
                        variant="blue"
                        className="btn-sm"
                        onClick={() => statusMut.mutate({ topicId: topic.id, status: STATUS_CYCLE[topic.status] })}
                      >
                        STUDY
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal title={t("paths.newTopic")} onClose={() => setModalOpen(false)}>
          <div className="space-y-4">
            <Field label={t("paths.topicTitle")}>
              <TextInput value={topicTitle} onChange={(e) => setTopicTitle(e.target.value)} placeholder="HTML basics" />
            </Field>
            <Field label={t("paths.topicDesc")}>
              <TextArea value={topicDesc} onChange={(e) => setTopicDesc(e.target.value)} rows={3} />
            </Field>
            <Button variant="blue" onClick={() => addTopicMut.mutate()} disabled={addTopicMut.isPending || !topicTitle.trim()} className="w-full">
              {addTopicMut.isPending ? t("common.loading") : t("btn.add")}
            </Button>
            {addTopicMut.isError && <p className="font-body text-sm font-bold text-red-700">{t("common.error")}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
