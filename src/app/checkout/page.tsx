import type { Metadata } from "next";
import { getSettings } from "@/lib/data";
import { getViewer, hasRole } from "@/lib/auth";
import { squareConfigured, squareEnv } from "@/lib/square";
import { hasAdminKey } from "@/lib/supabase/admin";
import { checkoutPrefill } from "./actions";
import { CheckoutClient } from "./CheckoutClient";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [st, viewer, prefill] = await Promise.all([getSettings(), getViewer(), checkoutPrefill()]);
  const isStaff = !!viewer && hasRole(viewer.role, "staff");
  return (
    <CheckoutClient
      prefill={prefill}
      ready={squareConfigured() && hasAdminKey()}
      open={st.siteMode === "live" || isStaff}
      testMode={squareEnv() === "sandbox"}
      appId={process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID ?? ""}
      locationId={process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? ""}
      settings={{
        shippingEnabled: st.shippingEnabled, shippingFlat: Number(st.shippingFlat), freeShippingOver: Number(st.freeShippingOver),
        pickupEnabled: st.pickupEnabled, pickupFee: Number(st.pickupFee),
        envelopeEnabled: st.envelopeEnabled, envelopePrice: Number(st.envelopePrice), envelopeMax: Number(st.envelopeMax),
        taxEnabled: st.taxEnabled, taxRate: Number(st.taxRate), taxShipping: st.taxShipping,
      }}
    />
  );
}
