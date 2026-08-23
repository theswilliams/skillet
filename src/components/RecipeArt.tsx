"use client";

/**
 * Generated "food photography" card art. No external image hosting is wired
 * up for the MVP (Recipe.imageUrl exists in the schema for when real photos
 * are added), so every card gets a distinctive gradient + emoji treatment
 * derived deterministically from the recipe's hue — keeps the UI visual and
 * consistent without a photo pipeline.
 */
export function RecipeArt({
  hue,
  emoji,
  className = "",
  size = "md",
}: {
  hue: number;
  emoji: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const emojiSize = size === "lg" ? "text-8xl" : size === "sm" ? "text-3xl" : "text-6xl";
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 120% at 20% 15%, hsl(${hue} 90% 72%) 0%, hsl(${hue} 80% 58%) 45%, hsl(${(hue + 24) % 360} 70% 42%) 100%)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 30%, white 0%, transparent 40%), radial-gradient(circle at 80% 80%, black 0%, transparent 45%)",
        }}
      />
      <span className={`${emojiSize} drop-shadow-lg select-none`} style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.25))" }}>
        {emoji}
      </span>
    </div>
  );
}
