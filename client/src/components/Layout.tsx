import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Layers,
  RotateCcw,
  StickyNote,
  Map,
  Sparkles,
  MessageCircle,
  Bookmark,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Languages,
  GraduationCap,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../lib/auth";
import { useLang, type I18nKey } from "../lib/i18n";

const NAV: { to: string; key: I18nKey; icon: typeof LayoutDashboard }[] = [
  { to: "/", key: "nav.dashboard", icon: LayoutDashboard },
  { to: "/decks", key: "nav.decks", icon: Layers },
  { to: "/review", key: "nav.review", icon: RotateCcw },
  { to: "/notes", key: "nav.notes", icon: StickyNote },
  { to: "/paths", key: "nav.paths", icon: Map },
  { to: "/explain", key: "nav.explain", icon: Sparkles },
  { to: "/chat", key: "nav.chat", icon: MessageCircle },
  { to: "/bookmarks", key: "nav.bookmarks", icon: Bookmark },
];

const MOBILE_NAV = NAV.slice(0, 5);

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
      isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100",
    );

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="hidden text-lg font-bold tracking-tight sm:block">StudyGen AI</span>
          </button>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className={linkCls}>
                <item.icon className="h-4 w-4" />
                {t(item.key)}
              </NavLink>
            ))}
            {user?.role === "admin" && (
              <NavLink to="/admin" className={linkCls}>
                <ShieldCheck className="h-4 w-4" />
                {t("nav.admin")}
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "en" ? "hi" : "en")}
              className="btn-secondary !px-3 !py-2 text-xs"
              title="Toggle language"
            >
              <Languages className="h-4 w-4" />
              {lang === "en" ? "हिं" : "EN"}
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700"
                aria-label="User menu"
              >
                {(user?.name ?? "U").charAt(0).toUpperCase()}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  <div className="px-4 py-2 text-sm font-medium text-slate-800">{user?.name}</div>
                  <div className="px-4 pb-2 text-xs text-slate-500">{user?.email}</div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("btn.logout")}
                  </button>
                </div>
              )}
            </div>
            <button className="rounded-xl p-2 hover:bg-slate-100 lg:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Tablet/mobile dropdown nav */}
        {menuOpen && (
          <nav className="border-t border-slate-100 px-4 py-2 lg:hidden">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className={linkCls} onClick={() => setMenuOpen(false)}>
                <item.icon className="h-4 w-4" />
                {t(item.key)}
              </NavLink>
            ))}
            {user?.role === "admin" && (
              <NavLink to="/admin" className={linkCls} onClick={() => setMenuOpen(false)}>
                <ShieldCheck className="h-4 w-4" />
                {t("nav.admin")}
              </NavLink>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                  isActive ? "text-indigo-700" : "text-slate-500",
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {t(item.key)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
