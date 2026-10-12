import { Link, useNavigate } from "react-router-dom";
import { Bookmark, LogOut, Map, MessageCircle, ShieldCheck, Sparkles, StickyNote, Timer } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../lib/auth";
import { useLang, type Lang } from "../lib/i18n";
import { PageBg } from "../components/ui";
import Creature from "../components/creatures";

export default function Me() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();

  const rows = [
    { to: "/notes", label: t("nav.notes"), icon: StickyNote, color: "bg-playpink" },
    { to: "/paths", label: t("nav.paths"), icon: Map, color: "bg-playpurple" },
    { to: "/focus", label: t("me.focus"), icon: Timer, color: "bg-playblue" },
    { to: "/explain", label: t("nav.explain"), icon: Sparkles, color: "bg-playyellow" },
    { to: "/chat", label: t("nav.chat"), icon: MessageCircle, color: "bg-playgreen" },
    { to: "/bookmarks", label: t("nav.bookmarks"), icon: Bookmark, color: "bg-playorange" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const switchLang = (l: Lang) => setLang(l);

  return (
    <div>
      <PageBg variant="sky" />
      <div className="paper-card relative mx-auto max-w-md p-6 pt-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Creature kind="dog" size={96} className="animate-bob" />
          <h1 className="title-chunky mt-2">{user?.name ?? t("nav.me")}</h1>
          <p className="mt-1 font-body text-sm font-bold text-ink/60">{user?.email}</p>
        </div>

        <div className="space-y-3">
          {rows.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="paper-card flex items-center gap-3 !p-4 transition active:scale-[0.98]"
            >
              <span className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white", r.color)}>
                <r.icon className="h-5 w-5" strokeWidth={2.75} />
              </span>
              <span className="font-display text-xl font-extrabold">{r.label}</span>
            </Link>
          ))}
          {user?.role === "admin" && (
            <Link to="/admin" className="paper-card flex items-center gap-3 !p-4 transition active:scale-[0.98]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                <ShieldCheck className="h-5 w-5" strokeWidth={2.75} />
              </span>
              <span className="font-display text-xl font-extrabold">{t("nav.admin")}</span>
            </Link>
          )}
        </div>

        <div className="mt-6 border-t-2 border-dashed border-ink/10 pt-4">
          <p className="mb-2 text-center font-display text-lg font-extrabold uppercase text-ink/60">
            {t("me.language")}
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => switchLang("en")}
              className={clsx("pill cursor-pointer", lang === "en" ? "!bg-playyellow" : "opacity-60")}
            >
              English
            </button>
            <button
              onClick={() => switchLang("hi")}
              className={clsx("pill cursor-pointer", lang === "hi" ? "!bg-playyellow" : "opacity-60")}
            >
              हिंदी
            </button>
          </div>
        </div>

        <button onClick={handleLogout} className="btn-pink mt-6 w-full !py-4 !text-2xl">
          <LogOut className="h-6 w-6" strokeWidth={2.75} />
          {t("me.logout")}
        </button>
      </div>
    </div>
  );
}
