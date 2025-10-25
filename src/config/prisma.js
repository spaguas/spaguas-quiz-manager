import { PrismaClient } from '@prisma/client';

if (!globalThis.__PRISMA__) {
  globalThis.__PRISMA__ = new PrismaClient();
}

const prisma = globalThis.__PRISMA__;

export default prisma;
