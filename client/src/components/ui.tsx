import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Loader2, X } from "lucide-react";
import clsx from "clsx";
import Creature, { type CreatureKind } from "./creatures";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("animate-spin text-muted", className ?? "h-6 w-6")} />;
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Creature kind="grey" size={72} className="animate-float" />
      <p className="text-sm font-bold text-muted">{label ?? "One sec…"}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry, retryLabel }: { message?: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Creature kind="grey" size={72} className="animate-float" />
      <p className="max-w-sm text-[15px] font-bold text-muted">{message ?? "Oops! Something went wrong. Try again!"}</p>
      {onRetry && (
        <button className="btn-soft btn-sm mt-1" onClick={onRetry}>
          {retryLabel ?? "Try again"}
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  creature = "chick",
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  creature?: CreatureKind;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Creature kind={creature} size={88} className="animate-float" />
      <p className="text-xl font-extrabold tracking-tight text-ink">{title}</p>
      {hint && <p className="max-w-sm text-sm font-medium text-muted">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function AiNotice({ message }: { message: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl bg-peach px-4 py-2.5 text-sm font-semibold text-ink">
      <span aria-hidden="true">⚠</span>
      {message}
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "dark" | "accent" | "soft" | "secondary" | "danger" | "blue" | "yellow" | "pink" | "cream" | "green";
}

const VARIANT_CLS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "btn-primary",
  dark: "btn-dark",
  accent: "btn-accent",
  soft: "btn-soft",
  secondary: "btn-soft",
  danger: "btn-berry",
  blue: "btn-skyblue",
  yellow: "btn-sun",
  pink: "btn-rose",
  cream: "btn-white",
  green: "btn-mint",
};

export function Button({ variant = "primary", className, ...rest }: ButtonProps) {
  return <button className={clsx(VARIANT_CLS[variant], className)} {...rest} />;
}

export function Card({ className, children, alt }: { className?: string; children: ReactNode; alt?: boolean }) {
  return <div className={clsx(alt ? "card-alt" : "card", "p-5", className)}>{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

const INPUT_CLS =
  "w-full rounded-2xl border border-[#ECECF1] bg-mist px-4 py-3 text-[15px] font-semibold text-ink outline-none transition placeholder:font-medium placeholder:text-muted/70 focus:border-tangerine focus:bg-white focus:ring-4 focus:ring-tangerine/20";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(INPUT_CLS, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(INPUT_CLS, "min-h-[120px]", props.className)} />;
}

/** Bottom-sheet modal: overlay + sheet with grabber handle, gray X, big bold title. */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-sm font-medium text-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mist text-muted transition active:scale-95"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
        <div className="text-ink">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, action, light }: { title: string; action?: ReactNode; light?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className={clsx("text-[28px] font-extrabold leading-tight tracking-tight md:text-4xl", light ? "text-white" : "text-ink")}>
        {title}
      </h1>
      {action}
    </div>
  );
}

/** Small pill tag. */
export function Pill({ children, color = "bg-mist", className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-ink", color, className)}>
      {children}
    </span>
  );
}

/** Fixed pastel gradient wash behind the Layout. variant is kept for API compatibility — all values render the same wash. */
export function PageBg({ variant = "sky" }: { variant?: "sky" | "grass" | "night" | "deep" }) {
  return <div aria-hidden="true" data-variant={variant} className="page-bg" />;
}

/** Soft badge. */
export function Sticker({ children, color = "bg-sun", className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-ink", color, className)}>
      {children}
    </span>
  );
}
