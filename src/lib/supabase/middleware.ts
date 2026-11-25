import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { homeForRole, type Role } from "@/lib/roles";

const PROTECTED: Record<string, Role> = {
  "/customer": "customer",
  "/barista": "barista",
  "/admin": "admin",
};

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list: CookieToSet[]) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() validates the JWT with Supabase Auth (never trust getSession() on the server).
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const area = Object.keys(PROTECTED).find((p) => path === p || path.startsWith(p + "/"));

  if (area) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
    const { data: profile } = await supabase
      .from("profiles").select("role,is_active").eq("id", user.id).single();
    const role = profile?.role as Role | undefined;
    if (!profile?.is_active || !role || role !== PROTECTED[area]) {
      const url = request.nextUrl.clone();
      url.pathname = profile?.is_active && role ? homeForRole(role) : "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return response;
}

type CookieToSet = { name: string; value: string; options: CookieOptions };
