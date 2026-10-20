import './common/config/bootEnv'; // loads + validates env; must stay the first import
import { app, httpServer, PORT } from './server';
import { prisma } from './common/lib/prisma';
import { startCronJobs } from './jobs/cron';
import { startWorkers, stopWorkers } from './jobs/workers';
import { initQueues } from './jobs/queues';
import { initBullBoard } from './modules/admin/admin.routes';

async function main() {
  try {
    await prisma.$connect();
    console.log('Database connected');

    // Initialize BullMQ queues (tests Redis connectivity)
    await initQueues();

    // Initialize Bull Board dashboard (depends on queues being ready)
    await initBullBoard();

    // Start background cron jobs
    startCronJobs();

    // Start BullMQ queue workers (only if Redis is reachable)
    await startWorkers();

    // Use httpServer (wraps Express + Socket.io)
    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`API docs available at http://localhost:${PORT}/api/docs`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await stopWorkers();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await stopWorkers();
  await prisma.$disconnect();
  process.exit(0);
});

// Handle unhandled promise rejections — log instead of crash
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

main();
