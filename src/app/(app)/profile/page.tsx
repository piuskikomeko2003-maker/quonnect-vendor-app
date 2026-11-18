"use client";

import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { useVendor } from "@/components/app/VendorProvider";
import { usePageTitle } from "@/lib/query";

export default function ProfilePage() {
  usePageTitle("Profile · Quonnect Vendor");
  const { vendor, stall } = useVendor();

  return (
    <>
      <h1 className="page-title">My profile</h1>
      <p className="page-subtitle">Your business details</p>
      <ProfileScreen data={{ vendor, stall }} />
    </>
  );
}
