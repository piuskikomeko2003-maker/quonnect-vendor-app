"use client";

import { useEffect, useState } from "react";
import { buildReceipt, type ReceiptBusiness } from "@/lib/receipt";
import type { ReceiptSale } from "@/lib/types";

export function ReceiptDemo({ sale, business }: { sale: ReceiptSale; business: ReceiptBusiness }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    void buildReceipt(sale, business).then((canvas) => setUrl(canvas.toDataURL("image/png")));
  }, [sale, business]);

  return (
    <div style={{ padding: 16 }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Receipt preview" style={{ width: "100%", borderRadius: 12 }} />
      ) : (
        <div className="empty">Building receipt…</div>
      )}
    </div>
  );
}
