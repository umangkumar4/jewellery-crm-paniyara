import { UserModel } from "@/models/User.model";
import { hashPassword } from "@/server/auth/password";
import type { RegisterInput } from "@/schemas/auth.schema";

export class UserAlreadyExistsError extends Error {
  constructor() {
    super("A user account already exists");
    this.name = "UserAlreadyExistsError";
  }
}

export async function registerUser(input: RegisterInput) {
  const existingCount = await UserModel.countDocuments();
  if (existingCount > 0) {
    throw new UserAlreadyExistsError();
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await UserModel.create({
      name: input.name,
      email: input.email,
      passwordHash,
    });

    return { id: user._id.toString(), name: user.name, email: user.email };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw new UserAlreadyExistsError();
    }
    throw error;
  }
}
