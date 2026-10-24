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
import { ApiError } from "@/lib/api-client";
import { METALS, type Metal } from "@/lib/metals";

const METAL_OPTIONS = toOptions(METALS);
import { setMetalRateSchema, type SetMetalRateInput } from "@/schemas/metal-rate.schema";
import { useMetalPurities, type MetalPurity } from "@/features/settings/hooks/useMetalPurities";
import { useSetMetalRate } from "@/features/settings/hooks/useSetMetalRate";

interface MetalRateFormProps {
  editingPurity: MetalPurity | null;
  onSaved?: () => void;
}

export function MetalRateForm({ editingPurity, onSaved }: MetalRateFormProps) {
  const setRate = useSetMetalRate();
  const [formError, setFormError] = useState<string | null>(null);
  const [metal, setMetal] = useState<Metal>((editingPurity?.metal as Metal) ?? METALS[0]);

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
  } = useForm<SetMetalRateInput>({
    resolver: zodResolver(setMetalRateSchema),
    defaultValues: {
      metal: METALS[0],
      purity: "",
      rate_per_gram: 0,
      purchase_rate_per_gram: 0,
    },
  });

  useEffect(() => {
    if (editingPurity) {
      setMetal(editingPurity.metal as Metal);
      reset({
        metal: editingPurity.metal as Metal,
        purity: editingPurity.purity,
        rate_per_gram: editingPurity.rate_per_gram ?? 0,
        purchase_rate_per_gram: editingPurity.purchase_rate_per_gram ?? 0,
      });
    }
  }, [editingPurity, reset]);

  // eslint-disable-next-line react-hooks/incompatible-library -- see TagForm.tsx's identical note on watch()
  const currentPurity = watch("purity");

  // Runs once `purities` actually reflects the current `metal` (a fresh
  // query per metal, so this never fires against a stale/previous metal's
  // list) - keeps the selected purity valid whenever metal changes or an
  // edit target loads a purity that's no longer in the active list.
  useEffect(() => {
    if (!purities) return;
    const stillValid = purities.some((p) => p.purity === currentPurity);
    if (!stillValid) {
      setValue("purity", purities[0]?.purity ?? "");
    }
  }, [purities, currentPurity, setValue]);

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    setRate.mutate(values, {
      onSuccess: () => {
        toast.success(`${values.metal} ${values.purity} rate updated`);
        reset({ metal: METALS[0], purity: "", rate_per_gram: 0, purchase_rate_per_gram: 0 });
        setMetal(METALS[0]);
        onSaved?.();
      },
      onError: (error) => {
        if (error instanceof ApiError) {
          if (error.fields) {
            for (const [field, message] of Object.entries(error.fields)) {
              setError(field as keyof SetMetalRateInput, { message });
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
    () => (purities ?? []).map((p) => ({ label: p.purity, value: p.purity })),
    [purities],
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="rate-metal">Metal</Label>
          <SelectField
            inputId="rate-metal"
            options={METAL_OPTIONS}
            value={METAL_OPTIONS.find((o) => o.value === metal) ?? null}
            onChange={(option) => {
              const next = (option?.value ?? METALS[0]) as Metal;
              setMetal(next);
              setValue("metal", next);
            }}
          />
        </div>

        <div>
          <Label htmlFor="rate-purity">Purity</Label>
          <Controller
            control={control}
            name="purity"
            render={({ field }) => (
              <SelectField
                inputId="rate-purity"
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
              No active purities for {metal} yet - add one below.
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="rate-value">Sell Rate per gram (₹)</Label>
          <Input
            id="rate-value"
            type="number"
            step="0.01"
            min="0"
            {...register("rate_per_gram", { valueAsNumber: true })}
          />
          {errors.rate_per_gram ? (
            <p className="mt-1.5 text-xs text-destructive">{errors.rate_per_gram.message}</p>
          ) : null}
        </div>
        <div>
          {/* What the shop pays buying this metal/purity back as old
              jewellery - independent of the sell rate above, see
              docs/old-jewellery-exchange-plan.md. */}
          <Label htmlFor="purchase-rate-value">Purchase Rate per gram (₹)</Label>
          <Input
            id="purchase-rate-value"
            type="number"
            step="0.01"
            min="0"
            {...register("purchase_rate_per_gram", { valueAsNumber: true })}
          />
          {errors.purchase_rate_per_gram ? (
            <p className="mt-1.5 text-xs text-destructive">{errors.purchase_rate_per_gram.message}</p>
          ) : null}
        </div>
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Button type="submit" disabled={setRate.isPending || !hasPurities} className="w-full uppercase">
        {setRate.isPending ? "Saving…" : "Save Rate"}
      </Button>
    </form>
  );
}
