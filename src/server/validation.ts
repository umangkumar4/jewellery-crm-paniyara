import { z } from "zod";

/**
 * Shared 422 response shape for a failed Zod safeParse() in a Route
 * Handler - one field error message per field, same {error, fields}
 * envelope every route already returns.
 */
export function validationErrorResponse(error: z.ZodError<unknown>): Response {
  const flattened = z.flattenError(error);
  // flattenError<T>'s mapped-type return can't resolve concrete field keys
  // for an unconstrained generic caller - the shape is always
  // Record<string, string[] | undefined> at runtime regardless of T.
  const fieldErrors = flattened.fieldErrors as Record<string, string[] | undefined>;
  const fields = Object.fromEntries(
    Object.entries(fieldErrors).map(([key, messages]) => [key, messages?.[0] ?? "Invalid value"]),
  );
  return Response.json({ error: "Validation failed", fields }, { status: 422 });
}
