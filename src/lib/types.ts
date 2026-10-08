import type { ProductType } from "./constants";

export type Product = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  product_type: ProductType;
  game: string | null;
  set_name: string | null;
  card_number: string | null;
  rarity: string | null;
  card_type: string | null;
  player: string | null;
  team: string | null;
  year: string | null;
  manufacturer: string | null;
  rookie: boolean;
  parallel: string | null;
  is_insert: boolean;
  holo: boolean;
  language: string | null;
  condition: string | null;
  price: number;
  sale_price: number | null;
  compare_at_price: number | null;
  available_quantity: number;
  description: string | null;
  tags: string[];
  featured: boolean;
  is_demo: boolean;
  created_at: string;
  image_path?: string | null;
};

export type AdminProduct = Product & {
  status: "active" | "draft" | "archived";
  quantity: number;
  reserved_quantity: number;
  cost: number | null;
  notes: string | null;
  location_id: number | null;
  updated_at: string;
};

export type ProductImage = { id: string; product_id: string; path: string; alt: string | null; position: number };

export type Settings = {
  storeName: string;
  email: string;
  phone: string;
  address: string;
  heroHeadline: string;
  heroCopy: string;
  announcement: string;
  shippingEnabled: boolean;
  shippingFlat: number;
  freeShippingOver: number;
  pickupEnabled: boolean;
  pickupFee: number;
  lowStock: number;
  pointsPerDollar: number;
  rewardThreshold: number;
  rewardAmount: number;
  aboutText: string;
  instagram: string;
  facebook: string;
  tiktok: string;
};

export type StoreEvent = {
  id: string;
  name: string;
  starts_on: string;
  start_time: string | null;
  description: string | null;
  entry_fee: number;
  capacity: number | null;
  registration: "walkin" | "open" | "full" | "closed";
  status: "active" | "archived";
};

export type Role = "owner" | "admin" | "staff" | "customer";
