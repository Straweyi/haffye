"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Package } from "lucide-react";
import { recordStockMovementAction } from "@/app/actions/barista";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BaristaInventoryItem, InventoryMovementItem } from "@/types/domain";

export function BaristaInventoryView({
  items,
  allIngredients,
  movements,
}: {
  items: BaristaInventoryItem[];
  allIngredients: { id: string; name: string; unit: string }[];
  movements: InventoryMovementItem[];
}) {
  const router = useRouter();
  const [ingredientId, setIngredientId] = useState(allIngredients[0]?.id ?? "");
  const [type, setType] = useState<"STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT">("STOCK_IN");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});

  const selectedIng = allIngredients.find((i) => i.id === ingredientId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback({});
    start(async () => {
      const res = await recordStockMovementAction({
        ingredientId,
        type,
        quantity,
        note,
      });
      setFeedback(res);
      if (!res.error) {
        setQuantity("");
        setNote("");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-espresso">Cart Inventory</h1>
        <p className="text-xs text-coffee">
          Track ingredients allocated to your cart. Negative stock is blocked by database constraints.
        </p>
      </div>

      {/* Stock Levels */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {items.map((item) => (
          <Card
            key={item.inventory_id}
            className={item.is_low ? "border-amber-300 bg-amber-50/70" : ""}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Package className="h-4 w-4 text-caramel" />
                {item.is_low && (
                  <Badge variant="busy" className="text-[10px]">
                    <AlertTriangle className="h-3 w-3" />
                    Low
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-xs font-semibold text-coffee">{item.ingredient_name}</p>
              <p className="mt-1 text-lg font-bold text-espresso">
                {item.quantity} <span className="text-xs font-medium text-coffee">{item.unit}</span>
              </p>
              <p className="text-[10px] text-coffee">Min: {item.low_stock_threshold} {item.unit}</p>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="p-6 text-center text-sm text-coffee">
              No inventory rows yet. Record a Stock-In below to allocate ingredients.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Record Stock Movement */}
      <Card>
        <CardHeader>
          <CardTitle>Record Stock Movement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-4">
            <select
              value={ingredientId}
              onChange={(e) => setIngredientId(e.target.value)}
              className="h-11 rounded-xl border border-coffee/20 bg-warm px-3 text-sm text-charcoal outline-none focus:border-caramel"
            >
              {allIngredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.unit})
                </option>
              ))}
            </select>

            <select
              value={type}
              onChange={(e) => setType(e.target.value as "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT")}
              className="h-11 rounded-xl border border-coffee/20 bg-warm px-3 text-sm text-charcoal outline-none focus:border-caramel"
            >
              <option value="STOCK_IN">Stock In (+)</option>
              <option value="STOCK_OUT">Stock Out (-)</option>
              <option value="ADJUSTMENT">Adjustment (+/-)</option>
            </select>

            <Input
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`Qty (${selectedIng?.unit ?? "unit"})`}
              required
            />

            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (e.g. Morning refill)"
            />

            {feedback.error && (
              <p className="text-xs font-medium text-red-600 sm:col-span-4">{feedback.error}</p>
            )}
            {feedback.message && (
              <p className="text-xs font-medium text-emerald-700 sm:col-span-4">
                {feedback.message}
              </p>
            )}

            <div className="sm:col-span-4">
              <Button type="submit" disabled={pending || !ingredientId}>
                {pending ? "Recording…" : "Apply Stock Movement"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Movement History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Inventory Movements</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length > 0 ? (
            <div className="divide-y divide-coffee/10">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                  <div className="flex items-center gap-2.5">
                    {m.quantity >= 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-amber-600" />
                    )}
                    <div>
                      <p className="font-semibold text-espresso">
                        {m.ingredient_name} · {m.type}
                      </p>
                      <p className="text-coffee">
                        {m.note || "No note"} ·{" "}
                        {new Date(m.created_at).toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`font-bold ${
                      m.quantity >= 0 ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.unit}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-coffee">No movements logged yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
