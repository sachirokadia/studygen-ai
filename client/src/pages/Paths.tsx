import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Map as MapIcon, Plus, Trash2 } from "lucide-react";
import { api, type LearningPath } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, TextArea, TextInput } from "../components/ui";

export default function Paths() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const pathsQ = useQuery({ queryKey: ["paths"], queryFn: () => api.get<LearningPath[]>("/paths") });

  const createMut = useMutation({
    mutationFn: () => api.post<LearningPath>("/paths", { title: title.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      setModalOpen(false);
      setTitle("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["paths"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/paths/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["paths"] }),
  });

  return (
    <div>
      <PageHeader
        title={t("paths.title")}
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("paths.new")}
          </Button>
        }
      />

      {pathsQ.isLoading ? (
        <LoadingState label={t("common.loading")} />
      ) : pathsQ.isError ? (
        <ErrorState message={t("common.error")} onRetry={() => pathsQ.refetch()} retryLabel={t("common.retry")} />
      ) : pathsQ.data && pathsQ.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pathsQ.data.map((p) => (
            <Card key={p.id} className="group relative">
              <Link to={`/paths/${p.id}`}>
                <div className="flex items-center gap-2">
                  <MapIcon className="h-5 w-5 text-indigo-500" />
                  <h3 className="font-semibold">{p.title}</h3>
                </div>
                {p.description && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{p.description}</p>}
              </Link>
              <button
                onClick={() => {
                  if (window.confirm(t("common.confirmDelete"))) deleteMut.mutate(p.id);
                }}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                aria-label="Delete path"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("paths.empty")}
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("paths.new")}
            </Button>
          }
        />
      )}

      {modalOpen && (
        <Modal title={t("paths.new")} onClose={() => setModalOpen(false)}>
          <div className="space-y-4">
            <Field label={t("decks.deckTitle")}>
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Web Development" />
            </Field>
            <Field label={t("paths.topicDesc")}>
              <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </Field>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !title.trim()} className="w-full">
              {createMut.isPending ? t("common.loading") : t("btn.create")}
            </Button>
            {createMut.isError && <p className="text-sm text-red-600">{t("common.error")}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
