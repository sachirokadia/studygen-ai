import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Circle, Loader, Plus } from "lucide-react";
import clsx from "clsx";
import { api, type LearningPath, type PathTopic, type TopicStatus } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, TextArea, TextInput } from "../components/ui";

const STATUS_CYCLE: Record<TopicStatus, TopicStatus> = { todo: "doing", doing: "done", done: "todo" };

const STATUS_META: Record<TopicStatus, { icon: typeof Circle; cls: string; key: "paths.todo" | "paths.doing" | "paths.done" }> = {
  todo: { icon: Circle, cls: "text-slate-400", key: "paths.todo" },
  doing: { icon: Loader, cls: "text-amber-500", key: "paths.doing" },
  done: { icon: CheckCircle2, cls: "text-green-500", key: "paths.done" },
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

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/paths" className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" />
        {t("btn.back")}
      </Link>
      <PageHeader
        title={path.title}
        action={
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("paths.newTopic")}
          </Button>
        }
      />
      {path.description && <p className="mb-4 text-sm text-slate-500">{path.description}</p>}

      {topics.length > 0 && (
        <div className="mb-4">
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {doneCount}/{topics.length} · {pct}%
          </p>
        </div>
      )}

      {topics.length === 0 ? (
        <EmptyState
          title={t("common.empty")}
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("paths.newTopic")}
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {topics.map((topic, i) => {
            const meta = STATUS_META[topic.status];
            const Icon = meta.icon;
            return (
              <Card key={topic.id} className="!p-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => statusMut.mutate({ topicId: topic.id, status: STATUS_CYCLE[topic.status] })}
                    className={clsx("mt-0.5 rounded-full transition hover:scale-110", meta.cls)}
                    title={t(meta.key)}
                    aria-label={`Mark as ${STATUS_CYCLE[topic.status]}`}
                  >
                    <Icon className="h-6 w-6" />
                  </button>
                  <div className="flex-1">
                    <p className={clsx("font-medium", topic.status === "done" && "text-slate-400 line-through")}>
                      <span className="mr-2 text-xs text-slate-400">{i + 1}.</span>
                      {topic.title}
                    </p>
                    {topic.description && <p className="mt-1 text-sm text-slate-500">{topic.description}</p>}
                    <p className="mt-1 text-xs text-slate-400">{t(meta.key)}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <Modal title={t("paths.newTopic")} onClose={() => setModalOpen(false)}>
          <div className="space-y-4">
            <Field label={t("paths.topicTitle")}>
              <TextInput value={topicTitle} onChange={(e) => setTopicTitle(e.target.value)} placeholder="HTML basics" />
            </Field>
            <Field label={t("paths.topicDesc")}>
              <TextArea value={topicDesc} onChange={(e) => setTopicDesc(e.target.value)} rows={3} />
            </Field>
            <Button onClick={() => addTopicMut.mutate()} disabled={addTopicMut.isPending || !topicTitle.trim()} className="w-full">
              {addTopicMut.isPending ? t("common.loading") : t("btn.add")}
            </Button>
            {addTopicMut.isError && <p className="text-sm text-red-600">{t("common.error")}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
