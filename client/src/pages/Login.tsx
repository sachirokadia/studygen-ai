import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useLang } from "../lib/i18n";
import { ApiError } from "../lib/api";
import { Button, Field, TextInput } from "../components/ui";

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-4">
      <div className="card w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold">StudyGen AI</h1>
            <p className="text-sm text-slate-500">{t("auth.loginTitle")}</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label={t("auth.email")}>
            <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label={t("auth.password")}>
            <TextInput type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? t("common.loading") : t("btn.login")}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link to="/register" className="font-medium text-indigo-600 hover:underline">
            {t("auth.noAccount")}
          </Link>
        </p>
      </div>
    </div>
  );
}
