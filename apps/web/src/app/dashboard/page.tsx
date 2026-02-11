import { fetchHealth } from '@/lib/api';

export default async function DashboardPage(): Promise<JSX.Element> {
  const health = await fetchHealth();

  return (
    <main>
      <h1>DealerForge Dashboard</h1>
      <p>API status: {health.status}</p>
      <p>Service: {health.service}</p>
      <p>Timestamp: {health.timestamp}</p>
    </main>
  );
}
