import mongoose from "mongoose";
import { env } from "@/lib/env";

/**
 * Next.js dev mode hot-reloads route modules on every change, which would
 * otherwise open a fresh MongoDB connection per reload. Caching the
 * connection (and in-flight promise) on `globalThis` survives module
 * reloads and keeps a single connection pool for the process.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = globalThis.__mongooseCache ?? { conn: null, promise: null };
globalThis.__mongooseCache = cache;

export async function dbConnect(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(env.MONGODB_URI, {
      bufferCommands: false,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
