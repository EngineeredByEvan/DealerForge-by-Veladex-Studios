import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/app/leads/[id]/page.tsx', import.meta.url), 'utf8');

if (!page.includes('Activity timeline') || !page.includes('Compose message')) {
  throw new Error('Lead detail communication timeline UI markers are missing.');
}

console.log('Lead detail smoke check passed.');
