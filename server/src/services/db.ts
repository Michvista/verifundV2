import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export let usingDatabase = Boolean(process.env.DATABASE_URL) && process.env.VERIFUND_FORCE_MEMORY !== '1';
export function disableDatabase() {
  usingDatabase = false;
}
