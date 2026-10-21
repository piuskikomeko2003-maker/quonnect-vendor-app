# Acceptance report

Date: 2026-10-21
Branch: `feat/ui-rebuild`
Environment: macOS, Next.js 16.3.5, Supabase project `akfktjvckvlfclkwjppn` (unreachable from this machine)

## Automated checks

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS (0 errors, 0 warnings) |
| `npm run build` | PASS |
| Playwright 430px screenshots, all screens | PASS, 0 console errors |
| Visual review vs `quonnect-vendor-app.html` | PASS after fixes (header, headings, chip icon layout, auth hero, chart date labels, receipt) |
| `npm run test:acceptance` | BLOCKED — project DNS `NXDOMAIN`; no `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` |

Screenshots are in `docs/ui-checks/` (`app-*.png` and `prototype-*.png` side by side, plus sheets/cart/receipt).

## Database acceptance tests (script ready)

`scripts/acceptance-tests.ts` covers:

1. Create two vendors through Supabase Auth + signup trigger.
2. Create jeans (27,000 price / 16,000 cost / 9 stock), sell one at 25,000.
3. Assert stock 8, profit 9,000, price reduction 2,000, sale-item snapshots 27,000 / 25,000 / 16,000.
4. Assert Home `price_reduction` = 2,000.
5. Add a 500,000 `Stock purchase` expense and assert Home net profit is unchanged.
6. Add a 100,000 `Transport` expense and assert the day's net profit is negative (red bar input).
7. Assert the previous-month dropdown data differs.
8. Publish, hide and discount a product and verify the persisted state.
9. RLS: vendor B cannot select/update/insert vendor A rows and cannot call `create_sale` for vendor A.

Run once a reachable project and service-role key are available:

```bash
npm run test:acceptance
```

## Code-verified rules

- Atomic sale + stock decrement + `stock_movements`: `create_sale` (SECURITY INVOKER, row locks, stock check).
- Restock + optional stock-purchase expense: `restock_product`.
- Net profit excludes `Stock purchase` in Home, daily series, monthly series and Analytics.
- Price override snapshots and receipt "You saved" logic.
- Receipt canvas/share/download/WhatsApp text (`src/lib/receipt.ts`), visually checked.
- RLS policies for `vendors`, `products`, `sales`, `sale_items`, `finance_entries`, `stalls`, `stock_movements`, `budgets`; product public-read policy removed.

## Not run

- Live signup → logout → login round trip.
- Real RLS isolation against the live database.
- Month dropdown / profit ranges against seeded production data.
- Any test that requires Supabase Auth email delivery.

These all require a reachable Supabase project. The blocker is environmental, not a failing assertion.
