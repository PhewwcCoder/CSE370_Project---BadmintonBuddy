import React from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={"rounded-2xl bg-slate-900/60 border border-slate-800 shadow-soft " + className}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-5 pt-5">
      <div className="text-lg font-semibold">{title}</div>
      {subtitle ? <div className="text-sm text-slate-300 mt-1">{subtitle}</div> : null}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={"px-5 pb-5 pt-4 " + className}>{children}</div>;
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const { className = "", variant = "primary", ...rest } = props;
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-white text-slate-950 hover:bg-slate-200"
      : "bg-transparent text-slate-100 hover:bg-slate-800 border border-slate-700";
  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      className={
        "w-full rounded-xl bg-slate-950/40 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/30 " +
        className
      }
      {...rest}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      className={
        "w-full min-h-24 rounded-xl bg-slate-950/40 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/30 " +
        className
      }
      {...rest}
    />
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-200">{children}</span>;
}

export function Toast({ tone, children }: { tone: "ok" | "err"; children: React.ReactNode }) {
  return (
    <div
      className={
        "rounded-xl border px-3 py-2 text-sm " +
        (tone === "ok" ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-100" : "border-rose-700/60 bg-rose-950/40 text-rose-100")
      }
    >
      {children}
    </div>
  );
}

export function Divider() {
  return <div className="h-px bg-slate-800 my-4" />;
}
