import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { useLang } from "../lib/i18n";

/** Small soft warning pill shown when the API runs without a database. */
export default function DemoBanner() {
  const { t } = useLang();
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<{ ok: boolean; service: string; demo?: boolean }>("/health"),
    staleTime: 60_000,
    retry: false,
  });

  if (!data?.demo) return null;

  return (
    <div className="mb-4 flex justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sun px-4 py-1.5 text-center text-xs font-bold text-ink shadow-card">
        {t("demo.playMode")}
      </span>
    </div>
  );
}
