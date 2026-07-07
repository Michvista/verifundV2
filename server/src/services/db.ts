import { PrismaClient } from '@prisma/client';
import { hasUsableDatabaseUrl } from './config';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export const usingDatabase = hasUsableDatabaseUrl();
export const databaseMode = usingDatabase ? 'postgres' : 'memory';
