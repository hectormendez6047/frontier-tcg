export const PRODUCT_TYPES = {
  single: "Single",
  sealed: "Sealed",
  sports: "Sports Card",
  accessory: "Accessory",
  bulk: "Bulk",
  collectible: "Collectible",
} as const;
export type ProductType = keyof typeof PRODUCT_TYPES;

export const GAMES = ["Pokémon", "One Piece", "Magic: The Gathering", "Yu-Gi-Oh!", "Lorcana", "Football", "Basketball", "Baseball", "Soccer", "Other"];
export const SPORTS = ["Football", "Basketball", "Baseball", "Soccer"];
export const CONDITIONS = ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged", "Sealed", "New"];

export const NAV: [string, string][] = [
  ["/", "Home"],
  ["/shop", "Shop"],
  ["/finder", "Card Finder"],
  ["/shop/pokemon", "Pokémon"],
  ["/shop/sports", "Sports Cards"],
  ["/shop/tcg", "Other TCGs"],
  ["/shop/sealed", "Sealed"],
  ["/shop/accessories", "Accessories"],
  ["/bulk", "Bulk"],
  ["/events", "Events"],
  ["/rewards", "Rewards"],
  ["/about", "About"],
];

export const CATEGORIES: Record<string, { title: string; blurb: string }> = {
  pokemon: { title: "Pokémon", blurb: "Singles, sealed product and bulk from every era we stock." },
  sports: { title: "Sports Cards", blurb: "Football, basketball, baseball and soccer singles and boxes." },
  football: { title: "Football", blurb: "Football singles, inserts, rookies and boxes." },
  basketball: { title: "Basketball", blurb: "Basketball singles, inserts, rookies and boxes." },
  baseball: { title: "Baseball", blurb: "Baseball singles, inserts, rookies and boxes." },
  soccer: { title: "Soccer", blurb: "Soccer singles and boxes." },
  tcg: { title: "Other TCGs", blurb: "One Piece, Magic, Yu-Gi-Oh!, Lorcana and more." },
  sealed: { title: "Sealed Product", blurb: "Booster boxes, Elite Trainer Boxes, bundles, tins and hobby boxes." },
  accessories: { title: "Accessories", blurb: "Sleeves, top loaders, binders and storage." },
  collectibles: { title: "Collectibles", blurb: "Figures, graded slabs and other collectibles." },
};

export const PAGE_SIZE = 48;
