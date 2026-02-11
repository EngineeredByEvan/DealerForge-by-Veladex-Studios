import { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';

export const metadata = {
  title: 'DealerForge',
  description: 'DealerForge CRM + AI Automation'
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Arial, sans-serif', margin: 0, padding: 16 }}><AppShell />{children}</body>
    </html>
  );
}
