"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TYPES = [
  { key: "orders", label: "Orders CSV" },
  { key: "payments", label: "Payments CSV" },
  { key: "inventory", label: "Inventory Movements CSV" },
  { key: "audit", label: "Audit Logs CSV" },
] as const;

export function ExportPanel() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const hrefFor = (type: string) => {
    const q = new URLSearchParams({ type });
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return `/api/admin/export?${q.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-coffee">
          <span className="mb-1 block">From date (optional)</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block text-xs font-semibold text-coffee">
          <span className="mb-1 block">To date (optional)</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <a key={t.key} href={hrefFor(t.key)}>
            <Button type="button" variant="outline" size="sm">
              <Download className="h-3.5 w-3.5 text-caramel" />
              {t.label}
            </Button>
          </a>
        ))}
      </div>
    </div>
  );
}
