import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-warm px-6 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-caramel">HAFFYE</p>
      <h1 className="mt-2 text-3xl font-bold text-espresso">Page Not Found</h1>
      <p className="mt-2 max-w-sm text-sm text-coffee">
        The page or menu item you requested could not be found.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-espresso px-5 py-2.5 text-sm font-semibold text-cream shadow-soft hover:bg-coffee"
      >
        Back to HAFFYE
      </Link>
    </main>
  );
}
