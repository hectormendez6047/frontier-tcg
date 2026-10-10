export const PRODUCT_TYPES = {
  single: "Single",
  sealed: "Sealed",
  sports: "Sports Card",
  accessory: "Accessory",
  bulk: "Bulk",
  collectible: "Collectible",
} as const;
export type ProductType = keyof typeof PRODUCT_TYPES;

export const SPORTS = ["Football", "Basketball", "Baseball", "Hockey", "Soccer"];
export const TCG_GAMES = [
  "Pokémon", "One Piece", "Magic: The Gathering", "Yu-Gi-Oh!", "Disney Lorcana", "Dragon Ball Super",
  "Digimon", "Flesh and Blood", "Star Wars: Unlimited", "Union Arena", "Weiss Schwarz",
];
export const GAMES = [...TCG_GAMES, ...SPORTS, "Other"];
export const isSportName = (g?: string | null) => !!g && SPORTS.includes(g);

export const CONDITIONS = ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged", "Sealed", "New"];
export const CARD_CONDITIONS = CONDITIONS.slice(0, 5);
export const GRADERS = ["PSA", "BGS", "CGC", "SGC", "TAG", "Other"];

export const SEALED_KINDS: [string, string][] = [
  ["booster_box", "Booster box"], ["etb", "Elite Trainer Box"], ["booster_bundle", "Booster bundle"],
  ["booster_pack", "Booster pack"], ["sleeved_booster", "Sleeved booster"], ["blister", "Blister pack"],
  ["collection_box", "Collection box"], ["tin", "Tin"], ["premium_collection", "Premium collection"],
  ["build_battle", "Build & Battle"], ["starter_deck", "Starter / theme deck"], ["hobby_box", "Hobby box"],
  ["blaster_box", "Blaster box"], ["mega_box", "Mega box"], ["hanger_pack", "Hanger / fat pack"],
  ["case", "Sealed case"], ["other_sealed", "Other sealed"],
];
export const ACCESSORY_KINDS: [string, string][] = [
  ["sleeves", "Sleeves"], ["top_loaders", "Top loaders"], ["one_touch", "Magnetic / one-touch holders"],
  ["binders", "Binders"], ["deck_boxes", "Deck boxes"], ["storage", "Storage boxes"], ["playmats", "Playmats"],
  ["dice_counters", "Dice & counters"], ["other_accessory", "Other accessory"],
];
export const KIND_LABEL: Record<string, string> = Object.fromEntries([...SEALED_KINDS, ...ACCESSORY_KINDS]);

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

/** What filters a tab shows. */
export type FilterScope = "all" | "pokemon" | "tcg" | "sports" | "sport" | "sealed" | "accessories" | "bulk";

export const CATEGORIES: Record<string, { title: string; blurb: string; scope: FilterScope; game?: string }> = {
  pokemon: { title: "Pokémon", blurb: "Singles, graded cards and sealed product from every era we stock.", scope: "pokemon", game: "Pokémon" },
  sports: { title: "Sports Cards", blurb: "Football, basketball, baseball, hockey and soccer singles, rookies, inserts and graded slabs.", scope: "sports" },
  football: { title: "Football", blurb: "NFL singles, rookies, inserts, graded slabs and boxes.", scope: "sport", game: "Football" },
  basketball: { title: "Basketball", blurb: "NBA singles, rookies, inserts, graded slabs and boxes.", scope: "sport", game: "Basketball" },
  baseball: { title: "Baseball", blurb: "MLB singles, rookies, inserts, graded slabs and boxes.", scope: "sport", game: "Baseball" },
  hockey: { title: "Hockey", blurb: "NHL singles, rookies, inserts, graded slabs and boxes.", scope: "sport", game: "Hockey" },
  soccer: { title: "Soccer", blurb: "Soccer singles, rookies, inserts and boxes.", scope: "sport", game: "Soccer" },
  tcg: { title: "Other TCGs", blurb: "One Piece, Magic, Yu-Gi-Oh!, Lorcana, Dragon Ball and more.", scope: "tcg" },
  sealed: { title: "Sealed Product", blurb: "Booster boxes, Elite Trainer Boxes, bundles, tins, collection boxes, hobby and blaster boxes.", scope: "sealed" },
  accessories: { title: "Accessories", blurb: "Sleeves, top loaders, binders, deck boxes and storage.", scope: "accessories" },
  collectibles: { title: "Collectibles", blurb: "Figures and other collectibles.", scope: "all" },
};

export const PAGE_SIZE = 48;

export const EMAIL_TOPICS = [
  ["promotions", "Deals and promotions"], ["new_products", "New products and new sets"], ["restocks", "Restocks"],
  ["events", "Events and tournaments"], ["rewards", "Rewards"], ["announcements", "Store announcements"],
] as const;
