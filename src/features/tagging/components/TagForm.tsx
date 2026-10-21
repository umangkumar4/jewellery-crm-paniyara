"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/lib/api-client";
import { METALS } from "@/lib/metals";
import { createTagSchema, type CreateTagFormValues, type CreateTagInput } from "@/schemas/tag.schema";
import { useCreateTag, type Tag } from "@/features/tagging/hooks/useCreateTag";
import { useMetalPurities } from "@/features/settings/hooks/useMetalPurities";

export function TagForm({ onCreated }: { onCreated: (tag: Tag) => void }) {
  const createTag = useCreateTag();
  const [formError, setFormError] = useState<string | null>(null);
  const [metal, setMetal] = useState<string>(METALS[0]);

  const { data: purities } = useMetalPurities({ metal });

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateTagFormValues, unknown, CreateTagInput>({
    resolver: zodResolver(createTagSchema),
    defaultValues: {
      product_name: "",
      purity_id: "",
      gross_wt_g: 0,
      stone_wt_g: 0,
      net_wt_g: 0,
    },
  });

  // react-hook-form's watch() isn't memoizable, so the compiler skips
  // auto-memoizing this component - expected, not a correctness issue.
  // eslint-disable-next-line react-hooks/incompatible-library
  const currentPurityId = watch("purity_id");

  // Purity options depend on the selected metal (a purely client-side
  // filter, not part of the submitted form - metal isn't a field on
  // createTagSchema anymore, purity_id already identifies it). Only reset
  // the selection when it's no longer valid for the current options -
  // otherwise an unrelated background refetch of `purities` (e.g. someone
  // editing a different purity in Settings) would silently discard
  // whatever the user already picked (mirrors MetalRateForm.tsx's pattern).
  useEffect(() => {
    if (!purities) return;
    const stillValid = purities.some((p) => p.id === currentPurityId);
    if (!stillValid) {
      setValue("purity_id", purities[0]?.id ?? "");
    }
  }, [purities, currentPurityId, setValue]);

  const grossWtG = watch("gross_wt_g");
  const stoneWtG = watch("stone_wt_g");

  useEffect(() => {
    // Rounded to 3dp, not 2 - gross/stone weights are routinely entered to
    // 3 decimal places (milligram precision), and rounding to 2dp could
    // both lose a real digit and round the wrong way (e.g. 22.972 - 2.067
    // = 20.905, which at 2dp incorrectly became 20.91, not just a shorter
    // 20.9). See src/features/billing/components/ItemTable.tsx's identical
    // fix for the same formula.
    const net = Math.max(0, (Number(grossWtG) || 0) - (Number(stoneWtG) || 0));
    setValue("net_wt_g", Math.round(net * 1000) / 1000);
  }, [grossWtG, stoneWtG, setValue]);

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    createTag.mutate(values, {
      onSuccess: (tag) => {
        toast.success(`Tag ${tag.code} created`);
        reset();
        setMetal(METALS[0]);
        onCreated(tag);
      },
      onError: (error) => {
        if (error instanceof ApiError) {
          if (error.fields) {
            for (const [field, message] of Object.entries(error.fields)) {
              setError(field as keyof CreateTagInput, { message });
            }
            return;
          }
          setFormError(error.message);
          return;
        }
        setFormError("Something went wrong. Please try again.");
      },
    });
  });

  const hasPurities = !!purities && purities.length > 0;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="product_name">Product Name</Label>
        <Input id="product_name" placeholder="e.g. Gold Ring - floral" {...register("product_name")} />
        {errors.product_name ? (
          <p className="mt-1.5 text-xs text-destructive">{errors.product_name.message}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="metal">Metal</Label>
          <Select id="metal" value={metal} onChange={(e) => setMetal(e.target.value)}>
            {METALS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="purity_id">Purity</Label>
          <Select id="purity_id" disabled={!hasPurities} {...register("purity_id")}>
            {hasPurities ? (
              purities!.map((purity) => (
                <option key={purity.id} value={purity.id}>
                  {purity.purity}
                </option>
              ))
            ) : (
              <option value="">No purities yet</option>
            )}
          </Select>
          {!hasPurities ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              No active purities for {metal} yet - add one in Settings.
            </p>
          ) : null}
          {errors.purity_id ? (
            <p className="mt-1.5 text-xs text-destructive">{errors.purity_id.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="gross_wt_g">Gross Wt (g)</Label>
          <Input
            id="gross_wt_g"
            type="number"
            step="0.01"
            min="0"
            {...register("gross_wt_g", { valueAsNumber: true })}
          />
          {errors.gross_wt_g ? (
            <p className="mt-1.5 text-xs text-destructive">{errors.gross_wt_g.message}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="stone_wt_g">Stone Wt (g)</Label>
          <Input
            id="stone_wt_g"
            type="number"
            step="0.01"
            min="0"
            {...register("stone_wt_g", { valueAsNumber: true })}
          />
          {errors.stone_wt_g ? (
            <p className="mt-1.5 text-xs text-destructive">{errors.stone_wt_g.message}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="net_wt_g">Net Wt (g)</Label>
          <Input
            id="net_wt_g"
            type="number"
            step="0.01"
            min="0"
            {...register("net_wt_g", { valueAsNumber: true })}
          />
          {errors.net_wt_g ? (
            <p className="mt-1.5 text-xs text-destructive">{errors.net_wt_g.message}</p>
          ) : null}
        </div>
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Button type="submit" disabled={createTag.isPending || !hasPurities} className="w-full uppercase">
        {createTag.isPending ? "Creating…" : "Create Tag & Print Label"}
      </Button>
    </form>
  );
}
