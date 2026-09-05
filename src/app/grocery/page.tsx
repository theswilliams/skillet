"use client";

import { useCallback, useEffect, useState } from "react";
import { ShoppingCart, RefreshCw, Store, Trophy, Check, X, ShoppingBasket } from "lucide-react";
import { Spinner, EmptyState, SecondaryButton, PrimaryButton, SectionCard } from "@/components/ui";
import { CATEGORY_ICONS } from "@/components/categoryIcons";
import { CATEGORY_LABELS, type GroceryListDTO, type GroceryItemDTO, type StoreComparisonDTO } from "@/lib/types";

export default function GroceryPage() {
  const [list, setList] = useState<GroceryListDTO | null | undefined>(undefined);
  const [regenerating, setRegenerating] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [storeComparison, setStoreComparison] = useState<StoreComparisonDTO | null>(null);
  const [showStores, setShowStores] = useState(false);

  const load = useCallback(() => {
    fetch("/api/grocery-list")
      .then((r) => r.json())
      .then((d) => setList(d.list));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function regenerateFromPlan() {
    setRegenerating(true);
    const planRes = await fetch("/api/meal-plan").then((r) => r.json());
    let plan = planRes.plan;
    if (!plan) {
      plan = await fetch("/api/meal-plan", { method: "POST" }).then((r) => r.json()).then((d) => d.plan);
    }
    const res = await fetch("/api/grocery-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealPlanId: plan.id }),
    }).then((r) => r.json());
    setList(res.list);
    setRegenerating(false);
  }

  async function toggleChecked(item: GroceryItemDTO) {
    setList((l) => l && { ...l, items: l.items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)) });
    await fetch(`/api/grocery-list/item/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked: !item.checked }),
    });
    load();
  }

  async function removeItem(id: string) {
    setList((l) => l && { ...l, items: l.items.filter((i) => i.id !== id) });
    await fetch(`/api/grocery-list/item/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleStoreComparison() {
    if (!showStores) {
      const res = await fetch(`/api/grocery-list/compare-stores?listId=${list?.id}`).then((r) => r.json());
      setStoreComparison(res);
    }
    setShowStores((s) => !s);
  }

  async function addCustomItem() {
    if (!list || !newItemName.trim()) return;
    await fetch("/api/grocery-list/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groceryListId: list.id, name: newItemName.trim() }),
    });
    setNewItemName("");
    load();
  }

  if (list === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-[var(--color-coral)]" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <h1 className="text-xl font-extrabold tracking-tight">Grocery List</h1>
        <EmptyState
          icon={<ShoppingCart size={36} strokeWidth={1.5} />}
          title="No grocery list yet"
          subtitle="Build a meal plan first, then generate your list from it."
          action={
            <PrimaryButton onClick={regenerateFromPlan} disabled={regenerating} className="mt-2">
              {regenerating ? "Generating…" : "Generate from Meal Plan"}
            </PrimaryButton>
          }
        />
      </div>
    );
  }

  const categories = Object.entries(list.grouped).filter(([, items]) => items.length > 0);
  const pct = list.items.length ? Math.round((list.items.filter((i) => i.checked).length / list.items.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Grocery List</h1>
        <SecondaryButton onClick={regenerateFromPlan} disabled={regenerating}>
          {regenerating ? (
            "…"
          ) : (
            <>
              <RefreshCw size={14} strokeWidth={2.25} /> Regenerate
            </>
          )}
        </SecondaryButton>
      </div>

      <SectionCard className="mt-4 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            {list.items.filter((i) => i.checked).length}/{list.items.length} checked
          </span>
          <span className="font-bold">${list.totalCost.toFixed(2)} estimated</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
          <div className="h-full rounded-full bg-[var(--color-mint)] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <button onClick={toggleStoreComparison} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--color-coral)] underline underline-offset-2">
          {showStores ? (
            "Hide store comparison"
          ) : (
            <>
              <Store size={13} strokeWidth={2.25} /> Compare prices across stores
            </>
          )}
        </button>
        {showStores && (
          <div className="mt-3 border-t border-[var(--color-line)] pt-3">
            {!storeComparison ? (
              <div className="flex justify-center py-4">
                <Spinner className="h-5 w-5 text-[var(--color-coral)]" />
              </div>
            ) : (
              <>
                <p className="mb-2 text-[11px] text-[var(--color-ink-soft)]">
                  Estimated total for your unchecked items at each store. Store pricing is modeled from typical category
                  positioning, not a live feed — see Terms for details.
                </p>
                <div className="flex flex-col gap-1.5">
                  {storeComparison.comparison.map((c) => (
                    <div
                      key={c.store}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                        c.store === storeComparison.cheapestStore ? "bg-[var(--color-mint-light)] font-bold text-[var(--color-mint)]" : "bg-[var(--color-cream)]"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.store === storeComparison.cheapestStore && <Trophy size={13} strokeWidth={2.25} />}
                        {c.store}
                      </span>
                      <span>${c.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </SectionCard>

      <div className="mt-4 flex gap-2">
        <input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
          placeholder="Add a custom item..."
          className="flex-1 rounded-xl border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-coral)]"
        />
        <SecondaryButton onClick={addCustomItem}>Add</SecondaryButton>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {categories.map(([cat, items]) => {
          const CategoryIcon = CATEGORY_ICONS[cat] ?? ShoppingBasket;
          return (
          <div key={cat}>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">
              <CategoryIcon size={14} strokeWidth={2} /> {CATEGORY_LABELS[cat] ?? cat}
            </p>
            <ul className="flex flex-col divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-white">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleChecked(item)}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                      item.checked ? "border-[var(--color-mint)] bg-[var(--color-mint)] text-white" : "border-[var(--color-line)]"
                    }`}
                  >
                    {item.checked && <Check size={13} strokeWidth={3} />}
                  </button>
                  <div className={`min-w-0 flex-1 ${item.checked ? "opacity-40 line-through" : ""}`}>
                    <p className="truncate text-sm font-semibold">
                      {item.name} <span className="font-normal text-[var(--color-ink-soft)]">— {item.quantity} {item.unit}</span>
                    </p>
                    {item.usedInRecipes && <p className="truncate text-xs text-[var(--color-ink-soft)]">used in: {item.usedInRecipes}</p>}
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-[var(--color-ink-soft)]">
                    {item.estimatedCost > 0 ? `$${item.estimatedCost.toFixed(2)}` : ""}
                  </span>
                  <button onClick={() => removeItem(item.id)} className="shrink-0 text-[var(--color-ink-soft)]">
                    <X size={15} strokeWidth={2.25} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          );
        })}
      </div>
    </div>
  );
}
