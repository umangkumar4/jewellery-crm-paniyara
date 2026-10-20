"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api-client";
import { METALS } from "@/lib/metals";
import { useMetalPurities, type MetalPurity } from "@/features/settings/hooks/useMetalPurities";

function formatUpdatedAt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function MetalRatesTable({ onEdit }: { onEdit: (purity: MetalPurity) => void }) {
  const { data, isLoading, isError, error } = useMetalPurities();

  const priced = data?.filter((purity) => purity.rate_per_gram !== null) ?? [];
  const groups = METALS.map((metal) => ({
    metal,
    purities: priced.filter((purity) => purity.metal === metal),
  })).filter((group) => group.purities.length > 0);

  return (
    <div className="panel mt-6 p-6">
      <h3 className="font-display text-xl text-foreground">Current Rates</h3>

      {isLoading ? (
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="mt-4 py-6 text-center text-sm text-destructive">
          {error instanceof ApiError ? error.message : "Failed to load rates."}
        </p>
      ) : !data || data.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">
          No purities yet - add one in the Add Purity tab.
        </p>
      ) : groups.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">No rates set yet - set one above.</p>
      ) : (
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {groups.map((group) => (
            <div key={group.metal} className="rounded-lg border border-border p-4">
              <h4 className="font-display text-base text-foreground">{group.metal}</h4>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                      <th className="py-2 pr-3 font-medium">Purity</th>
                      <th className="py-2 pr-3 font-medium">Rate/g</th>
                      <th className="py-2 pr-3 font-medium">Updated</th>
                      <th className="py-2 pr-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.purities.map((purity) => (
                      <tr key={purity.id} className="border-b border-border/60">
                        <td className="py-3 pr-3 text-foreground">{purity.purity}</td>
                        <td className="py-3 pr-3 text-muted-foreground">₹{purity.rate_per_gram}</td>
                        <td className="py-3 pr-3 text-muted-foreground">{formatUpdatedAt(purity.updated_at)}</td>
                        <td className="py-3 pr-3 text-right">
                          <Button type="button" variant="outline" size="icon" onClick={() => onEdit(purity)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
