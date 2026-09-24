# Skillet

A budget-first meal planner: swipe through recipes, generate a week of dinners that fits a weekly budget while reusing ingredients, and get one consolidated grocery list with pantry items subtracted. The planning, costing and recommendation logic is **plain, deterministic code (no LLM)** so results are reproducible and explainable.

**Live demo:** https://skillet-five.vercel.app (one shared demo account; it resets daily)

> Portfolio project, not a product with users. Store prices are simulated (see *Current Status*).

<!-- TODO: Add screenshots: Discover (swipe deck), Plan (weekly plan + cost/efficiency), Grocery list, Pantry. -->

## Overview
Skillet answers "what should I cook this week for $X?" It builds a taste profile from what you swipe, save and cook, plans dinners that fit the budget, favours recipes that share ingredients ("Cook Once, Eat 3 Times"), and turns the plan into a shopping list.

## Why I Built It
*[Edit in your own words. Suggested:]* I wanted a project centred on algorithms and business rules rather than CRUD: a constrained optimisation problem (budget, taste, ingredient overlap), unit-aware cost math, and a recommendation loop, kept simple enough to test and explain.

## Key Features
- **Swipe discovery:** like/pass/save deck personalised by a taste profile that updates from your behaviour.
- **Budget-first weekly planner** with a cost-per-person and an ingredient-efficiency score.
- **Grocery list** consolidated across recipes, pantry subtracted, estimated total, per-store price comparison (simulated prices).
- **Pantry tracking** with expiry dates, barcode scanning (browser `BarcodeDetector` + Open Food Facts lookup), and **"Use What I Have"** matching on the majority of primary ingredients.
- **Recipe import from a URL** using schema.org `Recipe` JSON-LD.
- **Natural-language-style search** via a deterministic rule-based query parser.
- 277 original recipes across 17 cuisines with real quantities/units, so cost and nutrition are computed rather than hard-coded.

## Architecture
```
Browser ─► Next.js 15 (App Router pages + ~20 API routes)
              │  route handlers stay thin
              ▼
        src/lib/services/  (pure, framework-free algorithms)
        cost · efficiency · planner · recommend · pantry · grocery · pricing · recipeImport · nlSearch
              │
              ▼
        Prisma ─► PostgreSQL (Neon)   [users, recipes, ingredients, meal plans, pantry, interactions, …]
 Vercel Cron ─► /api/cron/reset-demo   (bearer-secret protected; restores the shared demo account daily)
```
Everything hangs off a single demo user (`lib/currentUser.ts`); the schema is already multi-user (all data keyed by `userId`).

## Technical Highlights
- **Planner** (`planner.ts`): filters by hard constraints (cook time, dietary tags, disliked ingredients), scores each candidate on taste + a capped ingredient-overlap bonus + a cuisine-variety adjustment, then fills days greedily: the first two days by best score, later days by score per dollar, within the remaining budget. It stops when nothing affordable is left. Known quirks: if the hard filters leave no recipes they are dropped rather than returning an empty plan, and the first pick isn't budget-checked.
- **Recommendation** (`recommend.ts`): rule-based taste profile with log-dampened saturation and cuisine-interleaved ranking so the deck stays varied.
- **Seams for change:** `interpretQuery()` is where an LLM-backed parser could replace the rule-based one without touching callers.
- **Data:** normalized ingredients with base-unit pricing, so recipes, plans and lists share one cost model.
- **Ops:** scheduled demo reset via Vercel Cron; Neon pooled URL at runtime, unpooled for migrations.

## Testing
`npm test` runs **60 Vitest tests in 4 files**: unit conversion and cost math, ingredient efficiency, grocery consolidation, pantry matching, the meal planner (budget adherence, cook-time and disliked-ingredient filters, meal type, cuisine preference), taste profile and scoring, request validation, the SSRF guard for recipe import, the rate limiter, and the cron endpoint's fail-closed authorization. Last run: 60 passed. `npm run lint` and `tsc --noEmit` are clean, and GitHub Actions runs lint, type-check and tests plus a Gitleaks secret scan.
Not covered: React components, the database-backed API routes end to end, and the seed data.

## Tech Stack
Next.js 15, React 19, TypeScript, Prisma + PostgreSQL (Neon), Zod, Tailwind CSS v4, Framer Motion, Vitest, ESLint, GitHub Actions, Vercel (with Cron). Data sources: Wikimedia Commons (images), Open Food Facts (barcodes).

## Demo
Live: https://skillet-five.vercel.app
Run locally: create `.env` with `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (Postgres), then:
```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
npm test
```

## Current Status
Completed personal portfolio project, deployed as a shared demo. Deliberate limits:
- **Single shared demo account,** no sign-up/login.
- **Store prices are generated** deterministically, not from real grocery APIs.
- Recipe photos are representative images from Wikimedia Commons, not photos of these exact dishes.
- Recipe import is best-effort; some sites block automated fetches. It only fetches public http(s) hosts (private/loopback/link-local addresses are blocked, redirects re-checked, 8 s timeout, 2 MB cap); DNS-rebinding is not fully mitigated.
- Only some API routes validate request bodies with Zod (import, pantry, meal plan); the rest still trust their input.
- The rate limiter is in-memory and per serverless instance, so it is a speed bump rather than a hard limit.

## Future Development
Zod validation for the remaining routes, real authentication, real price data, a shared-store rate limiter, and database-backed route tests.
