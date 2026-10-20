import { Schema, model, models, type Document, type Model } from "mongoose";

export interface CustomerDocument extends Document {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<CustomerDocument>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
  },
  { timestamps: true },
);

export const CustomerModel: Model<CustomerDocument> =
  (models.Customer as Model<CustomerDocument>) ?? model<CustomerDocument>("Customer", customerSchema);
