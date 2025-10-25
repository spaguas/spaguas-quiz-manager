import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newDb } from 'pg-mem';
import { vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createTestServer() {
  vi.resetModules();

  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
  process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES || '60';
  process.env.SMTP_HOST = process.env.SMTP_HOST || 'smtp.test';
  process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
  process.env.SMTP_USER = process.env.SMTP_USER || 'user@test';
  process.env.SMTP_PASSWORD = process.env.SMTP_PASSWORD || 'pwd';
  process.env.SMTP_FROM = process.env.SMTP_FROM || 'Spaguas Quiz <no-reply@test>'; 
  process.env.APP_URL = process.env.APP_URL || 'http://localhost:5173';

  const sendMailMock = vi.fn().mockResolvedValue(true);

  vi.mock('nodemailer', () => ({
    default: {
      createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
    },
    createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
  }));

  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({ name: 'current_database', returns: 'text', implementation: () => 'test' });
  db.public.registerFunction({ name: 'version', returns: 'text', implementation: () => 'pg-mem' });
  db.public.registerFunction({ name: 'current_schema', returns: 'text', implementation: () => 'public' });
  db.public.registerFunction({ name: 'current_user', returns: 'text', implementation: () => 'pgmem' });
  db.public.registerFunction({
    name: 'set_config',
    args: ['text', 'text', 'boolean'],
    returns: 'text',
    implementation: (_name, value) => value,
  });

  const pgAdapter = db.adapters.createPg();
  vi.mock('pg', () => pgAdapter);

  const { PrismaClient } = await import('@prisma/client');

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://user:password@localhost:5432/testdb',
      },
    },
  });

  const schemaPath = path.resolve(__dirname, '../utils/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.public.none(schema);

  globalThis.__PRISMA__ = prisma;

  const { default: app } = await import('../../src/app.js');

  const cleanup = async () => {
    await prisma.$disconnect();
    delete globalThis.__PRISMA__;
    vi.unmock('pg');
    vi.clearAllMocks();
  };

  return { app, prisma, db, cleanup };
}
