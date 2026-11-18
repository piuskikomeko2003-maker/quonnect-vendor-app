"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { useVendor } from "@/components/app/VendorProvider";
import { usePageTitle } from "@/lib/query";

const FAQ = [
  {
    q: "How do I record a sale?",
    a: "Open Add Sale from the home screen or the Menu. Tap products to add them to the cart, adjust the sold price if needed, then tap Record sale.",
  },
  {
    q: "How do I add a product?",
    a: "Use Add Product on the home screen, or open My Stall and tap Add product. Add a name, photos, sizes, colours, cost, price and quantity.",
  },
  {
    q: "How is profit calculated?",
    a: "Profit is sales minus the cost of goods, minus running costs, plus other income. Stock purchases are already counted in the cost of each item.",
  },
  {
    q: "How do I change my stall appearance?",
    a: "Open My Stall from the bottom navigation and tap Customise to change the stall name, tagline and accent colour.",
  },
];

export default function HelpPage() {
  usePageTitle("Help & support · Quonnect Vendor");
  const { vendor } = useVendor();

  return (
    <>
      <h1 className="page-title">Help &amp; support</h1>
      <p className="page-subtitle">Answers and ways to reach the Quonnect team</p>

      <div className="subpage-card">
        {vendor.phone ? (
          <Link className="subpage-row" href={`tel:${vendor.phone.replace(/[^\d+]/g, "")}`}>
            <span className="ci">
              <Icon name="phone" size={19} />
            </span>
            <span className="grow">
              <b>Call support</b>
              <small>{vendor.phone}</small>
            </span>
            <Icon name="chevr" size={16} />
          </Link>
        ) : null}
        {vendor.email ? (
          <Link className="subpage-row" href={`mailto:${vendor.email}`}>
            <span className="ci">
              <Icon name="mail" size={19} />
            </span>
            <span className="grow">
              <b>Email support</b>
              <small>{vendor.email}</small>
            </span>
            <Icon name="chevr" size={16} />
          </Link>
        ) : null}
        {vendor.whatsapp ? (
          <Link
            className="subpage-row"
            href={`https://wa.me/${vendor.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="ci">
              <Icon name="whatsapp" size={19} />
            </span>
            <span className="grow">
              <b>WhatsApp support</b>
              <small>{vendor.whatsapp}</small>
            </span>
            <Icon name="chevr" size={16} />
          </Link>
        ) : null}
      </div>

      <div className="subpage-card">
        {FAQ.map((item) => (
          <details className="faq-item" key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </>
  );
}
