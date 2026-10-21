import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { requireVendor } from "@/lib/auth";

export const metadata = { title: "Profile · Quonnect Vendor" };

export default async function ProfilePage() {
  const { vendor, stall } = await requireVendor();
  return <ProfileScreen data={{ vendor, stall }} />;
}
