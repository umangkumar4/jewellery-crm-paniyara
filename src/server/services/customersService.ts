import type { QueryFilter } from "mongoose";
import { CustomerModel, type CustomerDocument } from "@/models/Customer.model";

export async function findCustomerByPhone(phone: string) {
  return CustomerModel.findOne({ phone });
}

export function serializeCustomer(customer: CustomerDocument) {
  return {
    id: customer._id.toString(),
    name: customer.name,
    email: customer.email,
    address: customer.address,
  };
}

export interface ListCustomersParams {
  page: number;
  limit: number;
  q?: string;
}

export async function listCustomers({ page, limit, q }: ListCustomersParams) {
  const filter: QueryFilter<CustomerDocument> = {};
  if (q) {
    // q is user input - escape regex metacharacters before using it in a
    // RegExp, same pattern as tagsService.listTags().
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: regex }, { phone: regex }];
  }

  const [items, total] = await Promise.all([
    CustomerModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    CustomerModel.countDocuments(filter),
  ]);

  return { items, total };
}

// Distinct from serializeCustomer() above (which deliberately omits `phone`
// for the billing-autofill lookup, since that caller already has it) - the
// list view is a browse context, phone is exactly what's being scanned for.
export function serializeCustomerListItem(customer: CustomerDocument) {
  return {
    id: customer._id.toString(),
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    created_at: customer.createdAt.toISOString(),
  };
}
