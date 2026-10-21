import { notFound } from "next/navigation";
import { ReceiptDemo } from "@/components/screens/ReceiptDemo";
import { receiptBusiness } from "@/lib/business";
import { previewSell, previewStall, previewVendor } from "@/lib/fixtures";
import type { ReceiptSale } from "@/lib/types";

export default function ReceiptPreviewPage() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PREVIEW !== "1") notFound();
  const source = previewSell.recentSales[0];
  const sale: ReceiptSale = {
    id: source.id,
    orderNo: source.order_no,
    date: source.sale_date,
    total: Number(source.total),
    profit: Number(source.profit),
    priceReduction: 2000,
    paymentMethod: "MTN MoMo",
    customerName: "Sarah Namagembe",
    customerPhone: "+256 772 100 200",
    items: source.items.map((item) => ({
      name: item.product_name,
      qty: Number(item.quantity),
      listed: 27000,
      sold: Number(item.sold_price),
      cost: Number(item.unit_cost),
    })),
  };

  return <ReceiptDemo sale={sale} business={receiptBusiness(previewVendor, previewStall)} />;
}
