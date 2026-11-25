import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-warm p-7 shadow-soft">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-[0.2em] text-espresso">HAFFYE</h1>
          <p className="mt-1 text-sm text-caramel">Coffee on the Move.</p>
        </div>
        {children}
      </div>
    </main>
  );
}
