import { Schema, model, models, type Document, type Model } from "mongoose";

export type TagStatus = "tagged" | "sold";

export interface TagDocument extends Document {
  code: string;
  productName: string;
  metal: string;
  purity: string;
  grossWtG: number;
  stoneWtG: number;
  netWtG: number;
  status: TagStatus;
  createdAt: Date;
  updatedAt: Date;
}

const tagSchema = new Schema<TagDocument>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, index: true },
    productName: { type: String, required: true, trim: true },
    metal: { type: String, required: true },
    purity: { type: String, required: true },
    grossWtG: { type: Number, required: true, min: 0 },
    stoneWtG: { type: Number, required: true, min: 0, default: 0 },
    netWtG: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["tagged", "sold"], default: "tagged", index: true },
  },
  { timestamps: true },
);

export const TagModel: Model<TagDocument> =
  (models.Tag as Model<TagDocument>) ?? model<TagDocument>("Tag", tagSchema);
