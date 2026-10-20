"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ApiError } from "@/lib/api-client";
import { loginSchema, type LoginInput } from "@/schemas/auth.schema";
import { useLogin } from "@/features/auth/hooks/useAuth";

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, {
      onSuccess: () => {
        router.push("/dashboard");
      },
      onError: (error) => {
        if (error instanceof ApiError) {
          if (error.fields) {
            for (const [field, message] of Object.entries(error.fields)) {
              setError(field as keyof LoginInput, { message });
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
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div>
        <Label htmlFor="email">User ID / Username</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="Enter your User ID"
          leadingIcon={<User className="h-4 w-4" />}
          {...register("email")}
        />
        {errors.email ? <p className="mt-1.5 text-xs text-destructive">{errors.email.message}</p> : null}
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Enter your password"
          leadingIcon={<Lock className="h-4 w-4" />}
          trailingSlot={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="pointer-events-auto text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          {...register("password")}
        />
        {errors.password ? (
          <p className="mt-1.5 text-xs text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Button type="submit" disabled={login.isPending} className="w-full uppercase">
        {login.isPending ? "Logging in…" : "Login to Dashboard"}
        <span aria-hidden>→</span>
      </Button>
    </form>
  );
}
