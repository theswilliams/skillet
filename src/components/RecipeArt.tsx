"use client";

import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";

/**
 * Recipe card art. Renders a real food photo (Recipe.imageUrl, sourced from
 * Wikimedia Commons — see scripts/fetch-recipe-images.ts) when one is
 * available, laid over the gradient so a slow-loading image never shows a
 * blank flash. Falls back to the generated gradient + a plain line icon when
 * there's no photo, or if the photo URL fails to load — every seeded recipe
 * has a real photo, so this is a rare edge case, not the primary look.
 */
export function RecipeArt({
  hue,
  imageUrl,
  className = "",
  size = "md",
}: {
  hue: number;
  emoji?: string;
  imageUrl?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [errored, setErrored] = useState(false);
  const iconSize = size === "lg" ? 56 : size === "sm" ? 24 : 40;
  const showPhoto = !!imageUrl && !errored;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 120% at 20% 15%, hsl(${hue} 90% 72%) 0%, hsl(${hue} 80% 58%) 45%, hsl(${(hue + 24) % 360} 70% 42%) 100%)`,
      }}
    >
      {!showPhoto && (
        <>
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 30%, white 0%, transparent 40%), radial-gradient(circle at 80% 80%, black 0%, transparent 45%)",
            }}
          />
          <UtensilsCrossed size={iconSize} strokeWidth={1.5} className="text-white/85" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.2))" }} />
        </>
      )}
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={() => setErrored(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${errored ? "opacity-0" : "opacity-100"}`}
        />
      )}
    </div>
  );
}
