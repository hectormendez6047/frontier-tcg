import { NextResponse } from "next/server";
import { checkRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CSV_COLUMNS, toCSV } from "@/lib/csv";

export async function GET(req: Request) {
  const { error } = await checkRole("admin");
  if (error) return new NextResponse("Not allowed", { status: 403 });
  const which = new URL(req.url).searchParams.get("type");
  const supabase = await createClient();
  if (which === "template") {
    return new NextResponse(toCSV([]), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="frontier-import-template.csv"' } });
  }
  const all: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: e } = await supabase.rpc("admin_export_products").range(from, from + 999);
    if (e) return new NextResponse("Export failed", { status: 500 });
    all.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }
  const rows = which === "bulk" ? all.filter((r) => r.product_type === "bulk") : all;
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + toCSV(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="frontier-${which === "bulk" ? "bulk" : "inventory"}-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
