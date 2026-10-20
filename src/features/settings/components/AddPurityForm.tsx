"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/lib/api-client";
import { METALS } from "@/lib/metals";
import { createPuritySchema, type CreatePurityInput } from "@/schemas/purity.schema";
import { useAddPurity } from "@/features/settings/hooks/useAddPurity";

export function AddPurityForm() {
  const addPurity = useAddPurity();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<CreatePurityInput>({
    resolver: zodResolver(createPuritySchema),
    defaultValues: { metal: METALS[0], purity: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    addPurity.mutate(values, {
      onSuccess: (purity) => {
        toast.success(`${purity.metal} ${purity.purity} added`);
        reset({ metal: values.metal, purity: "" });
      },
      onError: (error) => {
        if (error instanceof ApiError) {
          if (error.fields) {
            for (const [field, message] of Object.entries(error.fields)) {
              setError(field as keyof CreatePurityInput, { message });
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

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="purity-metal">Metal</Label>
          <Select id="purity-metal" {...register("metal")}>
            {METALS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="purity-value">Purity</Label>
          <Input id="purity-value" placeholder="e.g. 22K" {...register("purity")} />
          {errors.purity ? <p className="mt-1.5 text-xs text-destructive">{errors.purity.message}</p> : null}
        </div>
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Button type="submit" disabled={addPurity.isPending} className="w-full uppercase">
        {addPurity.isPending ? "Adding…" : "Add Purity"}
      </Button>
    </form>
  );
}
