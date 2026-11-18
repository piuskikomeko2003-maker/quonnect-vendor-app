"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMonthStartDayAction } from "@/actions/settings";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

function ordinal(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

export function MonthRangeSettings({ monthStartDay }: { monthStartDay: number }) {
  const router = useRouter();
  const toast = useToast();
  const [day, setDay] = useState(monthStartDay);
  const [busy, setBusy] = useState(false);

  const range =
    day === 1
      ? "the 1st to the end of each month"
      : `the ${ordinal(day)} to the ${ordinal(day - 1)} of the next month`;

  async function save() {
    setBusy(true);
    const result = await updateMonthStartDayAction(day);
    setBusy(false);
    if (!result.ok) {
      toast(result.error ?? "Could not save month range");
      return;
    }
    toast("Profit month updated");
    router.refresh();
  }

  return (
    <div className="subpage-card">
      <div className="subpage-row">
        <span className="ci">
          <Icon name="calendar" size={19} />
        </span>
        <span className="grow">
          <b>Profit month</b>
          <small>Monthly profit runs from {range}</small>
        </span>
        <select
          value={day}
          aria-label="Day the profit month starts"
          onChange={(event) => setDay(Number(event.target.value))}
          disabled={busy}
          style={{ width: "auto", minWidth: 92 }}
        >
          {DAYS.map((value) => (
            <option value={value} key={value}>
              {ordinal(value)}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "0 16px 16px" }}>
        <small className="grow" style={{ color: "var(--mut)", fontSize: 11.5, lineHeight: 1.5 }}>
          Used for the monthly profit card and its month-on-month arrow. Defaults to calendar months.
        </small>
        {day !== monthStartDay ? (
          <button
            type="button"
            className="btn"
            style={{ width: "auto", flexShrink: 0, padding: "9px 18px" }}
            onClick={save}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
