import { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

export const metadata = {
  title: 'DealerForge',
  description: 'DealerForge CRM + AI Automation'
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
