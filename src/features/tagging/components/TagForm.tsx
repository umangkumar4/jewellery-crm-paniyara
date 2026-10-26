"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { SelectField } from "@/components/ui/SelectField";
import { toOptions } from "@/components/ui/react-select-styles";
import { WeightField } from "@/components/ui/WeightField";
import { ApiError } from "@/lib/api-client";
import { METALS } from "@/lib/metals";

const METAL_OPTIONS = toOptions(METALS);
import { createTagSchema, type CreateTagFormValues, type CreateTagInput } from "@/schemas/tag.schema";
import { useCreateTag, type Tag } from "@/features/tagging/hooks/useCreateTag";
import { useMetalPurities } from "@/features/settings/hooks/useMetalPurities";

export function TagForm({ onCreated }: { onCreated: (tag: Tag) => void }) {
  const createTag = useCreateTag();
  const [formError, setFormError] = useState<string | null>(null);
  const [metal, setMetal] = useState<string>(METALS[0]);
  // Separate string buffers for the two editable weight inputs, not derived
  // from the form's numeric field value on every render - deriving display
  // text from `Number(raw)` on each keystroke would collapse "2." back to
  // "2" the instant the decimal point is typed, making it impossible to
  // type a decimal at all. Same reasoning as useNumericStoreField.ts.
  const [grossDisplay, setGrossDisplay] = useState("0");
  const [stoneDisplay, setStoneDisplay] = useState("0");

  const { data: purities } = useMetalPurities({ metal });

  const {
    register,
    control,
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
    // shouldValidate: true - without it, setValue doesn't re-run validation,
    // so a stale error (e.g. from a previous failed submit) would keep
    // showing even after the user fixes the values that caused it.
    setValue("net_wt_g", Math.round(net * 1000) / 1000, { shouldValidate: true });
  }, [grossWtG, stoneWtG, setValue]);

  const netWtG = watch("net_wt_g");

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    createTag.mutate(values, {
      onSuccess: (tag) => {
        toast.success(`Tag ${tag.code} created`);
        reset();
        setGrossDisplay("0");
        setStoneDisplay("0");
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
  const purityOptions = useMemo(
    () => (purities ?? []).map((p) => ({ label: p.purity, value: p.id })),
    [purities],
  );

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
          <SelectField
            inputId="metal"
            options={METAL_OPTIONS}
            value={METAL_OPTIONS.find((o) => o.value === metal) ?? null}
            onChange={(option) => setMetal(option?.value ?? METALS[0])}
          />
        </div>

        <div>
          <Label htmlFor="purity_id">Purity</Label>
          <Controller
            control={control}
            name="purity_id"
            render={({ field }) => (
              <SelectField
                inputId="purity_id"
                isDisabled={!hasPurities}
                placeholder={hasPurities ? undefined : "No purities yet"}
                options={purityOptions}
                value={purityOptions.find((o) => o.value === field.value) ?? null}
                onChange={(option) => field.onChange(option?.value ?? "")}
              />
            )}
          />
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
          <WeightField
            id="gross_wt_g"
            value={grossDisplay}
            onValueChange={(raw) => {
              setGrossDisplay(raw);
              setValue("gross_wt_g", Number(raw) || 0, { shouldValidate: true });
            }}
          />
          {errors.gross_wt_g ? (
            <p className="mt-1.5 text-xs text-destructive">{errors.gross_wt_g.message}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="stone_wt_g">Stone Wt (g)</Label>
          <WeightField
            id="stone_wt_g"
            value={stoneDisplay}
            onValueChange={(raw) => {
              setStoneDisplay(raw);
              setValue("stone_wt_g", Number(raw) || 0, { shouldValidate: true });
            }}
          />
          {errors.stone_wt_g ? (
            <p className="mt-1.5 text-xs text-destructive">{errors.stone_wt_g.message}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="net_wt_g">Net Wt (g)</Label>
          {/* Auto-computed from gross - stone (see the useEffect above) -
              read-only so there's no way for a user to enter a value that
              then disagrees with it (createTagSchema's refine would reject
              that anyway, but this avoids a confusing submit error for what
              would otherwise look like a normal field). Plain Input, not
              NumberField - nothing ever types into it, so the leading-zero
              typing bug NumberField exists for doesn't apply here. */}
          <Input id="net_wt_g" readOnly value={String(netWtG)} />
          <p className="mt-1.5 text-xs text-muted-foreground">Auto-calculated: gross − stone weight.</p>
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
