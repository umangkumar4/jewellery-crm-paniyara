"use client";

import { useRef, useState } from "react";
import { Barcode } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ApiError } from "@/lib/api-client";
import { useAddTagItem } from "@/features/billing/hooks/useAddTagItem";

// A physical barcode gun is a keyboard emulator - it types the code and
// hits Enter, same as this input handles manual typing. autoFocus only
// fires once on mount though, so after the cashier clicks into any other
// field on the page (customer details, an item's weight/rate cell), focus
// has to be explicitly returned here for the next scan to land correctly
// instead of corrupting whatever else is focused.
export function ScanInput() {
  const [code, setCode] = useState("");
  const [soldTagCode, setSoldTagCode] = useState<string | null>(null);
  const addTagItem = useAddTagItem();
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    addTagItem.mutate(trimmed, {
      onSuccess: () => {
        setCode("");
        inputRef.current?.focus();
      },
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

  const closeSoldPopup = () => {
    setSoldTagCode(null);
    inputRef.current?.focus();
  };

  return (
    <>
      <Input
        ref={inputRef}
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

      <Dialog open={soldTagCode !== null} onClose={closeSoldPopup} title="Tag Already Sold">
        <p className="text-sm text-muted-foreground">
          Tag <span className="font-semibold text-foreground">{soldTagCode}</span> has already been sold
          and can&apos;t be added to this bill.
        </p>
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={closeSoldPopup}>
            OK
          </Button>
        </div>
      </Dialog>
    </>
  );
}
