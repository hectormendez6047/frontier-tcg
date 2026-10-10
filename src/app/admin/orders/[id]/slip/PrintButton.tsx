"use client";
export function PrintButton() {
  return <button className="btn gold" type="button" onClick={() => window.print()}>Print packing slip</button>;
}
