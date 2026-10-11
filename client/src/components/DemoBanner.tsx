import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

/** Small yellow paper-tag warning shown when the API runs without a database. */
export default function DemoBanner() {
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<{ ok: boolean; service: string; demo?: boolean }>("/health"),
    staleTime: 60_000,
    retry: false,
  });

  if (!data?.demo) return null;

  return (
    <div className="mb-4 flex justify-center">
      <span className="pill !bg-btnyellow text-center text-sm normal-case">
        <span className="font-display font-extrabold uppercase">Demo mode</span>
        <span className="font-body font-bold">— data won't be saved. Set DATABASE_URL for real storage.</span>
      </span>
    </div>
  );
}
