# Skillet

A budget-first meal planner: swipe through recipes, generate a week of dinners that fits a weekly budget while reusing ingredients, and get one consolidated grocery list with pantry items subtracted. The planning, costing and recommendation logic is **plain, deterministic code (no LLM)** so results are reproducible and explainable.

**Live demo:** https://skillet-five.vercel.app (one shared demo account, visible to every visitor, reset daily: please don't enter personal information; the app says so on every page)

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
`npm test` runs **195 Vitest tests in 8 files**: unit conversion and cost math, ingredient efficiency, grocery consolidation, pantry matching, the meal planner (budget adherence, cook-time and disliked-ingredient filters, meal type, cuisine preference), taste profile and scoring, request validation, the **SSRF guard for recipe import** (every private/reserved IPv4 and IPv6 range and address form, redirects to internal hosts, DNS-rebinding, size, content-type and timeout limits, and a real-socket test proving the transport never connects to an internal address), the image-host allowlist, the shared-demo notice, the barcode-scan route (fixed host, digits-only barcode, timeout, no redirects), the rate limiter, and the cron endpoint's fail-closed authorization. Last run: 195 passed. `npm run lint` and `tsc --noEmit` are clean, and GitHub Actions runs lint, type-check, tests, a **production build** and a Gitleaks secret scan.
Not covered: React components, the database-backed API routes end to end, and the seed data.

## Tech Stack
Next.js 15 (patched 15.5.x), React 19, TypeScript, Prisma + PostgreSQL (Neon), Zod, Tailwind CSS v4, Framer Motion, Vitest, ESLint, GitHub Actions, Vercel (with Cron). Data sources: Wikimedia Commons (images), Open Food Facts (barcodes).

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
- Recipe import is best-effort; some sites block automated fetches. It is hardened against SSRF: only http(s) on ports 80/443, no embedded credentials; hostnames are resolved by a guarded DNS lookup at connect time and every address must be public (so DNS rebinding can't swap in an internal address); every redirect hop is re-validated (max 3); 8 s total deadline; HTML only, uncompressed, 2 MB cap; imports are capped at 60 ingredient lines. Imported recipe images are kept only from allow-listed hosts (Wikimedia Commons); other images fall back to the gradient card. Responses carry baseline security headers (nosniff, no framing, strict referrer policy, CSP `img-src`).
- Only some API routes validate request bodies with Zod (import, pantry, meal plan); the rest still trust their input.
- Scaling limit: recipe listing, search and planning routes load the whole recipe catalog (with ingredients) per request and filter in memory: fine for ~300 recipes, not for a large catalog.
- The rate limiter is in-memory and per serverless instance, so it is a speed bump rather than a hard limit. The API is unauthenticated by design (single shared demo user), so anyone can change demo data until the daily reset.
- `npm audit` reports 5 findings (1 moderate, 4 high) that only major upgrades (Next 16 for PostCSS, Prisma 7 for `deepmerge-ts`) can clear; they are in build-time tooling, not request-handling code. Next.js is on a patched 15.5 release.

## Future Development
Zod validation for the remaining routes, real authentication, real price data, a shared-store rate limiter, and database-backed route tests.
