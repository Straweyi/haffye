import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { homeForRole } from "@/lib/roles";

export default async function Landing() {
  const session = await getSessionProfile();
  if (session) redirect(homeForRole(session.role));
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-espresso px-6 text-center text-cream">
      <h1 className="text-5xl font-bold tracking-[0.25em]">HAFFYE</h1>
      <p className="mt-3 text-caramel">Coffee on the Move.</p>
      <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
        <Link href="/register" className="rounded-xl bg-caramel py-3 font-semibold text-espresso shadow-soft">Get started</Link>
        <Link href="/login" className="rounded-xl border border-cream/30 py-3 font-semibold">Log in</Link>
      </div>
    </main>
  );
}
