import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Loader2, X } from "lucide-react";
import clsx from "clsx";
import Creature, { type CreatureKind } from "./creatures";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("animate-spin text-ink", className ?? "h-6 w-6")} />;
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <GreyCreature size={72} />
      <p className="font-display text-2xl font-extrabold uppercase tracking-wide text-ink/70">{label ?? "One sec…"}</p>
    </div>
  );
}

function GreyCreature({ size }: { size: number }) {
  return <Creature kind="grey" size={size} className="animate-bob" />;
}

export function ErrorState({ message, onRetry, retryLabel }: { message?: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Creature kind="grey" size={72} className="animate-bob" />
      <p className="font-display text-2xl font-extrabold uppercase tracking-wide text-ink/70">{message ?? "Oops! Something went wrong. Try again!"}</p>
      {onRetry && (
        <button className="btn-pink btn-sm" onClick={onRetry}>
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
      <Creature kind={creature} size={88} className="animate-bob" />
      <p className="font-display text-3xl font-extrabold uppercase tracking-wide text-ink">{title}</p>
      {hint && <p className="max-w-sm font-body text-sm font-bold text-ink/60">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function AiNotice({ message }: { message: string }) {
  return (
    <div className="pill !bg-btnpink text-sm">
      <span className="font-body font-bold normal-case tracking-normal">⚠ {message}</span>
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "blue" | "yellow" | "pink" | "cream" | "green";
}

const VARIANT_CLS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "btn-blue",
  secondary: "btn-cream",
  danger: "btn-pink",
  blue: "btn-blue",
  yellow: "btn-yellow",
  pink: "btn-pink",
  cream: "btn-cream",
  green: "btn-green",
};

export function Button({ variant = "primary", className, ...rest }: ButtonProps) {
  return <button className={clsx(VARIANT_CLS[variant], className)} {...rest} />;
}

export function Card({ className, children, alt }: { className?: string; children: ReactNode; alt?: boolean }) {
  return <div className={clsx(alt ? "paper-card-alt" : "paper-card", "p-5", className)}>{children}</div>;
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

/** Purple machine modal (Screen 6 NEW JOB style). */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" onClick={onClose}>
      <div className="machine max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 md:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="pill !bg-btnyellow !text-base">{title}</span>
          <button
            onClick={onClose}
            className="icon-round !bg-btnpink"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={3} />
          </button>
        </div>
        <div className="chain-metal my-3 opacity-80" aria-hidden="true" />
        <div className="font-body text-ink">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, action, light }: { title: string; action?: ReactNode; light?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className={light ? "title-chunky-light" : "title-chunky"}>{title}</h1>
      {action}
    </div>
  );
}

/** Rectangular hanging tag (labels like "3 LEFT"). */
export function HangTag({ children, color = "bg-btnyellow", className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 border-[2.5px] border-ink px-3 py-1 font-display text-base font-extrabold uppercase tracking-wide", color, className)}
      style={{ borderRadius: "8px", boxShadow: "2px 2px 0 #2B2B2B" }}>
      {children}
    </span>
  );
}

/** Small pill tag (10 MIN / 12 FRIENDS). */
export function Pill({ children, color = "bg-btnyellow", className }: { children: ReactNode; color?: string; className?: string }) {
  return <span className={clsx("pill", color, className)}>{children}</span>;
}

/** Circular tag that hangs on a chain. */
export function HangCircle({ children, color = "bg-btnyellow", active, className, title }: {
  children: ReactNode; color?: string; active?: boolean; className?: string; title?: string;
}) {
  return (
    <span title={title} className={clsx("hang-circle", color, active && "hang-circle-active", className)}>
      {children}
    </span>
  );
}

/** Metal chain divider. */
export function Chain({ className }: { className?: string }) {
  return <div className={clsx("chain-metal", className)} aria-hidden="true" />;
}

/** Full-page background. variant: sky (sky+grass split) | grass | night | deep */
export function Screen({ variant = "sky", children, className }: {
  variant?: "sky" | "grass" | "night" | "deep";
  children: ReactNode;
  className?: string;
}) {
  const bg = variant === "sky" ? "screen-sky" : variant === "grass" ? "screen-grass" : variant === "night" ? "screen-night" : "screen-deep";
  return <div className={clsx("min-h-screen", bg, className)}>{children}</div>;
}

/** Fixed full-viewport background behind the Layout (pages render inside Layout's main). */
export function PageBg({ variant = "sky" }: { variant?: "sky" | "grass" | "night" | "deep" }) {
  const bg = variant === "sky" ? "screen-sky" : variant === "grass" ? "screen-grass" : variant === "night" ? "screen-night" : "screen-deep";
  return <div aria-hidden="true" className={clsx("fixed inset-0 -z-10", bg)} />;
}

/** Sticker badge. */
export function Sticker({ children, color = "bg-btnyellow", className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 border-[2.5px] border-ink px-2.5 py-0.5 font-display text-base font-extrabold uppercase", color, className)}
      style={{ borderRadius: "999px", boxShadow: "2px 2px 0 #2B2B2B" }}>
      {children}
    </span>
  );
}
