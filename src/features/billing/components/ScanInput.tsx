"use client";

import { useState } from "react";
import { Barcode } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useAddTagItem } from "@/features/billing/hooks/useAddTagItem";

// A physical barcode gun is a keyboard emulator - it types the code and
// hits Enter. This same input works identically for manual typing, which
// is the only mode available right now (no scanner gun on hand yet).
export function ScanInput() {
  const [code, setCode] = useState("");
  const addTagItem = useAddTagItem();

  const submit = () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    addTagItem.mutate(trimmed, { onSuccess: () => setCode("") });
  };

  return (
    <Input
      value={code}
      onChange={(e) => setCode(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      }}
      placeholder="Scan or type tag code, then press Enter"
      leadingIcon={<Barcode className="h-4 w-4" />}
      disabled={addTagItem.isPending}
      autoFocus
    />
  );
}
