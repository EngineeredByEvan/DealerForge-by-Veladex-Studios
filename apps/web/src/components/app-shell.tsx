'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownItem, DropdownMenu } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { clearAuth, fetchMe, getSelectedDealershipId, setSelectedDealershipId } from '@/lib/api';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/appointments', label: 'Appointments' },
  { href: '/settings/integrations', label: 'Integrations' }
];

const commandItems = [
  { group: 'Navigate', label: 'Go to Leads', href: '/leads' },
  { group: 'Navigate', label: 'Go to Tasks', href: '/tasks' },
  { group: 'Navigate', label: 'Go to Appointments', href: '/appointments' },
  { group: 'Navigate', label: 'Go to Integrations', href: '/settings/integrations' },
  { group: 'Actions', label: 'Create Lead', href: '/leads' },
  { group: 'Actions', label: 'Create Task', href: '/tasks' },
  { group: 'Search', label: 'Search Leads', href: '/leads' },
  { group: 'Search', label: 'Search Appointments', href: '/appointments' }
];

const seededNotifications = [
  { id: '1', title: '3 new leads assigned', time: '2m ago', cta: 'Review leads', unread: true },
  { id: '2', title: 'Appointment rescheduled', time: '28m ago', cta: 'Open calendar', unread: true },
  { id: '3', title: 'CSV import completed', time: '1h ago', cta: 'View integrations', unread: false }
];

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { push } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [dealerships, setDealerships] = useState<Array<{ dealershipId: string; dealershipName: string }>>([]);
  const [selectedDealership, setSelectedDealership] = useState('');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [notifications, setNotifications] = useState(seededNotifications);

  const filteredCommands = useMemo(
    () => commandItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  useEffect(() => {
    if (pathname === '/login') return;
    void fetchMe()
      .then((me) => {
        setDealerships(me.dealerships);
        const active = getSelectedDealershipId() ?? me.dealerships[0]?.dealershipId ?? '';
        setSelectedDealership(active);
        if (active) setSelectedDealershipId(active);
      })
      .catch(() => {
        clearAuth();
        router.push('/login');
      });
  }, [pathname, router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (pathname === '/login') return <>{children}</>;

  const unreadCount = notifications.filter((item) => item.unread).length;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? 'collapsed' : 'expanded'}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          {!collapsed ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Dealership OS</div>
              <strong>DealerForge</strong>
            </div>
          ) : null}
          <Button variant="ghost" onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? '→' : '←'}
          </Button>
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
            <button className="command-trigger" onClick={() => setCommandOpen(true)} aria-label="Open global command palette">
              <Input placeholder="Search leads, tasks, appointments..." readOnly style={{ maxWidth: 420, cursor: 'pointer' }} />
              <span className="command-shortcut">⌘K</span>
            </button>
            <Select
              value={selectedDealership}
              onChange={(event) => {
                setSelectedDealership(event.target.value);
                setSelectedDealershipId(event.target.value);
              }}
              style={{ maxWidth: 280 }}
            >
              <option value="">Select dealership</option>
              {dealerships.map((d) => (
                <option key={d.dealershipId} value={d.dealershipId}>
                  {d.dealershipName}
                </option>
              ))}
            </Select>
            <div style={{ position: 'relative' }}>
              <Button variant="ghost" aria-label="Open notifications" onClick={() => setNotificationOpen((value) => !value)}>
                🔔
                {unreadCount > 0 ? <span className="notification-dot" /> : null}
              </Button>
              {notificationOpen ? (
                <div className="notifications-panel">
                  <div className="notifications-head">
                    <strong>Notifications</strong>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setNotifications((current) => current.map((item) => ({ ...item, unread: false })));
                        push('Marked all notifications as read');
                      }}
                    >
                      Mark all as read
                    </Button>
                  </div>
                  <div className="notifications-list">
                    {notifications.map((item) => (
                      <div key={item.id} className={`notification-item ${item.unread ? 'unread' : ''}`}>
                        <span>•</span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.title}</div>
                          <small style={{ color: 'var(--muted-foreground)' }}>{item.time}</small>
                          {item.cta ? <div><Button variant="ghost" onClick={() => push(item.cta)}>{item.cta}</Button></div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="secondary" onClick={() => push('Viewing all notifications')}>
                    View all
                  </Button>
                </div>
              ) : null}
            </div>
            <DropdownMenu trigger={<Button variant="secondary">Account</Button>}>
              <DropdownItem onSelect={() => document.documentElement.classList.toggle('dark')}>Toggle theme</DropdownItem>
              <DropdownItem
                onSelect={() => {
                  clearAuth();
                  router.push('/login');
                }}
              >
                Logout
              </DropdownItem>
            </DropdownMenu>
          </div>
        </header>
        <main key={pathname} className="content page-enter">
          {children}
        </main>
      </div>
      {commandOpen ? (
        <div className="modal-overlay" onClick={() => setCommandOpen(false)}>
          <div className="modal command-modal" onClick={(event) => event.stopPropagation()}>
            <Input autoFocus placeholder="Type a command or search..." value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="command-list">
              {['Navigate', 'Actions', 'Search'].map((group) => (
                <div key={group}>
                  <p className="command-group">{group}</p>
                  {filteredCommands.filter((item) => item.group === group).map((item) => (
                    <button
                      key={item.label}
                      className="command-item"
                      onClick={() => {
                        setCommandOpen(false);
                        setQuery('');
                        router.push(item.href);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
