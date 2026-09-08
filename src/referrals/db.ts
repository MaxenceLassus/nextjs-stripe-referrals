import { PrismaClient } from '@prisma/client';

/**
 * The Prisma client.
 *
 * If your app already has one — it does — delete this file and point
 * `import { db } from './db'` at yours. It is a separate file precisely so
 * that is a one-line change rather than an edit to every query.
 *
 * The global cache is the usual Next.js dev-mode guard: hot reload re-evaluates
 * modules without closing connections, and a fresh client per reload exhausts
 * Postgres in about a minute of editing.
 */

const globalForPrisma = globalThis as unknown as { referralsPrisma?: PrismaClient };

export const db = globalForPrisma.referralsPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.referralsPrisma = db;
