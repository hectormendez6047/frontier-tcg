import Image from "next/image";
import { productPhoto } from "@/lib/format";
import { PRODUCT_TYPES } from "@/lib/constants";
import type { Product } from "@/lib/types";

/** Product image in a trading-card-ratio frame, with a designed placeholder when there is no photo. */
export function CardArt({ p, path, priority, sizes = "(max-width: 640px) 50vw, 240px" }: {
  p: Pick<Product, "name" | "game" | "product_type" | "card_number" | "sku" | "is_demo" | "image_url">;
  path?: string | null;
  priority?: boolean;
  sizes?: string;
}) {
  const photo = productPhoto({ image_path: path, image_url: p.image_url });
  return (
    <div className="frame">
      {photo ? (
        <Image className="nimg" src={photo.src} alt={p.name} fill sizes={sizes} priority={priority} unoptimized={photo.external} />
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
