"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function BackButton({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => router.back()}
      className={cn("-ml-2 h-8 shrink-0 gap-1 px-2 text-sm font-medium text-muted-foreground hover:text-foreground", className)}
    >
      <ChevronLeft className="h-4 w-4" />
      Back
    </Button>
  );
}
