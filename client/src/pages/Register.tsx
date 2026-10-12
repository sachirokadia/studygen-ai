import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useLang } from "../lib/i18n";
import { ApiError } from "../lib/api";
import { Field, PageBg, TextInput } from "../components/ui";
import Creature from "../components/creatures";

export default function Register() {
  const { register } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError(t("auth.passwordShort"));
      return;
    }
    setBusy(true);
    try {
      await register(name, email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageBg variant="sky" />
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="paper-card relative mx-auto w-full max-w-md p-6 md:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <Creature kind="chick" size={104} className="animate-bob" />
            <h1 className="title-chunky mt-2 text-center">StudyGen AI</h1>
            <p className="mt-1 font-display text-xl font-extrabold text-ink/60">{t("auth.registerTitle")}</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label={t("auth.name")}>
              <TextInput required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
            </Field>
            <Field label={t("auth.email")}>
              <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
            <Field label={t("auth.password")}>
              <TextInput type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <p className="mt-1 font-body text-xs font-bold text-ink/50">{t("auth.passwordShort")}</p>
            </Field>
            {error && <p className="font-body text-sm font-bold text-red-600">{error}</p>}
            <button type="submit" disabled={busy} className="btn-gradient w-full">
              {busy ? t("common.loading") : t("btn.register")}
            </button>
          </form>
          <p className="mt-4 text-center">
            <Link to="/login" className="font-display text-lg font-extrabold text-playpurple">
              {t("auth.haveAccount")}
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
