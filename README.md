# Skillet — Personal Food Optimizer

A Pinterest-meets-Tinder meal planner: swipe to discover recipes, plan a budget-first week that maximizes ingredient reuse ("Cook Once, Eat 3 Times"), and generate a consolidated grocery list.

## Stack

- **Next.js 15** (App Router) + **TypeScript** — one deployable codebase for UI + API routes.
- **Prisma + Postgres** (Neon, provisioned via Vercel's marketplace integration) — `directUrl` in `prisma/schema.prisma` points at Neon's unpooled connection for schema push/migrate, while the app runtime uses the pooled `DATABASE_URL`.
- **Tailwind CSS v4** for styling, **Framer Motion** for the swipe/drag interactions.
- No auth: everything hangs off one demo user (`src/lib/currentUser.ts`) so there's no login flow to build. The schema is already multi-user — swapping in real auth is a session-lookup change, not a data model change.

## Deployment

Live on Vercel, project `redress69/skillet`, with a Neon Postgres database connected via Vercel's Storage integration (`vercel integration add neon`). `DATABASE_URL` / `DATABASE_URL_UNPOOLED` are injected automatically into the Vercel project's env — no manual secret management.

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

- `npm run db:reset` — wipes and reseeds the database.
- `npm run build` — production build (also runs `prisma generate`).

## What's deterministic vs. AI-ready

Per the architecture goals, cost math, grocery consolidation, ingredient-overlap ("efficiency"), pantry matching, and meal-plan generation are all **plain algorithms** — no LLM calls, fully explainable. See `src/lib/services/`:

- `cost.ts` — recipe cost from ingredient quantities × price.
- `efficiency.ts` — the "Cook Once, Eat 3 Times" ingredient-overlap %.
- `pantry.ts` — pantry matching / "Use What I Have".
- `grocery.ts` — ingredient consolidation across a week's recipes.
- `recommend.ts` — rule-based taste profile from swipe/save/cook interactions.
- `planner.ts` — greedy budget + taste + overlap meal-plan generator.
- `nlSearch.ts` — deterministic NL query parser; `interpretQuery()` is the seam where an LLM-backed parser can be swapped in later without touching callers.

## Data

- 158 seed ingredients with mock CAD pricing (`prisma/data/ingredients.ts`).
- 77 seed recipes across 9 cuisines (`prisma/data/recipes.ts`), each with real ingredient quantities/units so cost, nutrition-adjacent stats, and grocery lists are all computed, not hardcoded.

## Known MVP simplifications

- Single demo user, no auth.
- Pricing is static seed data, not a live grocery API (the `IngredientPrice` model supports multiple sources for when that's added).
- No real food photography — cards use generated gradient + emoji art (`Recipe.imageUrl` exists in the schema for when photos are added).

## Neon quick reference

- Dashboard: `vercel integration open neon skillet-db` (or the Vercel Storage tab).
- Reseed production data: pull `DATABASE_URL`/`DATABASE_URL_UNPOOLED` into `.env` (see above) and run `npm run db:reset`.
