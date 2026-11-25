"use client";

import { useState } from "react";
import Image from "next/image";
import { Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

export function ProductImage({
  src,
  alt,
  className,
  sizes = "(max-width: 768px) 50vw, 33vw",
  priority = false,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center bg-cream text-coffee/60",
          className,
        )}
      >
        <Coffee className="h-8 w-8 text-caramel" />
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest">HAFFYE</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}
