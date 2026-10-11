import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useLang } from "../lib/i18n";
import { ApiError } from "../lib/api";
import { Button, Field, PageBg, TextInput } from "../components/ui";
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
        <div className="paper-card washi relative mx-auto w-full max-w-md p-6 md:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <Creature kind="chick" size={104} className="animate-bob" />
            <h1 className="title-chunky mt-2 text-center">StudyGen AI</h1>
            <p className="mt-1 font-display text-xl font-extrabold text-ink/60">{t("auth.loginTitle")}</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label={t("auth.email")}>
              <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
            <Field label={t("auth.password")}>
              <TextInput type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            {error && <p className="font-body text-sm font-bold text-red-600">{error}</p>}
            <Button variant="blue" type="submit" disabled={busy} className="w-full">
              {busy ? t("common.loading") : t("btn.login")}
            </Button>
          </form>
          <p className="mt-4 text-center">
            <Link to="/register" className="font-display text-lg font-extrabold text-ink underline decoration-btnyellow decoration-[3px] underline-offset-4">
              {t("auth.noAccount")}
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
