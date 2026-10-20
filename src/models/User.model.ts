import { Schema, model, models, type Document, type Model } from "mongoose";

export interface UserDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

export const UserModel: Model<UserDocument> =
  (models.User as Model<UserDocument>) ?? model<UserDocument>("User", userSchema);
