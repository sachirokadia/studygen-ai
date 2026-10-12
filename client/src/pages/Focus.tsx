import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pause, Play, Square } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, PageBg } from "../components/ui";
import Creature from "../components/creatures";

const PRESETS = [15, 25, 45];

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Focus timer — soft pastel, big timer card, segmented presets, gradient CTA. */
export default function Focus() {
  const { t } = useLang();
  const [minutes, setMinutes] = useState(25);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [coins, setCoins] = useState(0);
  const endAt = useRef<number>(0);

  const focusMut = useMutation({
    mutationFn: (mins: number) => api.post<{ xp: number }>("/study/focus", { minutes: mins }),
    onSuccess: (res) => setCoins(res.xp ?? 0),
  });

  const pick = (m: number) => {
    if (running) return;
    setMinutes(m);
    setLeft(m * 60);
    setDone(false);
  };

  const start = () => {
    endAt.current = Date.now() + left * 1000;
    setRunning(true);
    setDone(false);
  };
  const pause = () => setRunning(false);
  const stop = () => {
    setRunning(false);
    setLeft(minutes * 60);
    setDone(false);
  };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const remain = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(remain);
      if (remain <= 0) {
        clearInterval(id);
        setRunning(false);
        setDone(true);
        focusMut.mutate(minutes);
      }
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return (
    <div>
      <PageBg variant="night" />
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink">
          {t("focus.title")}
        </h1>

        {done ? (
          <div className="card relative mt-8 p-8">
            <Creature kind="dog" size={120} className="mx-auto animate-float" />
            <p className="mt-4 text-4xl font-extrabold uppercase tracking-tight text-ink">{t("focus.done")}</p>
            <div className="stat-tile mx-auto mt-4 w-fit !px-8">
              <p className="text-3xl font-extrabold tabular-nums text-ink">
                +{coins}
              </p>
              <p className="text-sm font-bold text-ink/60">{t("focus.coinsEarned")}</p>
            </div>
            <Button variant="primary" className="mt-6 w-full !py-4 !text-2xl" onClick={stop}>
              {t("focus.goOn")}
            </Button>
          </div>
        ) : (
          <>
            {/* Timer card */}
            <div className="card mx-auto mt-10 w-fit !px-10 !py-6">
              <p className="text-7xl font-extrabold tabular-nums tracking-tight text-ink">{fmt(left)}</p>
            </div>

            <p className="mt-8 text-xl font-extrabold uppercase tracking-tight text-ink/60">
              {t("focus.pickMinutes")}
            </p>
            <div className="seg mx-auto mt-3 max-w-xs">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => pick(p)}
                  disabled={running}
                  className={clsx("seg-tab", minutes === p && "seg-tab-active")}
                >
                  {p} {t("focus.minutes")}
                </button>
              ))}
            </div>

            <div className="mt-8 flex justify-center gap-4">
              {!running ? (
                <button onClick={start} className="btn-primary !w-auto !px-10 !py-4 !text-2xl">
                  <Play className="h-6 w-6" strokeWidth={2.75} />
                  {t("focus.start")}
                </button>
              ) : (
                <Button variant="primary" onClick={pause} className="!w-auto !px-10 !py-4 !text-2xl">
                  <Pause className="h-6 w-6" strokeWidth={2.75} />
                  {t("focus.pause")}
                </Button>
              )}
              <Button variant="pink" onClick={stop} className="!w-auto !px-8 !py-4 !text-2xl">
                <Square className="h-6 w-6" strokeWidth={2.75} />
                {t("focus.stop")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
