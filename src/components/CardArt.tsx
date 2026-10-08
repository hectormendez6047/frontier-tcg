import Image from "next/image";
import { imageUrl } from "@/lib/format";
import { PRODUCT_TYPES } from "@/lib/constants";
import type { Product } from "@/lib/types";

/** Product image in a trading-card-ratio frame, with a designed placeholder when there is no photo. */
export function CardArt({ p, path, priority, sizes = "(max-width: 640px) 50vw, 240px" }: {
  p: Pick<Product, "name" | "game" | "product_type" | "card_number" | "sku" | "is_demo">;
  path?: string | null;
  priority?: boolean;
  sizes?: string;
}) {
  const src = imageUrl(path);
  return (
    <div className="frame">
      {src ? (
        <Image className="nimg" src={src} alt={p.name} fill sizes={sizes} priority={priority} />
      ) : (
        <div className="ph" aria-hidden="true">
          <span className="g">{p.game || PRODUCT_TYPES[p.product_type] || ""}</span>
          <span className="t">{p.name}</span>
          <span className="no">{p.card_number ? "#" + p.card_number : p.sku}</span>
        </div>
      )}
      {p.is_demo && <span className="demo-tag">Demo</span>}
    </div>
  );
}
