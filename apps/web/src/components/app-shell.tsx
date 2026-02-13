'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownItem, DropdownMenu } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { clearAuth, fetchMe, getSelectedDealershipId, setSelectedDealershipId } from '@/lib/api';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/appointments', label: 'Appointments' },
  { href: '/settings/integrations', label: 'Integrations' }
];

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [dealerships, setDealerships] = useState<Array<{ dealershipId: string; dealershipName: string }>>([]);
  const [selectedDealership, setSelectedDealership] = useState('');

  useEffect(() => {
    if (pathname === '/login') return;
    void fetchMe().then((me) => {
      setDealerships(me.dealerships);
      const active = getSelectedDealershipId() ?? me.dealerships[0]?.dealershipId ?? '';
      setSelectedDealership(active);
      if (active) setSelectedDealershipId(active);
    }).catch(() => {
      clearAuth();
      router.push('/login');
    });
  }, [pathname, router]);

  if (pathname === '/login') return <>{children}</>;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? 'collapsed' : 'expanded'}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          {!collapsed ? <div><div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Dealership OS</div><strong>DealerForge</strong></div> : null}
          <Button variant="ghost" onClick={() => setCollapsed((v) => !v)}>{collapsed ? '→' : '←'}</Button>
        </div>
        <nav style={{ display: 'grid', gap: 4 }}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}>
              {!collapsed ? item.label : item.label.slice(0, 1)}
            </Link>
          ))}
        </nav>
      </aside>

      <div style={{ flex: 1 }}>
        <header className="topbar">
          <div className="topbar-row">
            <Input placeholder="Global search" style={{ maxWidth: 420 }} />
            <Select value={selectedDealership} onChange={(event) => { setSelectedDealership(event.target.value); setSelectedDealershipId(event.target.value); }} style={{ maxWidth: 280 }}>
              <option value="">Select dealership</option>
              {dealerships.map((d) => <option key={d.dealershipId} value={d.dealershipId}>{d.dealershipName}</option>)}
            </Select>
            <Button variant="ghost">🔔</Button>
            <DropdownMenu trigger={<Button variant="secondary">Account</Button>}>
              <DropdownItem onSelect={() => document.documentElement.classList.toggle('dark')}>Toggle theme</DropdownItem>
              <DropdownItem onSelect={() => { clearAuth(); router.push('/login'); }}>Logout</DropdownItem>
            </DropdownMenu>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
