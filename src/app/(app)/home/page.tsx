import { HomeScreen } from "@/components/screens/HomeScreen";
import { requireVendor } from "@/lib/auth";
import { loadHome } from "@/lib/data";
import { addDays, clampDateRange, currentMonthKey, monthList, todayKey } from "@/lib/format";

export const metadata = { title: "Home · Quonnect Vendor" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, vendor } = await requireVendor();
  const today = todayKey();

  const requestedRange = one(params.range);
  const range = requestedRange === "30d" || requestedRange === "custom" ? requestedRange : "7d";
  let from = range === "30d" ? addDays(today, -29) : addDays(today, -6);
  let to = today;

  if (range === "custom") {
    const rawFrom = one(params.from);
    const rawTo = one(params.to);
    const valid = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
    const start = valid(rawFrom) ? rawFrom! : addDays(today, -13);
    const end = valid(rawTo) && rawTo! <= today ? rawTo! : today;
    const clamped = clampDateRange(start, end, 60);
    from = clamped.from;
    to = clamped.to;
  }

  const requestedMonth = one(params.month);
  const month = requestedMonth && monthList(12).includes(requestedMonth)
    ? requestedMonth
    : currentMonthKey();

  const data = await loadHome(supabase, vendor.id, month, from, to);

  return <HomeScreen data={data} month={month} range={range} from={from} to={to} />;
}
