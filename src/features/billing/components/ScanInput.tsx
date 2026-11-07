"use client";

import { useRef, useState } from "react";
import { Barcode } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ApiError } from "@/lib/api-client";
import { useAddTagItem } from "@/features/billing/hooks/useAddTagItem";

// A physical barcode gun is a keyboard emulator - it types the code and hits
// Enter, same as this input handles manual typing. The input is never disabled
// while a lookup runs: that would drop focus, and lose the next scan if it came
// before the lookup finished. Scans wait in a queue instead, which also keeps
// bill lines in scan order and lets the duplicate-tag check see earlier scans.
export function ScanInput() {
  const [code, setCode] = useState("");
  const [soldTagCode, setSoldTagCode] = useState<string | null>(null);
  const addTagItem = useAddTagItem();
  const inputRef = useRef<HTMLInputElement>(null);
  const scanQueue = useRef(Promise.resolve());

  const processScan = async (scanned: string) => {
    try {
      await addTagItem.mutateAsync(scanned);
    } catch (error) {
      // 409 here only ever means "already sold" - see useAddTagItem's own
      // onError, which skips its generic toast for this exact case so it
      // doesn't fire alongside this popup.
      if (error instanceof ApiError && error.status === 409) {
        setSoldTagCode(scanned);
      } else if (inputRef.current?.value === "") {
        // Put a failed code back, selected: a typed code can be corrected, and
        // the next scan replaces it rather than being added onto the end.
        setCode(scanned);
        requestAnimationFrame(() => inputRef.current?.select());
      }
    } finally {
      // Only when focus is nowhere - if the cashier has moved on to another
      // field, taking focus back would send their typing into this box.
      if (document.activeElement === document.body) {
        inputRef.current?.focus();
      }
    }
  };

  const submit = () => {
    const scanned = code.trim();
    if (!scanned) return;
    setCode("");
    scanQueue.current = scanQueue.current.then(() => processScan(scanned));
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
