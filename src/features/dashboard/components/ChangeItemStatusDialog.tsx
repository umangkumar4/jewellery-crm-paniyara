"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { SelectField } from "@/components/ui/SelectField";
import { useChangeOldJewelleryItemStatus } from "@/features/dashboard/hooks/useOldJewelleryItems";
import type { OldJewelleryItemListRow } from "@/features/dashboard/hooks/useOldJewelleryItems";

const STATUS_OPTIONS = [
  { label: "Disposed", value: "DISPOSED" as const },
  { label: "Melted", value: "MELTED" as const },
];

export interface ChangeItemStatusDialogProps {
  item: OldJewelleryItemListRow;
  onClose: () => void;
}

// No `open` prop, same convention as AddOldJewelleryItemDialog - the caller
// mounts this only while actively changing one item's status, so useState's
// initializer runs fresh every time it's opened for a (possibly different)
// item.
export function ChangeItemStatusDialog({ item, onClose }: ChangeItemStatusDialogProps) {
  const [status, setStatus] = useState<"DISPOSED" | "MELTED">("DISPOSED");
  const [reason, setReason] = useState("");

  const { mutate, isPending, error } = useChangeOldJewelleryItemStatus();

  const hasReason = reason.trim().length > 0;

  const handleSave = () => {
    if (!hasReason) return;
    mutate(
      { id: item.id, input: { status, reason: reason.trim() } },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onClose={onClose} title="Change Item Status" className="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {item.description} — {item.metal} {item.purity}, {item.net_wt_g.toFixed(3)} g
        </p>

        <div>
          <Label htmlFor="item-status">New Status</Label>
          <SelectField
            inputId="item-status"
            options={STATUS_OPTIONS}
            value={STATUS_OPTIONS.find((o) => o.value === status) ?? null}
            onChange={(option) => setStatus(option?.value ?? "DISPOSED")}
          />
        </div>

        <div>
          <Label htmlFor="item-status-reason">Reason *</Label>
          <Input id="item-status-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          {!hasReason ? <p className="mt-1.5 text-xs text-destructive">A reason is required</p> : null}
        </div>

        {error ? <p className="text-xs text-destructive">{error.message}</p> : null}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={!hasReason || isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Dialog>
  );
}
