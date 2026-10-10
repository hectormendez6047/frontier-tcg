import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages that stay reachable while the store is closed. Staff sign-in and admin always work.
// During "coming soon" customers can still create and manage accounts; during maintenance they can't.
const OPEN_ALWAYS = ["/login", "/auth", "/admin", "/no-access", "/coming-soon"];
const OPEN_COMING_SOON = [...OPEN_ALWAYS, "/signup", "/account"];

type Mode = "live" | "coming_soon" | "maintenance";
// Cache the store mode briefly so every page view doesn't hit the database.
let modeCache: { value: Mode; at: number } | null = null;
const CACHE_MS = 15_000;

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Refreshes the session cookie. Do not remove.
  const { data: { user } } = await supabase.auth.getUser();

  if (path.startsWith("/admin") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (path === "/coming-soon") return bare(request, response);

  // Store mode: live, coming soon or maintenance. The public sees the holding page; signed-in staff see the real store.
  let mode = modeCache && Date.now() - modeCache.at < CACHE_MS ? modeCache.value : null;
  if (mode === null) {
    const { data } = await supabase.from("store_settings").select("data").eq("id", 1).maybeSingle();
    const d = (data?.data ?? {}) as { siteMode?: Mode; comingSoon?: boolean };
    mode = d.siteMode ?? (d.comingSoon === false ? "live" : "coming_soon");
    modeCache = { value: mode, at: Date.now() };
  }
  if (mode === "live") return response;
  const open = mode === "maintenance" ? OPEN_ALWAYS : OPEN_COMING_SOON;
  if (open.some((p) => path === p || path.startsWith(p + "/"))) return response;

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile && ["owner", "admin", "staff"].includes(profile.role)) return response;
  }

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: mode === "maintenance" ? "Down for maintenance" : "Coming soon" }, { status: 503 });
  }
  if (path === "/sitemap.xml") return new NextResponse("", { status: 404 });

  const url = request.nextUrl.clone();
  url.pathname = "/coming-soon";
  url.search = "";
  return bare(request, response, url);
}

/** Serve a page without the store header and footer, keeping any refreshed session cookies. */
function bare(request: NextRequest, response: NextResponse, rewriteTo?: URL) {
  const headers = new Headers(request.headers);
  headers.set("x-ftcg-bare", "1");
  const out = rewriteTo
    ? NextResponse.rewrite(rewriteTo, { request: { headers } })
    : NextResponse.next({ request: { headers } });
  response.cookies.getAll().forEach((c) => out.cookies.set(c));
  out.headers.set("x-robots-tag", "noindex");
  return out;
}

export const config = {
  // Everything except Next.js build files and static images.
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|webp|jpg|jpeg|svg|ico|txt)$).*)"],
};
