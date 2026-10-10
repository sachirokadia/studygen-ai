import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Loader2, AlertTriangle, Inbox } from "lucide-react";
import clsx from "clsx";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("animate-spin text-indigo-600", className ?? "h-6 w-6")} />;
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <Spinner className="h-8 w-8" />
      <p className="text-sm">{label ?? "Loading…"}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry, retryLabel }: { message?: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertTriangle className="h-8 w-8 text-red-500" />
      <p className="text-sm text-slate-600">{message ?? "Something went wrong."}</p>
      {onRetry && (
        <button className="btn-secondary" onClick={onRetry}>
          {retryLabel ?? "Try again"}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {icon ?? <Inbox className="h-10 w-10 text-slate-300" />}
      <p className="font-medium text-slate-700">{title}</p>
      {hint && <p className="max-w-sm text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function AiNotice({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      {message}
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

export function Button({ variant = "primary", className, ...rest }: ButtonProps) {
  return (
    <button
      className={clsx(
        variant === "primary" && "btn-primary",
        variant === "secondary" && "btn-secondary",
        variant === "danger" && "btn-danger",
        className,
      )}
      {...rest}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("card", className)}>{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx("input", props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx("input min-h-[120px]", props.className)} />;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {action}
    </div>
  );
}
