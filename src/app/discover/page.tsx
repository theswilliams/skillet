"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion, useMotionValue, useTransform, AnimatePresence, type PanInfo } from "framer-motion";
import { RecipeArt } from "@/components/RecipeArt";
import { Chip, Spinner, EmptyState, SecondaryButton } from "@/components/ui";
import type { RecipeDTO } from "@/lib/types";

async function logInteraction(recipeId: string, type: string) {
  fetch("/api/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipeId, type }),
  }).catch(() => {});
}

export default function DiscoverPage() {
  const [queue, setQueue] = useState<RecipeDTO[] | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/discover")
      .then((r) => r.json())
      .then((d) => setQueue(d.recipes));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecision = useCallback(
    (recipe: RecipeDTO, type: "liked" | "disliked" | "saved") => {
      logInteraction(recipe.id, type === "saved" ? "liked" : type);
      if (type === "saved") logInteraction(recipe.id, "saved");
      setQueue((q) => (q ? q.filter((r) => r.id !== recipe.id) : q));
      if (type === "saved") {
        setSavedFlash(recipe.name);
        setTimeout(() => setSavedFlash(null), 1200);
      }
    },
    [],
  );

  if (queue === null) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-[var(--color-coral)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 pt-6">
      <div className="mb-4 flex w-full items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Discover</h1>
        <span className="text-sm text-[var(--color-ink-soft)]">{queue.length} left</span>
      </div>

      <div className="relative h-[560px] w-full max-w-sm">
        <AnimatePresence>
          {queue.length === 0 ? (
            <EmptyState
              icon="🍽️"
              title="You've seen everything!"
              subtitle="Check back later for new recipes, or adjust your taste in Profile."
              action={
                <SecondaryButton onClick={load} className="mt-2">
                  Refresh
                </SecondaryButton>
              }
            />
          ) : (
            queue
              .slice(0, 3)
              .reverse()
              .map((recipe, i, arr) => (
                <SwipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isTop={i === arr.length - 1}
                  stackIndex={arr.length - 1 - i}
                  onDecision={handleDecision}
                />
              ))
          )}
        </AnimatePresence>
      </div>

      {queue.length > 0 && (
        <div className="mt-6 flex items-center justify-center gap-5">
          <RoundButton label="✕" tone="danger" onClick={() => queue[0] && handleDecision(queue[0], "disliked")} />
          <RoundButton label="⭐" tone="gold" small onClick={() => queue[0] && handleDecision(queue[0], "saved")} />
          <RoundButton label="♥" tone="success" onClick={() => queue[0] && handleDecision(queue[0], "liked")} />
        </div>
      )}

      <AnimatePresence>
        {savedFlash && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-white md:bottom-8"
          >
            Saved &quot;{savedFlash}&quot; ⭐
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SwipeCard({
  recipe,
  isTop,
  stackIndex,
  onDecision,
}: {
  recipe: RecipeDTO;
  isTop: boolean;
  stackIndex: number;
  onDecision: (r: RecipeDTO, type: "liked" | "disliked" | "saved") => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-18, 18]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -20], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 120) onDecision(recipe, "liked");
    else if (info.offset.x < -120) onDecision(recipe, "disliked");
  }

  return (
    <motion.div
      className="absolute inset-0 flex flex-col overflow-hidden rounded-3xl border border-[var(--color-line)] bg-[var(--color-card)] card-shadow-lg"
      style={isTop ? { x, rotate } : undefined}
      initial={{ scale: 1 - stackIndex * 0.04, y: stackIndex * 10, opacity: stackIndex > 1 ? 0 : 1 }}
      animate={{ scale: 1 - stackIndex * 0.04, y: stackIndex * 10, opacity: 1 }}
      exit={{ x: x.get() > 0 ? 400 : -400, opacity: 0, transition: { duration: 0.3 } }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={1}
      onDragEnd={isTop ? handleDragEnd : undefined}
      whileTap={isTop ? { cursor: "grabbing" } : undefined}
    >
      <div className="relative h-3/5 shrink-0">
        <RecipeArt hue={recipe.hue} emoji={recipe.emoji} imageUrl={recipe.imageUrl} size="lg" className="h-full w-full" />
        {isTop && (
          <>
            <motion.div style={{ opacity: likeOpacity }} className="absolute left-5 top-5 rotate-[-12deg] rounded-lg border-4 border-[var(--color-mint)] px-3 py-1 text-xl font-black text-[var(--color-mint)]">
              LIKE
            </motion.div>
            <motion.div style={{ opacity: nopeOpacity }} className="absolute right-5 top-5 rotate-[12deg] rounded-lg border-4 border-[var(--color-coral)] px-3 py-1 text-xl font-black text-[var(--color-coral)]">
              NOPE
            </motion.div>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold leading-tight">{recipe.name}</h2>
          <span className="shrink-0 rounded-full bg-[var(--color-cream)] px-2 py-1 text-xs font-bold">${recipe.costPerServing.toFixed(2)}</span>
        </div>
        <p className="line-clamp-2 text-sm text-[var(--color-ink-soft)]">{recipe.description}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Chip tone="neutral">⏱ {recipe.totalMinutes} min</Chip>
          <Chip tone="neutral">{recipe.servings} servings</Chip>
          <Chip tone="neutral">{recipe.cuisine}</Chip>
          <Chip tone="mint">{recipe.difficulty}</Chip>
        </div>
        <Link href={`/recipe/${recipe.slug}`} className="mt-1 text-xs font-bold text-[var(--color-coral)] underline underline-offset-2">
          View full recipe →
        </Link>
      </div>
    </motion.div>
  );
}

function RoundButton({
  label,
  tone,
  onClick,
  small,
}: {
  label: string;
  tone: "danger" | "success" | "gold";
  onClick: () => void;
  small?: boolean;
}) {
  const colors: Record<string, string> = {
    danger: "text-[var(--color-coral)] border-[var(--color-coral)]",
    success: "text-[var(--color-mint)] border-[var(--color-mint)]",
    gold: "text-[var(--color-gold)] border-[var(--color-gold)]",
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center rounded-full border-2 bg-white font-bold shadow-md transition-transform active:scale-90 ${colors[tone]} ${
        small ? "h-12 w-12 text-lg" : "h-16 w-16 text-2xl"
      }`}
    >
      {label}
    </button>
  );
}
