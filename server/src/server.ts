import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { attachRealtime } from './services/realtime';
import { startNombaCron } from './services/nombaCron';
import { prisma, usingDatabase, disableDatabase } from './services/db';

async function verifyDatabaseConnection() {
  if (!usingDatabase) {
    console.log('[Database] Starting in MEMORY mode (VERIFUND_FORCE_MEMORY=1 or DATABASE_URL not set).');
    return;
  }

  console.log('[Database] Connecting to PostgreSQL database...');
  const maxAttempts = 3;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ [Database] Connected successfully to PostgreSQL!');
      return;
    } catch (err: any) {
      console.warn(`⚠️ [Database] Connection attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        const waitMs = 1000 * attempt;
        console.log(`[Database] Retrying in ${waitMs}ms...`);
        await sleep(waitMs);
      }
    }
  }

  console.error('❌ [Database] Failed to connect to PostgreSQL. Falling back to IN-MEMORY mode for stability.');
  disableDatabase();
}

async function seedDatabase() {
  if (!usingDatabase) {
    console.log('[seeder] No database configured. Starting without seeded records.');
    return;
  }

  console.log('[seeder] Startup seeding is disabled. Booting with live database state only.');
}

const port = Number(process.env.PORT || 5050);
const app = createApp();
const server = http.createServer(app);

attachRealtime(server);

async function startServer() {
  await verifyDatabaseConnection();
  await seedDatabase();
  startNombaCron();
  server.listen(port, () => {
    console.log(`VeriFund API listening on http://localhost:${port}`);
  });
}

void startServer();
