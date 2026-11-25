"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Award, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { updateCustomerProfileAction } from "@/app/actions/customer";
import { useCustomer } from "@/components/providers/customer-provider";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validators/customer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ProfileView({ email }: { email?: string }) {
  const { preferences } = useCustomer();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      full_name: preferences.fullName,
      phone: preferences.phone,
      search_radius_km: preferences.searchRadiusKm,
    },
  });

  const onSubmit = (values: UpdateProfileInput) => {
    start(async () => {
      const res = await updateCustomerProfileAction(values);
      setFeedback(res);
    });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-espresso">My Profile</h1>

      {/* Loyalty Card */}
      <Card className="bg-espresso text-cream">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-caramel">HAFFYE Rewards</p>
            <p className="mt-1 text-2xl font-bold">{preferences.pointsBalance} Points</p>
            <p className="text-xs text-cream/75">
              Lifetime earned: {preferences.lifetimePoints} pts
            </p>
          </div>
          <Award className="h-10 w-10 text-caramel" />
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-coffee">Email</label>
              <Input value={email ?? ""} disabled />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-coffee">Full Name</label>
              <Input {...register("full_name")} placeholder="Your name" />
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

            <div>
              <label className="mb-1 block text-xs font-semibold text-coffee">
                Default Search Radius (km)
              </label>
              <Input
                {...register("search_radius_km")}
                type="number"
                step="0.5"
                min="0.5"
                max="50"
              />
              {errors.search_radius_km && (
                <p className="mt-1 text-xs text-red-600">{errors.search_radius_km.message}</p>
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

      <form action={logoutAction}>
        <Button type="submit" variant="outline" className="w-full">
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </form>
    </div>
  );
}
