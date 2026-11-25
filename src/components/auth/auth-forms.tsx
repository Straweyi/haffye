"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@/lib/validators/auth";
import { loginAction, registerAction } from "@/app/actions/auth";

const field =
  "w-full rounded-xl border border-coffee/20 bg-warm px-4 py-3 text-sm outline-none transition focus:border-caramel focus:ring-2 focus:ring-caramel/30";
const btn =
  "w-full rounded-xl bg-espresso py-3 text-sm font-semibold text-cream shadow-soft transition hover:bg-coffee disabled:opacity-60";

function Feedback({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return (
    <p role="alert" className={`rounded-xl px-3 py-2 text-sm ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
      {error ?? message}
    </p>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [pending, start] = useTransition();
  const [fb, setFb] = useState<{ error?: string; message?: string }>({});
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  return (
    <form
      onSubmit={handleSubmit((v) => start(async () => setFb((await loginAction(v, next)) ?? {})))}
      className="space-y-4"
    >
      <div>
        <input {...register("email")} type="email" placeholder="Email" autoComplete="email" className={field} />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
      </div>
      <div>
        <input {...register("password")} type="password" placeholder="Password" autoComplete="current-password" className={field} />
        {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
      </div>
      <Feedback {...fb} />
      <button disabled={pending} className={btn}>{pending ? "Signing in…" : "Log in"}</button>
      <p className="text-center text-sm text-coffee">
        New to HAFFYE? <Link href="/register" className="font-semibold text-caramel">Create account</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [pending, start] = useTransition();
  const [fb, setFb] = useState<{ error?: string; message?: string }>({});
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  return (
    <form
      onSubmit={handleSubmit((v) => start(async () => setFb((await registerAction(v)) ?? {})))}
      className="space-y-4"
    >
      {(["full_name", "phone", "email", "password"] as const).map((name) => (
        <div key={name}>
          <input
            {...register(name)}
            type={name === "password" ? "password" : name === "email" ? "email" : name === "phone" ? "tel" : "text"}
            placeholder={{ full_name: "Full name", phone: "Phone (optional, 08…)", email: "Email", password: "Password (min 8 chars)" }[name]}
            autoComplete={{ full_name: "name", phone: "tel", email: "email", password: "new-password" }[name]}
            className={field}
          />
          {errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name]?.message}</p>}
        </div>
      ))}
      <Feedback {...fb} />
      <button disabled={pending} className={btn}>{pending ? "Creating…" : "Create account"}</button>
      <p className="text-center text-sm text-coffee">
        Already registered? <Link href="/login" className="font-semibold text-caramel">Log in</Link>
      </p>
    </form>
  );
}
