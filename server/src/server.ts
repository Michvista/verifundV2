import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { attachRealtime } from './services/realtime';
import { prisma, usingDatabase } from './services/db';
import { seedCooperative, seedMembers, seedWithdrawals, seedAlerts, seedAuditLog } from './data/seed';

async function seedDatabase() {
  if (!usingDatabase) return;
  try {
    const testMember = await prisma.member.findUnique({ where: { id: 'mem-01' } });
    if (testMember) {
      console.log('[seeder] Database already contains seed member mem-01. Skipping seed.');
      return;
    }

    console.log('[seeder] Database is missing seed records. Wiping and re-seeding...');

    // Wipe existing data to avoid conflict
    await prisma.withdrawalSignature.deleteMany();
    await prisma.withdrawalRequest.deleteMany();
    await prisma.contribution.deleteMany();
    await prisma.fraudAlert.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.whistleblowerReport.deleteMany();
    await prisma.cooperativeMember.deleteMany();
    await prisma.cooperative.deleteMany();
    await prisma.member.deleteMany();

    console.log('[seeder] Seeding initial cooperative and members...');

    // 1. Seed members
    for (const m of seedMembers) {
      await prisma.member.create({
        data: {
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          phoneNumber: m.phoneNumber,
          bvnHash: m.bvnHash,
          bvnVerified: m.bvnVerified,
          bvnVerifiedAt: m.bvnVerifiedAt ? new Date(m.bvnVerifiedAt) : null,
          role: m.role,
          isActive: m.isActive,
        },
      });
    }

    // 2. Seed cooperative
    await prisma.cooperative.create({
      data: {
        id: seedCooperative.id,
        name: seedCooperative.name,
        registrationNumber: seedCooperative.registrationNumber,
        state: seedCooperative.state,
        cooperativeType: seedCooperative.cooperativeType,
        nombaVirtualAccountRef: seedCooperative.nombaVirtualAccountRef,
        nombaAccountId: seedCooperative.nombaAccountId,
        healthScore: seedCooperative.healthScore,
        isActive: seedCooperative.isActive,
        memberCount: seedCooperative.memberCount,
        balance: seedCooperative.balance,
      },
    });

    // 3. Link members to cooperative
    for (const m of seedMembers) {
      await prisma.cooperativeMember.create({
        data: {
          cooperativeId: seedCooperative.id,
          memberId: m.id,
          role: m.role,
        },
      });
    }

    // 4. Seed withdrawals
    for (const w of seedWithdrawals) {
      await prisma.withdrawalRequest.create({
        data: {
          id: w.id,
          cooperativeId: w.cooperativeId,
          requestedById: w.requestedBy,
          amount: w.amount,
          destinationAccount: w.destinationAccount,
          destinationBankCode: w.destinationBankCode,
          purpose: w.purpose,
          riskScore: w.riskScore,
          status: w.status,
          average30d: w.average30d,
          signatureCount: w.signatureCount,
          explanations: w.explanations ?? [],
          createdAt: w.createdAt ? new Date(w.createdAt) : new Date(),
        },
      });
    }

    // 5. Seed alerts
    for (const a of seedAlerts) {
      await prisma.fraudAlert.create({
        data: {
          id: a.id,
          cooperativeId: a.cooperativeId,
          alertType: a.alertType,
          riskScore: a.riskScore,
          triggeredBy: a.triggeredBy,
          evidenceJson: a.evidenceJson ?? {},
          status: a.status,
          title: a.title,
          reason: a.reason,
          severity: a.severity,
          createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
        },
      });
    }

    // 6. Seed audit log
    for (const e of seedAuditLog) {
      await prisma.auditEvent.create({
        data: {
          id: e.id,
          cooperativeId: e.cooperativeId,
          eventType: e.eventType,
          description: e.description,
          metadata: e.metadata ?? {},
          createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
        },
      });
    }

    console.log('[seeder] Database seeded successfully.');
  } catch (err) {
    console.error('[seeder] Error seeding database:', err);
  }
}

const port = Number(process.env.PORT || 5050);
const app = createApp();
const server = http.createServer(app);

attachRealtime(server);

async function startServer() {
  await seedDatabase();
  server.listen(port, () => {
    console.log(`VeriFund API listening on http://localhost:${port}`);
  });
}

void startServer();

