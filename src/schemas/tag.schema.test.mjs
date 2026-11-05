import assert from "node:assert/strict";
import { test } from "node:test";
import { createTagSchema } from "./tag.schema.ts";

const validTag = {
  product_name: "Gold Ring",
  purity_id: "0123456789abcdef01234567",
  gross_wt_g: 5,
  stone_wt_g: 1,
  net_wt_g: 4,
};

const nameError = (product_name) => {
  const result = createTagSchema.safeParse({ ...validTag, product_name });
  return result.success ? null : result.error.issues.find((issue) => issue.path[0] === "product_name")?.message;
};

test("accepts normal English names and common symbols", () => {
  for (const name of [
    "Gold Ring",
    "Gold Ring - floral",
    'Chain 22" long',
    "Ring (22K) #12",
    "Mother's Day & Co. 50%",
    "A",
  ]) {
    assert.equal(nameError(name), null, name);
  }
});

test("rejects names the printer's fonts can't print", () => {
  for (const name of ["सोने की अंगूठी", "Gold अंगूठी", "Ring ₹500", "Café", "Ring\nTwo", "Ring\tTwo"]) {
    assert.match(nameError(name), /English letters/, JSON.stringify(name));
  }
});

test("keeps the existing name rules", () => {
  assert.match(nameError("   "), /required/);
  assert.match(nameError("a".repeat(121)), /at most 120/);
  assert.equal(nameError("a".repeat(120)), null);
  assert.equal(createTagSchema.safeParse({ ...validTag, product_name: "  Gold Ring  " }).data.product_name, "Gold Ring");
});
