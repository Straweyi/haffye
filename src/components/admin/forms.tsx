"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminResult } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Feedback({ fb }: { fb: AdminResult }) {
  if (fb.error) {
    return (
      <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
        {fb.error}
      </p>
    );
  }
  if (fb.message) {
    return (
      <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
        {fb.message}
      </p>
    );
  }
  return null;
}

export function useAdminAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fb, setFb] = useState<AdminResult>({});
  const run = (fn: () => Promise<AdminResult>, onDone?: (r: AdminResult) => void) =>
    start(async () => {
      const r = await fn();
      setFb(r);
      if (!r.error) router.refresh();
      onDone?.(r);
    });
  return { pending, fb, run, setFb };
}

export function ActionButton({
  action,
  payload,
  label,
  confirm,
  variant = "outline",
}: {
  action: (input: unknown) => Promise<AdminResult>;
  payload: unknown;
  label: string;
  confirm?: string;
  variant?: "outline" | "destructive" | "default" | "caramel" | "ghost";
}) {
  const { pending, fb, run } = useAdminAction();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          run(() => action(payload));
        }}
      >
        {pending ? "…" : label}
      </Button>
      {fb.error && <span className="max-w-[220px] text-[11px] text-red-600">{fb.error}</span>}
    </span>
  );
}

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "password" | "email" | "select" | "checkbox" | "date" | "textarea";
  options?: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: string | number | boolean | null;
  nullable?: boolean;
  step?: string;
  required?: boolean;
  wide?: boolean;
}

export function SimpleForm({
  action,
  fields,
  extra,
  submitLabel = "Save",
  resetOnSuccess = false,
}: {
  action: (input: unknown) => Promise<AdminResult>;
  fields: FieldDef[];
  extra?: Record<string, unknown>;
  submitLabel?: string;
  resetOnSuccess?: boolean;
}) {
  const { pending, fb, run } = useAdminAction();
  const [formKey, setFormKey] = useState(0);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = { ...extra };
    for (const f of fields) {
      if (f.type === "checkbox") payload[f.name] = fd.get(f.name) === "on";
      else {
        const raw = String(fd.get(f.name) ?? "");
        payload[f.name] = raw === "" && f.nullable ? null : raw;
      }
    }
    run(
      () => action(payload),
      (r) => {
        if (!r.error && resetOnSuccess) setFormKey((k) => k + 1);
      },
    );
  };

  return (
    <form key={formKey} onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <label
          key={f.name}
          className={`block text-xs font-semibold text-coffee ${f.wide || f.type === "textarea" ? "sm:col-span-2" : ""}`}
        >
          {f.type !== "checkbox" && <span className="mb-1 block">{f.label}</span>}
          {f.type === "select" ? (
            <select
              name={f.name}
              defaultValue={String(f.defaultValue ?? "")}
              required={f.required}
              className="h-11 w-full rounded-xl border border-coffee/20 bg-warm px-3 text-sm font-normal text-charcoal outline-none focus:border-caramel"
            >
              {(f.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "checkbox" ? (
            <span className="flex items-center gap-2 pt-6 text-sm font-medium text-espresso">
              <input
                type="checkbox"
                name={f.name}
                defaultChecked={Boolean(f.defaultValue)}
                className="h-4 w-4 accent-[#6F4E37]"
              />
              {f.label}
            </span>
          ) : f.type === "textarea" ? (
            <textarea
              name={f.name}
              defaultValue={String(f.defaultValue ?? "")}
              placeholder={f.placeholder}
              rows={2}
              className="w-full rounded-xl border border-coffee/20 bg-warm p-3 text-sm font-normal text-charcoal outline-none focus:border-caramel"
            />
          ) : (
            <Input
              name={f.name}
              type={f.type ?? "text"}
              step={f.step}
              required={f.required}
              defaultValue={
                f.defaultValue === null || f.defaultValue === undefined ? "" : String(f.defaultValue)
              }
              placeholder={f.placeholder}
              autoComplete="off"
            />
          )}
        </label>
      ))}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Feedback fb={fb} />
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

