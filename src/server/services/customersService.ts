import { Types, type QueryFilter } from "mongoose";
import { CustomerModel, type CustomerDocument } from "@/models/Customer.model";
import { InvoiceModel } from "@/models/Invoice.model";

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

// Mongoose's findById throws a CastError on a malformed ObjectId string
// instead of returning null - guarded here the same way
// invoicesService.findInvoiceById() already is, so a typo'd URL 404s
// cleanly instead of 500ing.
export async function findCustomerById(id: string): Promise<CustomerDocument | null> {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }
  return CustomerModel.findById(id);
}

export interface CustomerStats {
  invoice_count: number;
  total_purchased: number;
  pending_amount: number;
}

const EMPTY_STATS: CustomerStats = { invoice_count: 0, total_purchased: 0, pending_amount: 0 };

// Same isValid() guard as findCustomerById() - defensive even though the
// only current caller (the GET /api/customers/:id route) only reaches this
// after findCustomerById() has already confirmed the id is valid, so this
// never actually sees a bad id in practice today.
export async function getCustomerStats(customerId: string): Promise<CustomerStats> {
  if (!Types.ObjectId.isValid(customerId)) {
    return EMPTY_STATS;
  }

  const [result] = await InvoiceModel.aggregate<CustomerStats>([
    { $match: { customerId: new Types.ObjectId(customerId) } },
    {
      $group: {
        _id: null,
        invoice_count: { $sum: 1 },
        total_purchased: { $sum: "$grandTotal" },
        // Same "not paid" definition as the dashboard's global pending_amount
        // (src/server/services/dashboardService.ts), just scoped to one
        // customer instead of every invoice.
        pending_amount: {
          $sum: { $cond: [{ $ne: ["$paymentStatus", "paid"] }, "$pendingAmount", 0] },
        },
      },
    },
    // Drop the $group stage's _id: null key - without this it leaks into
    // the serialized response as a stray "_id": null field alongside the
    // three real stats.
    {
      $project: { _id: 0, invoice_count: 1, total_purchased: 1, pending_amount: 1 },
    },
  ]);

  return result ?? EMPTY_STATS;
}

export function serializeCustomerDetail(customer: CustomerDocument, stats: CustomerStats) {
  return {
    id: customer._id.toString(),
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    created_at: customer.createdAt.toISOString(),
    stats,
  };
}
