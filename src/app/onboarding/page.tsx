"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton, SecondaryButton, Chip, ProgressBar } from "@/components/ui";

const CUISINES = ["Italian", "Mexican", "Chinese", "Japanese", "Korean", "Thai", "Indian", "Mediterranean", "American", "French", "Spanish", "Vietnamese", "Filipino", "Caribbean", "African", "German", "Brazilian"];
const DIETARY = ["vegetarian", "vegan", "gluten-free", "dairy-free", "high-protein", "low-carb"];
const EQUIPMENT = [
  { value: "one-pan", label: "One Pan" },
  { value: "oven", label: "Oven" },
  { value: "slow-cooker", label: "Slow Cooker" },
  { value: "instant-pot", label: "Instant Pot" },
  { value: "air-fryer", label: "Air Fryer" },
  { value: "bbq", label: "BBQ" },
];
const PREP_LEVELS = [
  { value: "none", label: "Cook fresh each time" },
  { value: "moderate", label: "Some batch prep" },
  { value: "high", label: "Prep everything ahead" },
];

const STEPS = ["household", "budget", "cuisines", "dietary", "time", "equipment", "prep"] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const step: Step = STEPS[stepIdx];

  const [householdSize, setHouseholdSize] = useState(2);
  const [weeklyBudget, setWeeklyBudget] = useState(75);
  const [favoriteCuisines, setFavoriteCuisines] = useState<string[]>([]);
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState("");
  const [maxCookTime, setMaxCookTime] = useState(45);
  const [equipment, setEquipment] = useState<string[]>(["oven", "one-pan"]);
  const [mealPrepLevel, setMealPrepLevel] = useState("moderate");

  const toggle = (arr: string[], set: (v: string[]) => void, val: string) =>
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  async function finish() {
    setSaving(true);
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        householdSize,
        weeklyBudget,
        favoriteCuisines,
        dietaryTags,
        dislikedIngredients: dislikes.split(",").map((s) => s.trim()).filter(Boolean),
        maxCookTime,
        equipment,
        mealPrepLevel,
        onboardingComplete: true,
      }),
    });
    router.replace("/home");
  }

  function next() {
    if (stepIdx === STEPS.length - 1) finish();
    else setStepIdx((i) => i + 1);
  }
  function skip() {
    next();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <ProgressBar pct={((stepIdx + 1) / STEPS.length) * 100} />
      </div>

      {step === "household" && (
        <StepBlock title="How many people are you cooking for?" subtitle="We'll size portions and grocery quantities to match.">
          <NumberStepper value={householdSize} onChange={setHouseholdSize} min={1} max={8} suffix="people" />
        </StepBlock>
      )}

      {step === "budget" && (
        <StepBlock title="What's your weekly food budget?" subtitle="We'll build meal plans that try to stay under this.">
          <NumberStepper value={weeklyBudget} onChange={setWeeklyBudget} min={20} max={400} step={5} prefix="$" suffix="/ week" />
        </StepBlock>
      )}

      {step === "cuisines" && (
        <StepBlock title="Favorite cuisines?" subtitle="Optional — pick as many as you like.">
          <div className="flex flex-wrap gap-2">
            {CUISINES.map((c) => (
              <Chip key={c} active={favoriteCuisines.includes(c)} onClick={() => toggle(favoriteCuisines, setFavoriteCuisines, c)} tone="coral">
                {c}
              </Chip>
            ))}
          </div>
        </StepBlock>
      )}

      {step === "dietary" && (
        <StepBlock title="Any dietary preferences?" subtitle="Optional — we'll filter recipes to match.">
          <div className="flex flex-wrap gap-2">
            {DIETARY.map((d) => (
              <Chip key={d} active={dietaryTags.includes(d)} onClick={() => toggle(dietaryTags, setDietaryTags, d)} tone="mint">
                {d}
              </Chip>
            ))}
          </div>
          <label className="mt-6 block text-sm font-semibold text-[var(--color-ink)]">Foods you dislike (optional)</label>
          <input
            value={dislikes}
            onChange={(e) => setDislikes(e.target.value)}
            placeholder="e.g. mushroom, cilantro"
            className="mt-2 w-full rounded-xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--color-coral)]"
          />
        </StepBlock>
      )}

      {step === "time" && (
        <StepBlock title="Max cooking time on a normal night?" subtitle="We'll prioritize recipes that fit.">
          <NumberStepper value={maxCookTime} onChange={setMaxCookTime} min={10} max={120} step={5} suffix="min" />
        </StepBlock>
      )}

      {step === "equipment" && (
        <StepBlock title="What do you cook with?" subtitle="Optional — helps us match recipes to your kitchen.">
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT.map((e) => (
              <Chip key={e.value} active={equipment.includes(e.value)} onClick={() => toggle(equipment, setEquipment, e.value)} tone="gold">
                {e.label}
              </Chip>
            ))}
          </div>
        </StepBlock>
      )}

      {step === "prep" && (
        <StepBlock title="How do you like to meal prep?" subtitle="This tunes how much we lean into leftover-friendly recipes.">
          <div className="flex flex-col gap-2">
            {PREP_LEVELS.map((p) => (
              <button
                key={p.value}
                onClick={() => setMealPrepLevel(p.value)}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                  mealPrepLevel === p.value
                    ? "border-[var(--color-coral)] bg-[var(--color-coral-light)] text-[var(--color-coral-dark)]"
                    : "border-[var(--color-line)] bg-white text-[var(--color-ink)]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </StepBlock>
      )}

      <div className="mt-10 flex items-center gap-3">
        {stepIdx > 0 && <SecondaryButton onClick={() => setStepIdx((i) => i - 1)}>Back</SecondaryButton>}
        {step !== "household" && step !== "budget" && (
          <button onClick={skip} className="text-sm font-semibold text-[var(--color-ink-soft)] underline underline-offset-4">
            Skip
          </button>
        )}
        <div className="flex-1" />
        <PrimaryButton onClick={next} disabled={saving}>
          {stepIdx === STEPS.length - 1 ? (saving ? "Saving..." : "Let's Go") : "Next"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function StepBlock({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="animate-slide-up">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix = "",
  suffix = "",
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-center gap-6 rounded-2xl border border-[var(--color-line)] bg-white py-8">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-cream)] text-xl font-bold"
      >
        −
      </button>
      <div className="text-center">
        <p className="text-3xl font-extrabold tabular-nums">
          {prefix}
          {value}
        </p>
        {suffix && <p className="text-xs font-semibold text-[var(--color-ink-soft)]">{suffix}</p>}
      </div>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-cream)] text-xl font-bold"
      >
        +
      </button>
    </div>
  );
}
