import { z } from "zod";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 365;

export function daysBetween(from: string, to: string): number {
  const fromMs = new Date(`${from}T00:00:00.000Z`).getTime();
  const toMs = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24)) + 1;
}

export const dashboardRangeQuerySchema = z
  .object({
    from: z.string().regex(DATE_PATTERN, "Must be YYYY-MM-DD"),
    to: z.string().regex(DATE_PATTERN, "Must be YYYY-MM-DD"),
  })
  .refine((value) => value.to >= value.from, {
    message: "to must be on or after from",
    path: ["to"],
  })
  .refine((value) => daysBetween(value.from, value.to) <= MAX_RANGE_DAYS, {
    message: `Range cannot exceed ${MAX_RANGE_DAYS} days`,
    path: ["to"],
  });

export type DashboardRangeQuery = z.infer<typeof dashboardRangeQuerySchema>;
