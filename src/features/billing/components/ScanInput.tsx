"use client";

import { useState } from "react";
import { Barcode } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ApiError } from "@/lib/api-client";
import { useAddTagItem } from "@/features/billing/hooks/useAddTagItem";

// A physical barcode gun is a keyboard emulator - it types the code and
// hits Enter. This same input works identically for manual typing, which
// is the only mode available right now (no scanner gun on hand yet).
export function ScanInput() {
  const [code, setCode] = useState("");
  const [soldTagCode, setSoldTagCode] = useState<string | null>(null);
  const addTagItem = useAddTagItem();

  const submit = () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    addTagItem.mutate(trimmed, {
      onSuccess: () => setCode(""),
      onError: (error) => {
        // 409 here only ever means "already sold" - see useAddTagItem's own
        // onError, which skips its generic toast for this exact case so it
        // doesn't fire alongside this popup.
        if (error instanceof ApiError && error.status === 409) {
          setSoldTagCode(trimmed);
        }
      },
    });
  };

  return (
    <>
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

      <Dialog open={soldTagCode !== null} onClose={() => setSoldTagCode(null)} title="Tag Already Sold">
        <p className="text-sm text-muted-foreground">
          Tag <span className="font-semibold text-foreground">{soldTagCode}</span> has already been sold
          and can&apos;t be added to this bill.
        </p>
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={() => setSoldTagCode(null)}>
            OK
          </Button>
        </div>
      </Dialog>
    </>
  );
}
