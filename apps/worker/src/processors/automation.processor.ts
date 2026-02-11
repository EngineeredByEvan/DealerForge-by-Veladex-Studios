import { Job } from 'bullmq';

export async function automationProcessor(job: Job): Promise<void> {
  console.log(`[worker] processing job ${job.name} (${job.id})`);
}
