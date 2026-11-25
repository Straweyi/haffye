"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { saveProductAction, uploadProductImageAction } from "@/app/actions/admin";
import { Feedback, useAdminAction } from "@/components/admin/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductImage } from "@/components/ui/product-image";

interface ProductFormProps {
  categories: { id: string; name: string }[];
  product?: {
    id: string;
    category_id: string | null;
    name: string;
    description: string;
    image_url: string | null;
    base_price: number;
    sweetness_options: string[];
    ice_options: string[];
    is_available: boolean;
  };
}

export function ProductForm({ categories, product }: ProductFormProps) {
  const router = useRouter();
  const { pending, fb, run } = useAdminAction();
  const [uploading, startUpload] = useTransition();
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const fd = new FormData();
    fd.append("file", file);
    startUpload(async () => {
      const res = await uploadProductImageAction(fd);
      if (res.error) setUploadError(res.error);
      else if (res.url) setImageUrl(res.url);
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const catRaw = String(fd.get("category_id") ?? "");
    const payload = {
      id: product?.id,
      category_id: catRaw === "" ? null : catRaw,
      name: String(fd.get("name") ?? ""),
      description: String(fd.get("description") ?? ""),
      image_url: imageUrl,
      base_price: String(fd.get("base_price") ?? "0"),
      sweetness_options: String(fd.get("sweetness_options") ?? ""),
      ice_options: String(fd.get("ice_options") ?? ""),
      is_available: fd.get("is_available") === "on",
    };

    run(
      () => saveProductAction(payload),
      (res) => {
        if (!res.error && !product && res.id) {
          router.push(`/admin/products/${res.id}`);
        }
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-semibold text-coffee">
        <span className="mb-1 block">Product Name</span>
        <Input name="name" defaultValue={product?.name ?? ""} required placeholder="e.g. Haffye Aren Latte" />
      </label>

      <label className="block text-xs font-semibold text-coffee">
        <span className="mb-1 block">Category</span>
        <select
          name="category_id"
          defaultValue={product?.category_id ?? ""}
          className="h-11 w-full rounded-xl border border-coffee/20 bg-warm px-3 text-sm font-normal text-charcoal outline-none focus:border-caramel"
        >
          <option value="">— Uncategorized —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-semibold text-coffee">
        <span className="mb-1 block">Base Price (IDR)</span>
        <Input
          name="base_price"
          type="number"
          min="0"
          step="500"
          defaultValue={product?.base_price ?? 20000}
          required
        />
      </label>

      <label className="flex items-center gap-2 pt-6 text-sm font-medium text-espresso">
        <input
          type="checkbox"
          name="is_available"
          defaultChecked={product?.is_available ?? true}
          className="h-4 w-4 accent-[#6F4E37]"
        />
        Available globally
      </label>

      <label className="block text-xs font-semibold text-coffee sm:col-span-2">
        <span className="mb-1 block">Description</span>
        <textarea
          name="description"
          rows={2}
          defaultValue={product?.description ?? ""}
          placeholder="Short description shown in catalog…"
          className="w-full rounded-xl border border-coffee/20 bg-warm p-3 text-sm font-normal text-charcoal outline-none focus:border-caramel"
        />
      </label>

      <label className="block text-xs font-semibold text-coffee">
        <span className="mb-1 block">Sweetness options (comma-separated)</span>
        <Input
          name="sweetness_options"
          defaultValue={(product?.sweetness_options ?? ["Normal", "Less Sweet", "No Sugar"]).join(", ")}
          placeholder="Normal, Less Sweet, No Sugar"
        />
      </label>

      <label className="block text-xs font-semibold text-coffee">
        <span className="mb-1 block">Ice options (comma-separated)</span>
        <Input
          name="ice_options"
          defaultValue={(product?.ice_options ?? ["Normal Ice", "Less Ice", "Hot"]).join(", ")}
          placeholder="Normal Ice, Less Ice, Hot"
        />
      </label>

      <div className="space-y-2 sm:col-span-2">
        <span className="block text-xs font-semibold text-coffee">Product Image (URL or Upload to Supabase Storage)</span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-coffee/15 bg-cream">
            <ProductImage src={imageUrl || null} alt="Preview" sizes="64px" />
          </div>
          <div className="min-w-[200px] flex-1 space-y-2">
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://... or upload below"
            />
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-coffee/25 bg-cream px-3 py-1.5 text-xs font-semibold text-espresso hover:bg-caramel/20">
              <Upload className="h-3.5 w-3.5 text-caramel" />
              {uploading ? "Uploading…" : "Upload JPG / PNG / WebP (max 2MB)"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>
        {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <Feedback fb={fb} />
        <div>
          <Button type="submit" disabled={pending || uploading}>
            {pending ? "Saving…" : product ? "Save Product" : "Create Product & Configure Sizes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
