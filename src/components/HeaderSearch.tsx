"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "./Icons";

export function HeaderSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      className="hsearch"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/finder?q=${encodeURIComponent(q.trim())}&stock=0`);
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    >
      <SearchIcon />
      <label className="sr" htmlFor="hq">Search cards and products</label>
      <input id="hq" type="search" placeholder="Search cards, sets, players…" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
    </form>
  );
}
