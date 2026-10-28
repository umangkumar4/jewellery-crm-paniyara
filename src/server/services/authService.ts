import { UserModel } from "@/models/User.model";
import { comparePassword, hashPassword } from "@/server/auth/password";
import type { ChangePasswordInput, LoginInput, RegisterInput } from "@/schemas/auth.schema";

export class UserAlreadyExistsError extends Error {
  constructor() {
    super("A user with this email already exists");
    this.name = "UserAlreadyExistsError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super("User not found");
    this.name = "UserNotFoundError";
  }
}

export class InvalidCurrentPasswordError extends Error {
  constructor() {
    super("Current password is incorrect");
    this.name = "InvalidCurrentPasswordError";
  }
}

export async function registerUser(input: RegisterInput) {
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

export async function loginUser(input: LoginInput) {
  const user = await UserModel.findOne({ email: input.email });
  if (!user) {
    throw new InvalidCredentialsError();
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    throw new InvalidCredentialsError();
  }

  return { id: user._id.toString(), name: user.name, email: user.email };
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new UserNotFoundError();
  }

  const valid = await comparePassword(input.currentPassword, user.passwordHash);
  if (!valid) {
    throw new InvalidCurrentPasswordError();
  }

  user.passwordHash = await hashPassword(input.newPassword);
  await user.save();
}
