import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  storeName: "Frontier TCG",
  email: "",
  phone: "",
  address: "Laredo, Texas",
  heroHeadline: "Trading Cards • Collectibles • Community",
  heroCopy:
    "Singles, sealed product, sports cards, accessories and local gaming events for collectors, players and the next card on your want list.",
  announcement: "",
  shippingEnabled: true,
  shippingFlat: 4.99,
  freeShippingOver: 75,
  pickupEnabled: false,
  pickupFee: 2,
  lowStock: 3,
  pointsPerDollar: 1,
  rewardThreshold: 100,
  rewardAmount: 5,
  aboutText:
    "Frontier TCG is a Laredo card shop for Pokémon, sports cards and every TCG in between. We buy, sell and trade singles and sealed product, and we host local play nights for players of every level.",
  instagram: "",
  facebook: "",
  tiktok: "",
  comingSoon: true,
  siteMode: "coming_soon",
  maintenanceMessage: "We're making some improvements and will be back shortly. Thanks for your patience.",
  autoBulk: true,
  bulkThreshold: 0.99,
  rewardsLive: false,
  taxEnabled: true,
  taxRate: 8.25,
  taxShipping: true,
  envelopeEnabled: false,
  envelopePrice: 1.5,
  envelopeMax: 20,
  orderEmail: "",
  comingSoonMessage:
    "Our online store is almost ready. Soon you'll be able to search our live inventory, check stock and order singles, sealed product and sports cards from Laredo.",
};

export function rewardExplainer(s: Pick<Settings, "pointsPerDollar" | "rewardThreshold" | "rewardAmount">): string {
  const ppd = Number(s.pointsPerDollar) || 0;
  const th = Number(s.rewardThreshold) || 100;
  const amt = Number(s.rewardAmount) || 0;
  const spend = ppd > 0 ? Math.ceil(th / ppd) : 0;
  return `Earn ${ppd} point${ppd === 1 ? "" : "s"} for every $1 you spend. Once you reach ${th} points, trade them in for $${amt.toFixed(2)} off a purchase.` +
    (spend ? ` That's one reward for about every $${spend} you spend.` : "");
}
