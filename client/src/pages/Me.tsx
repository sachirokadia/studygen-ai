import { Link, useNavigate } from "react-router-dom";
import { Bookmark, LogOut, Map, MessageCircle, ShieldCheck, Sparkles, StickyNote, Timer } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../lib/auth";
import { useLang, type Lang } from "../lib/i18n";
import { Button, PageBg } from "../components/ui";

export default function Me() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();

  const rows = [
    { to: "/notes", label: t("nav.notes"), icon: StickyNote, tint: "bg-peach", fg: "text-tangerine" },
    { to: "/paths", label: t("nav.paths"), icon: Map, tint: "bg-lavender", fg: "text-lilac" },
    { to: "/focus", label: t("me.focus"), icon: Timer, tint: "bg-sky", fg: "text-skyblue" },
    { to: "/explain", label: t("nav.explain"), icon: Sparkles, tint: "bg-mint", fg: "text-berry" },
    { to: "/chat", label: t("nav.chat"), icon: MessageCircle, tint: "bg-peach", fg: "text-pinkpop" },
    { to: "/bookmarks", label: t("nav.bookmarks"), icon: Bookmark, tint: "bg-lavender", fg: "text-amber" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const switchLang = (l: Lang) => setLang(l);

  const initials = (user?.name ?? t("nav.me"))
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div>
      <PageBg variant="sky" />
      <div className="mx-auto max-w-md">
        {/* ===== Profile header ===== */}
        <div className="card mx-auto p-6 pt-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-lavender text-3xl font-extrabold text-lilac">
              {initials}
            </span>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink">
              {user?.name ?? t("nav.me")}
            </h1>
            <p className="mt-1 text-sm font-bold text-muted">{user?.email}</p>
          </div>
        </div>

        {/* ===== Settings list ===== */}
        <div className="card mt-4 divide-y divide-mist overflow-hidden">
          {rows.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="flex items-center gap-3 p-4 transition active:bg-mist/60"
            >
              <span className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", r.tint, r.fg)}>
                <r.icon className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <span className="flex-1 text-base font-extrabold text-ink">{r.label}</span>
              <span className="text-xl font-extrabold text-muted" aria-hidden="true">→</span>
            </Link>
          ))}
          {user?.role === "admin" && (
            <Link to="/admin" className="flex items-center gap-3 p-4 transition active:bg-mist/60">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
                <ShieldCheck className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <span className="flex-1 text-base font-extrabold text-ink">{t("nav.admin")}</span>
              <span className="text-xl font-extrabold text-muted" aria-hidden="true">→</span>
            </Link>
          )}

          <div className="flex items-center gap-3 p-4">
            <span className="flex-1 text-base font-extrabold text-ink">{t("me.language")}</span>
            <div className="seg w-44">
              <button
                onClick={() => switchLang("en")}
                className={clsx("seg-tab", lang === "en" && "seg-tab-active")}
                aria-pressed={lang === "en"}
              >
                English
              </button>
              <button
                onClick={() => switchLang("hi")}
                className={clsx("seg-tab", lang === "hi" && "seg-tab-active")}
                aria-pressed={lang === "hi"}
              >
                हिंदी
              </button>
            </div>
          </div>
        </div>

        <Button variant="dark" onClick={handleLogout} className="mt-6 w-full !py-4 !text-xl">
          <LogOut className="h-5 w-5" strokeWidth={2.75} />
          {t("me.logout")}
        </Button>
      </div>
    </div>
  );
}
