# Skillet — Personal Food Optimizer

**[Live demo →](https://skillet-five.vercel.app)**

A Pinterest-meets-Tinder meal planner: swipe to discover recipes, plan a budget-first week that maximizes ingredient reuse ("Cook Once, Eat 3 Times"), and generate a consolidated grocery list — with pantry tracking, barcode scanning, live store price comparison, and recipe import from any URL.

This is a solo-built showcase project, not a production app with real users — see [Showcase notes](#showcase-notes) for what that means in practice.

## Features

- **Swipe discovery** — Tinder-style card deck of recipes (like/pass/save), personalized by a taste profile built from your swipe/save/cook history.
- **Budget-first meal planning** — generates a week of dinners that fits a weekly budget, favors your preferred cuisines, and deliberately clusters ingredient overlap ("Cook Once, Eat 3 Times") without collapsing into one cuisine.
- **Smart grocery lists** — consolidates a week's recipes into one shopping list, subtracts what's already in your pantry, and estimates total cost.
- **Live store price comparison** — see the same grocery list priced across multiple grocery chains.
- **Pantry tracking** — log what you have, with expiration-date tracking and reminders; **barcode scanning** (native `BarcodeDetector` API + Open Food Facts lookup) to add items by scanning instead of typing.
- **"Use What I Have"** — surfaces recipes you can make with a *majority* of the primary ingredients on hand (protein, starch, etc.), not just recipes you have every single ingredient for.
- **Recipe import from any URL** — paste a link to a recipe on the open web and Skillet parses its schema.org `Recipe` structured data straight into your own collection (the same technique used by apps like Paprika).
- **277 original recipes across 17 cuisines**, each with real ingredient quantities/units, so cost, nutrition, and grocery consolidation are all *computed*, not hardcoded.

## Architecture: deterministic by design

The product principle behind Skillet is that cost, planning, and matching logic should be plain, explainable algorithms — not LLM calls — so results are reproducible and debuggable. Every core algorithm lives in `src/lib/services/` as pure, framework-free functions:

| File | What it does |
|---|---|
| [`cost.ts`](src/lib/services/cost.ts) | Recipe cost from ingredient quantities × price. |
| [`efficiency.ts`](src/lib/services/efficiency.ts) | The "Cook Once, Eat 3 Times" ingredient-overlap %. |
| [`planner.ts`](src/lib/services/planner.ts) | Greedy budget + taste + overlap meal-plan generator — picks each day's recipe to maximize `(taste score + ingredient-overlap bonus) / cost`, with a capped, decaying bonus so cuisine reuse stays intentional instead of collapsing into a monoculture. |
| [`recommend.ts`](src/lib/services/recommend.ts) | Rule-based taste profile from swipe/save/cook interactions, with log-dampened score saturation and cuisine-interleaved ranking so the swipe deck stays varied even as the profile strengthens. |
| [`pantry.ts`](src/lib/services/pantry.ts) | Pantry matching, including majority-of-primary-ingredients "Use What I Have". |
| [`grocery.ts`](src/lib/services/grocery.ts) | Ingredient consolidation across a week's recipes. |
| [`pricing.ts`](src/lib/services/pricing.ts) | Multi-store price comparison. |
| [`recipeImport.ts`](src/lib/services/recipeImport.ts) | schema.org `Recipe` JSON-LD parsing for URL import. |
| [`nlSearch.ts`](src/lib/services/nlSearch.ts) | Deterministic NL query parser; `interpretQuery()` is the seam where an LLM-backed parser could be swapped in later without touching call sites. |

## Stack

- **Next.js 15** (App Router) + **TypeScript** — one deployable codebase for UI + API routes.
- **Prisma + Postgres** (Neon, provisioned via Vercel's marketplace integration) — `directUrl` in `prisma/schema.prisma` points at Neon's unpooled connection for schema push/migrate, while the app runtime uses the pooled `DATABASE_URL`.
- **Tailwind CSS v4** for styling, **Framer Motion** for the swipe/drag interactions.
- **Wikimedia Commons** for recipe photography (free, no API key, no redistribution concerns) and **Open Food Facts** for barcode → product lookup — both free public data sources, no paid API keys required to run this yourself.
- No auth: everything hangs off one demo user (`src/lib/currentUser.ts`) so there's no login flow to build. The schema is already multi-user — swapping in real auth is a session-lookup change, not a data model change.

## Showcase notes

This is a portfolio piece, not a live product accepting real users, which shapes a few deliberate decisions:

- **Single shared demo account.** Everyone who opens the live link uses the same account (`demo@skillet.app`), so there's no sign-up flow to build for a project not intended to hold real user data. Because visitors can edit that shared state, [`demoReset.ts`](src/lib/services/demoReset.ts) resets it to a curated baseline — sane preferences, a stocked pantry with a couple of items expiring soon, and a spread of liked/cooked/saved recipes across cuisines — daily via a [Vercel Cron job](vercel.json) (`/api/cron/reset-demo`, gated by a `CRON_SECRET`).
- **Mock store pricing.** `pricing.ts` generates deterministic multi-store price variance rather than calling real grocery APIs, which require paid retail partnerships not available for a personal project.
- **Recipe photos are representational, not literal** — sourced from Wikimedia Commons by dish name/cuisine, not photographed for these exact recipes. Disclosed in-app under [Terms](src/app/terms/page.tsx).
- **Recipe import is best-effort.** It works reliably against sites that don't block automated requests (verified against food.com); some sites' bot protection blocks the fetch entirely, which is a real, accepted limitation rather than something worth working around.

## Running it locally

```bash
npm install
```

Create `.env` with a Postgres connection string (a local Postgres, a Neon branch, or `vercel env pull .env` if you have access to the linked project):

```
DATABASE_URL="postgresql://..."
DATABASE_URL_UNPOOLED="postgresql://..."  # same DB, non-pooled — used for db push/migrate
```

```bash
npx prisma db push
npm run db:seed
npm run dev
```

Visit `http://localhost:3000`.

- `npm run db:reset` — wipes and reseeds the database with all 277 recipes.
- `npm run demo:reset` — resets just the demo user to the curated showcase state (pantry, preferences, taste history) without touching the recipe catalog.
- `npm run build` — production build (also runs `prisma generate`).

## Data

- 258 seed ingredients with mock CAD pricing (`prisma/data/ingredients.ts`).
- 277 original recipes across 17 cuisines (`prisma/data/recipes*.ts`), each with real ingredient quantities/units.
- Recipe photography resolved from Wikimedia Commons at seed time and hand-audited for relevance (`prisma/data/images.ts`, `scripts/fetch-recipe-images.ts`).

## Deployment

Live on Vercel, project `redress69/skillet`, with a Neon Postgres database connected via Vercel's Storage integration (`vercel integration add neon`). `DATABASE_URL` / `DATABASE_URL_UNPOOLED` are injected automatically into the Vercel project's env — no manual secret management.

### Neon quick reference

- Dashboard: `vercel integration open neon skillet-db` (or the Vercel Storage tab).
- Reseed production data: pull `DATABASE_URL`/`DATABASE_URL_UNPOOLED` into `.env` (see above) and run `npm run db:reset`.

## License

MIT — see [LICENSE](LICENSE).
