import Link from "next/link";

export const metadata = { title: "Terms of Service — Skillet" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <Link href="/profile" className="text-sm font-semibold text-[var(--color-coral)]">
        ← Back to Profile
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Terms of Service</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Last updated August 2026</p>

      <section className="mt-8">
        <h2 className="text-lg font-bold">Photos are for representation only</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">
          Recipe photos shown in Skillet are sourced from a general food-photo library and are
          intended to give you a general sense of a dish&apos;s style and ingredients. They are{" "}
          <strong className="text-[var(--color-ink)]">not photos of the specific recipe</strong>{" "}
          as written on this app, and your finished dish will vary based on the exact ingredients,
          quantities, and technique in the recipe steps. Don&apos;t rely on a photo to judge
          portion size, plating, or exact ingredients — use the recipe card itself for that.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Pricing and cost estimates</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">
          Ingredient prices and recipe cost estimates are approximate, based on general Ontario,
          Canada retail averages. Actual prices vary by store, region, brand, and time. Use these
          figures for budgeting guidance, not as a guarantee of what you&apos;ll spend.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Nutrition information</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">
          Calorie, protein, carb, and fat values are estimates and shouldn&apos;t be treated as
          medical or dietary advice. If you have specific health or allergy concerns, verify
          ingredients and nutrition independently before cooking.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Use at your own judgment</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">
          Skillet is a planning tool. Always use your own judgment around food safety, cooking
          temperatures, and ingredient substitutions — especially for allergies or dietary
          restrictions.
        </p>
      </section>
    </div>
  );
}
