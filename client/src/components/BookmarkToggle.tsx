import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import clsx from "clsx";
import { api, type Bookmark } from "../lib/api";
import { useLang } from "../lib/i18n";

export default function BookmarkToggle({
  kind,
  refId,
  label,
}: {
  kind: string;
  refId: string;
  label: string;
}) {
  const { t } = useLang();
  const queryClient = useQueryClient();

  const bmQ = useQuery({ queryKey: ["bookmarks"], queryFn: () => api.get<Bookmark[]>("/bookmarks") });
  const existing = bmQ.data?.find((b) => b.kind === kind && b.refId === refId);

  const addMut = useMutation({
    mutationFn: () => api.post<Bookmark>("/bookmarks", { kind, refId, label }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });
  const delMut = useMutation({
    mutationFn: () => api.del(`/bookmarks/${existing!.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const busy = addMut.isPending || delMut.isPending;

  return (
    <button
      onClick={() => (existing ? delMut.mutate() : addMut.mutate())}
      disabled={busy}
      title={t("bookmarks.toggle")}
      aria-label={t("bookmarks.toggle")}
      aria-pressed={!!existing}
      className={clsx("btn-soft btn-sm", existing && "!bg-sun")}
    >
      <Star className="h-4 w-4" strokeWidth={2.5} fill={existing ? "#111111" : "none"} />
      {existing ? t("bookmarks.saved") : t("bookmarks.save")}
    </button>
  );
}
