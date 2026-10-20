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
