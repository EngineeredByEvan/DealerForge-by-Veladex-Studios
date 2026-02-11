import { Queue, Worker } from 'bullmq';
import { createRedisConnection } from './queues/redis.connection';
import { automationProcessor } from './processors/automation.processor';
import { FOLLOWUP_SEQUENCES_JOB } from './jobs/followup-sequences.job';

const connection = createRedisConnection();
const queueName = 'automation_queue';

async function bootstrap(): Promise<void> {
  const queue = new Queue(queueName, { connection });

  const worker = new Worker(queueName, automationProcessor, { connection });
  worker.on('ready', () => {
    console.log('[worker] automation worker ready');
  });

  await queue.add(FOLLOWUP_SEQUENCES_JOB, {
    triggeredAt: new Date().toISOString()
  });
}

void bootstrap();
