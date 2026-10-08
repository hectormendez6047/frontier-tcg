"use client";
import Image from "next/image";
import { useState } from "react";
import { imageUrl } from "@/lib/format";
import type { ProductImage } from "@/lib/types";

export function Gallery({ images, name, isDemo }: { images: ProductImage[]; name: string; isDemo: boolean }) {
  const [i, setI] = useState(0);
  const cur = images[i];
  return (
    <div>
      <div className="frame">
        {cur && <Image className="nimg" src={imageUrl(cur.path)!} alt={cur.alt || name} fill priority sizes="(max-width: 820px) 100vw, 420px" />}
        {isDemo && <span className="demo-tag">Demo</span>}
      </div>
      {images.length > 1 && (
        <div className="thumbs">
          {images.map((im, n) => (
            <button key={im.id} type="button" aria-pressed={n === i} aria-label={`Photo ${n + 1}`} onClick={() => setI(n)} style={{ position: "relative" }}>
              <Image src={imageUrl(im.path)!} alt="" fill sizes="56px" style={{ objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
