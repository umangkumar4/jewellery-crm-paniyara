"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, Lock } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ApiError } from "@/lib/api-client";
import { changePasswordSchema } from "@/schemas/auth.schema";
import { useChangePassword } from "@/features/settings/hooks/useChangePassword";

// UI-only: the API only takes currentPassword/newPassword (@/schemas/auth.schema).
// confirmPassword never leaves this form - it's stripped before the mutation fires.
const changePasswordFormSchema = changePasswordSchema
  .extend({ confirmPassword: z.string().min(1, "Please confirm your new password") })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;

export function ChangePasswordForm() {
  const changePassword = useChangePassword();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormInput>({
    resolver: zodResolver(changePasswordFormSchema),
  });

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) => {
    setFormError(null);
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast.success("Password changed");
          reset();
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            if (error.fields) {
              for (const [field, message] of Object.entries(error.fields)) {
                setError(field as keyof ChangePasswordFormInput, { message });
              }
              return;
            }
            setFormError(error.message);
            return;
          }
          setFormError("Something went wrong. Please try again.");
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-5" noValidate>
      <div>
        <Label htmlFor="currentPassword">Current Password</Label>
        <Input
          id="currentPassword"
          type={showCurrent ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Enter your current password"
          leadingIcon={<Lock className="h-4 w-4" />}
          trailingSlot={
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="pointer-events-auto text-muted-foreground hover:text-foreground"
              aria-label={showCurrent ? "Hide password" : "Show password"}
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          {...register("currentPassword")}
        />
        {errors.currentPassword ? (
          <p className="mt-1.5 text-xs text-destructive">{errors.currentPassword.message}</p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="newPassword">New Password</Label>
        <Input
          id="newPassword"
          type={showNew ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Enter a new password"
          leadingIcon={<Lock className="h-4 w-4" />}
          trailingSlot={
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="pointer-events-auto text-muted-foreground hover:text-foreground"
              aria-label={showNew ? "Hide password" : "Show password"}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          {...register("newPassword")}
        />
        {errors.newPassword ? (
          <p className="mt-1.5 text-xs text-destructive">{errors.newPassword.message}</p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm New Password</Label>
        <Input
          id="confirmPassword"
          type={showConfirm ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter the new password"
          leadingIcon={<Lock className="h-4 w-4" />}
          trailingSlot={
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="pointer-events-auto text-muted-foreground hover:text-foreground"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="mt-1.5 text-xs text-destructive">{errors.confirmPassword.message}</p>
        ) : null}
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Button type="submit" disabled={changePassword.isPending} className="w-full uppercase">
        {changePassword.isPending ? "Changing…" : "Change Password"}
      </Button>
    </form>
  );
}
