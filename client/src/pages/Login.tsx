import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useLang } from "../lib/i18n";
import { ApiError } from "../lib/api";
import { Field, PageBg, TextInput } from "../components/ui";
import Creature from "../components/creatures";

export default function Login() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.loginError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageBg variant="sky" />
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="card relative mx-auto w-full p-6 md:p-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <Creature kind="chick" size={104} className="animate-float" />
              <h1 className="mt-2 text-center font-display text-3xl font-extrabold tracking-tight text-ink">
                StudyGen AI
              </h1>
              <p className="mt-1 text-lg font-bold text-muted">{t("auth.loginTitle")}</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <Field label={t("auth.email")}>
                <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </Field>
              <Field label={t("auth.password")}>
                <TextInput type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </Field>
              {error && <p className="text-sm font-bold text-red-600">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? t("common.loading") : t("btn.login")}
              </button>
            </form>
            <p className="mt-4 text-center">
              <Link to="/register" className="text-sm font-extrabold text-lilac">
                {t("auth.noAccount")}
              </Link>
            </p>
          </div>

          {/* Fix 6: public landing — what StudyGen AI does, before the login wall. */}
          <div className="card relative mx-auto mt-6 w-full p-6 text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">
              {t("landing.headline")}
            </h2>
            <ul className="mt-4 space-y-3 text-left">
              <li className="flex items-start gap-2">
                <span className="chip shrink-0">1</span>
                <span className="text-sm font-bold text-ink/80">{t("landing.point1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="chip shrink-0">2</span>
                <span className="text-sm font-bold text-ink/80">{t("landing.point2")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="chip shrink-0">3</span>
                <span className="text-sm font-bold text-ink/80">{t("landing.point3")}</span>
              </li>
            </ul>
            <Link to="/register" className="btn-primary mt-5 inline-flex !py-4 !text-lg">
              {t("landing.getStarted")}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
