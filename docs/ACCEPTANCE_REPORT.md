# Acceptance report

Date: 2026-10-21
Branch: `feat/ui-rebuild`
Project: `akfktjvckvlfclkwjppn` (schema applied, migrations recorded)

## Automated checks

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS (0 errors, 0 warnings) |
| `npm run build` | PASS |
| `npm run test:unit` | PASS — 7 tests |
| `npm run test:acceptance` | **PASS — 19/19** |
| Playwright 430px screenshots, all screens | PASS, 0 console errors |
| Visual review vs `quonnect-vendor-app.html` | PASS after fixes |
| Live signup → confirm → login → logout → login | PASS, 0 console errors |

Screenshots are in `docs/ui-checks/`.

## Database acceptance tests

Run against the live project with two temporary vendors. Both test users and their cascaded rows were deleted afterwards.

| # | Test | Result |
| --- | --- | --- |
| 1 | Product created with stock 9 | PASS |
| 2 | Sale RPC succeeds | PASS |
| 3 | Stock drops to 8 | PASS |
| 4 | Sale total 25,000 | PASS |
| 5 | Sale profit 9,000 | PASS |
| 6 | Price reduction 2,000 | PASS |
| 7 | Sale item stores listed 27,000 / sold 25,000 / cost 16,000 | PASS |
| 8 | Home shows 2,000 price reductions | PASS |
| 9 | Stock-purchase expense does not change net profit | PASS |
| 10 | Loss day has negative net profit (red bar input) | PASS |
| 11 | Previous month figures differ | PASS |
| 12 | Product can be hidden | PASS |
| 13 | Product can be published with a discount | PASS |
| 14 | Vendor B cannot see vendor A | PASS |
| 15 | Vendor B cannot see vendor A products | PASS |
| 16 | Vendor B cannot update vendor A products | PASS |
| 17 | Vendor B cannot insert under vendor A | PASS |
| 18 | Vendor B cannot sell vendor A stock | PASS |

## Live application flow

- Created a real account through the 3-step signup form.
- Supabase email confirmation was enabled, so the app correctly showed “Check your inbox”.
- Confirmed the test user through the admin API (test-only), then logged in through `/login` → `/home`.
- Logged out from `/profile` → `/login`.
- Logged in again → `/home`.
- No console errors.

## Notes

1. Email confirmation is enabled in Supabase Auth. New users must confirm before logging in.
2. The existing `piuskikomeko2003@gmail.com` account had no signup metadata, so it was repaired with a placeholder `My Stall` vendor/stall. Set the real business name, category, location and logo in **Profile**.
3. The legacy `report_stock` RPC was removed because it allowed cross-vendor reads through a NULL viewer id.
4. Access tokens and service-role keys were used only for setup/testing and removed from `.env.local`.
