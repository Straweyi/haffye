"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Coffee, LogOut, Store, TrendingUp } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { updateBaristaProfileAction } from "@/app/actions/barista";
import { useBarista } from "@/components/providers/barista-provider";
import { baristaProfileSchema } from "@/lib/validators/barista";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { VendorStatusHistoryItem } from "@/types/domain";
import type { z } from "zod";

type ProfileFormValues = z.infer<typeof baristaProfileSchema>;

export function BaristaProfileView({
  email,
  initialFullName,
  initialPhone,
  history,
}: {
  email?: string;
  initialFullName: string;
  initialPhone: string;
  history: VendorStatusHistoryItem[];
}) {
  const { vendor } = useBarista();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(baristaProfileSchema),
    defaultValues: { full_name: initialFullName, phone: initialPhone },
  });

  const onSubmit = (values: ProfileFormValues) => {
    start(async () => {
      const res = await updateBaristaProfileAction(values);
      setFeedback(res);
    });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-espresso">Barista Profile</h1>

      {/* Quick Mobile Links to Products & Revenue */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        <Link href="/barista/products">
          <Button variant="outline" className="w-full">
            <Coffee className="h-4 w-4 text-caramel" />
            Menu Availability
          </Button>
        </Link>
        <Link href="/barista/revenue">
          <Button variant="outline" className="w-full">
            <TrendingUp className="h-4 w-4 text-caramel" />
            Revenue
          </Button>
        </Link>
      </div>

      {/* Assigned Vendor */}
      <Card className="bg-espresso text-cream">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-caramel">Assigned Cart</p>
            <p className="mt-1 text-lg font-bold">
              {vendor ? `${vendor.name} (${vendor.code})` : "Unassigned"}
            </p>
            {vendor?.vehicle_label && (
              <p className="text-xs text-cream/75">{vendor.vehicle_label}</p>
            )}
          </div>
          <Store className="h-9 w-9 text-caramel" />
        </CardContent>
      </Card>

      {/* Account form */}
      <Card>
        <CardHeader>
          <CardTitle>Operator Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-coffee">Email</label>
              <Input value={email ?? ""} disabled />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-coffee">Full Name</label>
              <Input {...register("full_name")} />
              {errors.full_name && (
                <p className="mt-1 text-xs text-red-600">{errors.full_name.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-coffee">Phone</label>
              <Input {...register("phone")} placeholder="08..." />
              {errors.phone && (
                <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
              )}
            </div>

            {feedback.error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                {feedback.error}
              </p>
            )}
            {feedback.message && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {feedback.message}
              </p>
            )}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Saving…" : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Status History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Status History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <div className="divide-y divide-coffee/10">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between py-2 text-xs">
                  <Badge
                    variant={
                      h.status === "ACTIVE" ? "active" : h.status === "BUSY" ? "busy" : "offline"
                    }
                  >
                    {h.status}
                  </Badge>
                  <span className="text-coffee">
                    {new Date(h.created_at).toLocaleString("id-ID")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-coffee">No status changes recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <form action={logoutAction}>
        <Button type="submit" variant="outline" className="w-full">
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </form>
    </div>
  );
}
