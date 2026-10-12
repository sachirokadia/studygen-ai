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

/** Focus timer — FOCUS screen style: dark purple, hanging timer tag. */
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
        <h1 className="title-chunky-light">{t("focus.title")}</h1>

        {done ? (
          <div className="paper-card relative mt-8 p-8">
            <Creature kind="dog" size={120} className="mx-auto animate-bob" />
            <p className="mt-4 font-display text-4xl font-extrabold uppercase">{t("focus.done")}</p>
            <p className="mt-2 font-display text-3xl font-extrabold text-ink/70">
              +{coins} {t("focus.coinsEarned")}
            </p>
            <Button variant="green" className="mt-6 w-full !py-4 !text-2xl" onClick={stop}>
              {t("focus.goOn")}
            </Button>
          </div>
        ) : (
          <>
            {/* Timer card */}
            <div className="paper-card mx-auto mt-10 w-fit !px-10 !py-6">
              <p className="font-display text-7xl font-extrabold tabular-nums">{fmt(left)}</p>
            </div>

            <p className="mt-8 font-display text-xl font-extrabold uppercase text-paper/80">
              {t("focus.pickMinutes")}
            </p>
            <div className="mt-3 flex justify-center gap-3">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => pick(p)}
                  disabled={running}
                  className={clsx(
                    "pill !px-5 !py-2 !text-xl",
                    minutes === p ? "!bg-playyellow" : "bg-white/70",
                  )}
                >
                  {p} {t("focus.minutes")}
                </button>
              ))}
            </div>

            <div className="mt-8 flex justify-center gap-4">
              {!running ? (
                <button onClick={start} className="btn-gradient !px-10 !py-4 !text-2xl">
                  <Play className="h-6 w-6" strokeWidth={2.75} />
                  {t("focus.start")}
                </button>
              ) : (
                <Button variant="yellow" onClick={pause} className="!px-10 !py-4 !text-2xl">
                  <Pause className="h-6 w-6" strokeWidth={2.75} />
                  {t("focus.pause")}
                </Button>
              )}
              <Button variant="pink" onClick={stop} className="!px-8 !py-4 !text-2xl">
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
