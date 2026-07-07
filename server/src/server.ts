import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { attachRealtime } from './services/realtime';
import { startNombaCron } from './services/nombaCron';
import { usingDatabase } from './services/db';
import { validateProductionConfig } from './services/config';

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
  validateProductionConfig();
  await seedDatabase();
  startNombaCron();
  server.listen(port, () => {
    console.log(`VeriFund API listening on http://localhost:${port}`);
  });
}

void startServer();
