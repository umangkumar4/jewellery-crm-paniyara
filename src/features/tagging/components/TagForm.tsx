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
import { createTagSchema, type CreateTagFormValues, type CreateTagInput } from "@/schemas/tag.schema";
import { useCreateTag, type Tag } from "@/features/tagging/hooks/useCreateTag";

const METALS = ["Gold", "Silver", "Platinum"];
const PURITIES = ["24K", "22K", "18K", "14K", "999", "925"];

export function TagForm({ onCreated }: { onCreated: (tag: Tag) => void }) {
  const createTag = useCreateTag();
  const [formError, setFormError] = useState<string | null>(null);

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
      metal: METALS[0],
      purity: PURITIES[0],
      gross_wt_g: 0,
      stone_wt_g: 0,
      net_wt_g: 0,
    },
  });

  // react-hook-form's watch() isn't memoizable, so the compiler skips
  // auto-memoizing this component - expected, not a correctness issue.
  // eslint-disable-next-line react-hooks/incompatible-library
  const grossWtG = watch("gross_wt_g");
  const stoneWtG = watch("stone_wt_g");

  useEffect(() => {
    const net = Math.max(0, (Number(grossWtG) || 0) - (Number(stoneWtG) || 0));
    setValue("net_wt_g", Math.round(net * 100) / 100);
  }, [grossWtG, stoneWtG, setValue]);

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    createTag.mutate(values, {
      onSuccess: (tag) => {
        toast.success(`Tag ${tag.code} created`);
        reset();
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
          <Select id="metal" {...register("metal")}>
            {METALS.map((metal) => (
              <option key={metal} value={metal}>
                {metal}
              </option>
            ))}
          </Select>
          {errors.metal ? <p className="mt-1.5 text-xs text-destructive">{errors.metal.message}</p> : null}
        </div>

        <div>
          <Label htmlFor="purity">Purity</Label>
          <Select id="purity" {...register("purity")}>
            {PURITIES.map((purity) => (
              <option key={purity} value={purity}>
                {purity}
              </option>
            ))}
          </Select>
          {errors.purity ? <p className="mt-1.5 text-xs text-destructive">{errors.purity.message}</p> : null}
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

      <Button type="submit" disabled={createTag.isPending} className="w-full uppercase">
        {createTag.isPending ? "Creating…" : "Create Tag & Print Label"}
      </Button>
    </form>
  );
}
