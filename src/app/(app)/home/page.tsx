import Link from "next/link";
import { requireVendor } from "@/lib/auth";

export default async function HomePage() {
  const { vendor } = await requireVendor();

  return (
    <>
      <div className="hgrid">
        <div className="sc hl">
          <div className="t">
            <span>Sales today</span>
          </div>
          <b className="v">UGX 0</b>
          <span className="tr">&nbsp;</span>
        </div>
        <div className="sc">
          <div className="t">
            <span>Spent today</span>
          </div>
          <b className="v">UGX 0</b>
          <span className="tr">&nbsp;</span>
        </div>
        <div className="sc">
          <div className="t">
            <span>Net this month</span>
          </div>
          <b className="v">UGX 0</b>
          <span className="tr">&nbsp;</span>
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <div>
            <div className="ct">Welcome, {vendor.business_name}</div>
            <small>Your dashboard is being prepared.</small>
          </div>
        </div>
        <Link className="btn" href="/sell">
          Record a sale
        </Link>
      </div>
    </>
  );
}
