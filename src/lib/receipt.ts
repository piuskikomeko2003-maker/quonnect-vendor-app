import { formatDay, formatUGX, todayKey } from "@/lib/format";
import type { ReceiptSale } from "@/lib/types";

export interface ReceiptBusiness {
  stallName: string;
  tagline: string;
  businessName: string;
  category: string;
  location: string;
  phone: string;
  logoUrl: string | null;
  accent: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  whatsapp: string;
}

export function receiptNumber(id: string): string {
  return `R-${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

export function receiptDate(sale: ReceiptSale): string {
  return formatDay(sale.date || todayKey());
}

export function whatsappNumber(phone: string): string {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `256${digits.slice(1)}`;
  return digits;
}

export function receiptText(sale: ReceiptSale, business: ReceiptBusiness): string {
  const items = sale.items.length
    ? sale.items
    : [{ name: "Goods sold", qty: 1, listed: sale.total, sold: sale.total, cost: 0 }];

  const lines = items.map((item) => `${item.qty} x ${item.name}  ${formatUGX(item.sold * item.qty)}`);
  const saved = sale.priceReduction > 0 ? `\nYou saved ${formatUGX(sale.priceReduction)}` : "";

  return (
    `*Receipt ${receiptNumber(sale.id)}* from ${business.stallName}\n` +
    `${receiptDate(sale)}\n\n` +
    `${lines.join("\n")}${saved}\n\n` +
    `*Total: ${formatUGX(sale.total)}*\nPaid with ${sale.paymentMethod || "Cash"}\n\n` +
    `Thank you for shopping with ${business.stallName}!` +
    (business.phone ? `\nCall or WhatsApp: ${business.phone}` : "")
  );
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/**
 * Port of the prototype's canvas receipt. Width is fixed at 720px.
 */
export async function buildReceipt(
  sale: ReceiptSale,
  business: ReceiptBusiness,
): Promise<HTMLCanvasElement> {
  const color = business.accent || "#0F8A4D";
  const width = 720;
  const pad = 44;
  const font = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  const logo = business.logoUrl ? await loadImage(business.logoUrl) : null;
  const items = sale.items.length
    ? sale.items
    : [{ name: "Goods sold", qty: 1, listed: sale.total, sold: sale.total, cost: 0 }];
  const reduction = Math.max(0, sale.priceReduction || 0);
  const socials = [
    business.instagram && `Instagram @${business.instagram}`,
    business.facebook && `Facebook ${business.facebook}`,
    business.tiktok && `TikTok @${business.tiktok}`,
    business.whatsapp && `WhatsApp ${business.whatsapp}`,
  ].filter(Boolean) as string[];

  const height =
    190 +
    46 +
    60 +
    (sale.customerName ? 36 : 0) +
    72 +
    items.reduce((total, item) => total + 84 + (item.listed > item.sold ? 30 : 0), 0) +
    30 +
    (reduction ? 84 : 0) +
    90 +
    50 +
    60 +
    (business.tagline ? 40 : 0) +
    (socials.length ? Math.ceil(socials.length / 2) * 32 + 10 : 0) +
    70;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  const text = (
    value: string,
    x: number,
    y: number,
    options: { size?: number; style?: string; color?: string; align?: CanvasTextAlign } = {},
  ) => {
    context.font = `${options.style ?? ""} ${options.size ?? 22}px ${font}`.trim();
    context.fillStyle = options.color ?? "#10241F";
    context.textAlign = options.align ?? "left";
    context.fillText(value, x, y);
  };

  const fit = (value: string, maxWidth: number, fontSpec: string) => {
    context.font = fontSpec;
    if (context.measureText(value).width <= maxWidth) return value;
    let trimmed = value;
    while (trimmed.length > 1 && context.measureText(`${trimmed}…`).width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    return `${trimmed}…`;
  };

  const dashed = (y: number) => {
    context.strokeStyle = "#CBD9D5";
    context.lineWidth = 2;
    context.setLineDash([8, 8]);
    context.beginPath();
    context.moveTo(pad, y);
    context.lineTo(width - pad, y);
    context.stroke();
    context.setLineDash([]);
  };

  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = color;
  context.fillRect(0, 0, width, 190);

  context.save();
  context.beginPath();
  context.arc(pad + 50, 95, 50, 0, Math.PI * 2);
  context.closePath();
  context.fillStyle = "rgba(255,255,255,.95)";
  context.fill();
  context.clip();
  if (logo) {
    const side = Math.min(logo.width, logo.height);
    context.drawImage(
      logo,
      (logo.width - side) / 2,
      (logo.height - side) / 2,
      side,
      side,
      pad,
      45,
      100,
      100,
    );
  }
  context.restore();

  if (!logo) {
    const company = business.businessName || business.stallName;
    text(
      company
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase())
        .join("") || "Q",
      pad + 50,
      108,
      { size: 34, style: "bold", color, align: "center" },
    );
  }

  const textX = pad + 126;
  const maxWidth = width - textX - pad;
  text(fit(business.stallName, maxWidth, `bold 38px ${font}`), textX, 92, {
    size: 38,
    style: "bold",
    color: "#fff",
  });
  text(
    fit([business.category, business.location].filter(Boolean).join(" · "), maxWidth, `20px ${font}`),
    textX,
    126,
    { size: 20, color: "rgba(255,255,255,.9)" },
  );
  if (business.phone) text(business.phone, textX, 156, { size: 20, color: "rgba(255,255,255,.9)" });

  let y = 250;
  text("RECEIPT", pad, y, { size: 30, style: "bold", color });
  text(receiptNumber(sale.id), width - pad, y, { size: 24, color: "#6B7F7A", align: "right" });
  y += 46;
  text("Date", pad, y, { size: 21, color: "#6B7F7A" });
  text(receiptDate(sale), width - pad, y, { size: 21, align: "right" });
  if (sale.customerName) {
    y += 36;
    text("Customer", pad, y, { size: 21, color: "#6B7F7A" });
    text(fit(sale.customerName, 380, `21px ${font}`), width - pad, y, { size: 21, align: "right" });
  }
  y += 36;
  text("Paid with", pad, y, { size: 21, color: "#6B7F7A" });
  text(sale.paymentMethod || "Cash", width - pad, y, { size: 21, align: "right" });
  y += 30;
  dashed(y);
  y += 18;

  items.forEach((item) => {
    y += 38;
    text(fit(item.name, width - 2 * pad - 200, `bold 25px ${font}`), pad, y, {
      size: 25,
      style: "bold",
    });
    text(formatUGX(item.sold * item.qty), width - pad, y, {
      size: 25,
      style: "bold",
      align: "right",
    });
    y += 32;
    text(`${item.qty} × ${formatUGX(item.sold)}`, pad, y, { size: 20, color: "#6B7F7A" });
    if (item.listed > item.sold) {
      y += 30;
      text(`Special price (was ${formatUGX(item.listed)})`, pad, y, {
        size: 19,
        color: "#16A34A",
      });
    }
    y += 14;
  });

  y += 12;
  dashed(y);
  if (reduction) {
    y += 44;
    text("Subtotal", pad, y, { size: 22, color: "#6B7F7A" });
    text(formatUGX(sale.total + reduction), width - pad, y, { size: 22, align: "right" });
    y += 40;
    text("You saved", pad, y, { size: 22, color: "#16A34A" });
    text(`− ${formatUGX(reduction)}`, width - pad, y, {
      size: 22,
      color: "#16A34A",
      align: "right",
    });
  }

  y += 58;
  text("TOTAL", pad, y, { size: 30, style: "bold" });
  text(formatUGX(sale.total), width - pad, y, { size: 36, style: "bold", color, align: "right" });
  y += 70;
  text(
    `Thank you for shopping with ${fit(business.stallName, 420, `bold 24px ${font}`)}!`,
    width / 2,
    y,
    { size: 24, style: "bold", align: "center" },
  );
  if (business.tagline) {
    y += 40;
    text(`“${fit(business.tagline, 560, `italic 21px ${font}`)}”`, width / 2, y, {
      size: 21,
      style: "italic",
      color: "#6B7F7A",
      align: "center",
    });
  }
  for (let index = 0; index < socials.length; index += 2) {
    y += index === 0 ? 42 : 32;
    text(socials.slice(index, index + 2).join("   ·   "), width / 2, y, {
      size: 19,
      color: "#3F5953",
      align: "center",
    });
  }
  y += 56;
  text("Made with Quonnect Vendor", width / 2, y, { size: 17, color: "#9FB3AE", align: "center" });

  return canvas;
}

export function downloadCanvas(canvas: HTMLCanvasElement, saleId: string) {
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `receipt-${receiptNumber(saleId)}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function shareCanvas(canvas: HTMLCanvasElement, saleId: string, stallName: string) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return false;
  const file = new File([blob], `receipt-${receiptNumber(saleId)}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Receipt ${receiptNumber(saleId)}`,
        text: `Receipt from ${stallName}`,
      });
      return true;
    } catch {
      return false;
    }
  }
  downloadCanvas(canvas, saleId);
  return false;
}
