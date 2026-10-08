import { NextResponse } from "next/server";
import { getProductsByIds, getSettings } from "@/lib/data";

const UUID = /^[0-9a-f-]{36}$/i;

/** Returns current price and stock for the items in a shopper's cart. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? (body.ids as unknown[]).filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 200) : [];
  const [products, settings] = await Promise.all([getProductsByIds(ids), getSettings()]);
  return NextResponse.json({
    products,
    settings: {
      shippingEnabled: settings.shippingEnabled, shippingFlat: settings.shippingFlat, freeShippingOver: settings.freeShippingOver,
      pickupEnabled: settings.pickupEnabled, pickupFee: settings.pickupFee, pointsPerDollar: settings.pointsPerDollar,
    },
  });
}
