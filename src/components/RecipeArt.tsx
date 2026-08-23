"use client";

import { useState } from "react";

/**
 * Recipe card art. Renders a real food photo (Recipe.imageUrl, sourced from
 * Wikimedia Commons — see scripts/fetch-recipe-images.ts) when one is
 * available, laid over the gradient so a slow-loading image never shows a
 * blank flash. Falls back to the generated gradient + emoji treatment when
 * there's no photo, or if the photo URL fails to load.
 */
export function RecipeArt({
  hue,
  emoji,
  imageUrl,
  className = "",
  size = "md",
}: {
  hue: number;
  emoji: string;
  imageUrl?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [errored, setErrored] = useState(false);
  const emojiSize = size === "lg" ? "text-8xl" : size === "sm" ? "text-3xl" : "text-6xl";
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
          <span className={`${emojiSize} drop-shadow-lg select-none`} style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.25))" }}>
            {emoji}
          </span>
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
