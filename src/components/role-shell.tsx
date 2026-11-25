import { requireRole } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";

export async function RoleShell({ role, title }: { role: "customer" | "barista" | "admin"; title: string }) {
  const s = await requireRole(role);
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-widest text-espresso">HAFFYE</h1>
        <form action={logoutAction}>
          <button className="rounded-xl border border-coffee/30 px-3 py-1.5 text-sm text-coffee">Log out</button>
        </form>
      </header>
      <section className="mt-8 rounded-2xl bg-cream p-6 shadow-soft">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-coffee">
          Signed in as <b>{s.full_name || s.email}</b> ({s.role}). This area is built in a later phase.
        </p>
      </section>
    </main>
  );
}
