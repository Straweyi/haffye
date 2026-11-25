"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OfflineRetryButton() {
  return (
    <Button onClick={() => window.location.reload()} className="mt-6">
      <RefreshCw className="h-4 w-4" />
      Try Again
    </Button>
  );
}
