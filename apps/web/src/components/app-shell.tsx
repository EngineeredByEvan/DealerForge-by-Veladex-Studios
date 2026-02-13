'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownItem, DropdownMenu } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import {
  clearAuth,
  fetchAppointments,
  fetchLeads,
  fetchMe,
  fetchMessagesByLead,
  getSelectedDealershipId,
  setSelectedDealershipId
} from '@/lib/api';
import { initializeDealershipStore, subscribeToDealershipChange } from '@/lib/dealership-store';
import { canAccess, PlatformRole } from '@/lib/authorization';
import {
  AppNotification,
  getNotificationRelativeTime,
  getNotifications,
  ingestAppointmentNotifications,
  ingestLeadNotifications,
  ingestMessageNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotificationUpdates
} from '@/lib/notifications';

const baseNavItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/appointments', label: 'Appointments' },
  { href: '/reports', label: 'Reports' },
  { href: '/templates', label: 'Templates' },
  { href: '/settings/integrations', label: 'Integrations' },
  { href: '/settings/profile', label: 'Profile' }
];

const commandItems = [
  { group: 'Navigate', label: 'Go to Leads', href: '/leads' },
  { group: 'Navigate', label: 'Go to Tasks', href: '/tasks' },
  { group: 'Navigate', label: 'Go to Appointments', href: '/appointments' },
  { group: 'Navigate', label: 'Go to Reports', href: '/reports' },
  { group: 'Navigate', label: 'Go to Integrations', href: '/settings/integrations' },
  { group: 'Actions', label: 'Create Lead', href: '/leads' },
  { group: 'Actions', label: 'Create Task', href: '/tasks' },
  { group: 'Search', label: 'Search Leads', href: '/leads' },
  { group: 'Search', label: 'Search Appointments', href: '/appointments' }
];

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { push } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [dealerships, setDealerships] = useState<Array<{ dealershipId: string; dealershipName: string; role: string }>>([]);
  const [platformRole, setPlatformRole] = useState<PlatformRole>('NONE');
  const [selectedDealership, setSelectedDealership] = useState('');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [switchingDealership, setSwitchingDealership] = useState(false);

  const authUser = useMemo(() => ({ platformRole, dealerships }), [platformRole, dealerships]);

  const filteredCommands = useMemo(
    () => commandItems
      .filter((item) => canAccess(item.href, authUser, selectedDealership || null))
      .filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    [authUser, query, selectedDealership]
  );

  useEffect(() => {
    initializeDealershipStore();
    if (pathname === '/login') return;
    void fetchMe()
      .then((me) => {
        setDealerships(me.dealerships);
        setPlatformRole(me.platformRole);
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
    const unsubscribe = subscribeToDealershipChange(() => {
      setSelectedDealership(getSelectedDealershipId() ?? '');
      setSwitchingDealership(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedDealership) return;

    setNotifications(getNotifications(selectedDealership));

    void Promise.all([fetchLeads(), fetchAppointments()])
      .then(async ([leads, appointments]) => {
        ingestLeadNotifications(selectedDealership, leads);
        ingestAppointmentNotifications(selectedDealership, appointments);
        const messageBatches = await Promise.all(leads.slice(0, 20).map((lead) => fetchMessagesByLead(lead.id).catch(() => [])));
        ingestMessageNotifications(selectedDealership, messageBatches.flat());
        setNotifications(getNotifications(selectedDealership));
      })
      .catch(() => {
        setNotifications(getNotifications(selectedDealership));
      });

    return subscribeToNotificationUpdates(() => {
      setNotifications(getNotifications(selectedDealership));
    });
  }, [selectedDealership]);

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

  const canManageTeam =
    platformRole === 'ADMIN' ||
    dealerships.some((d) => d.dealershipId === selectedDealership && d.role === 'ADMIN');

  const navItems = [
    ...baseNavItems,
    ...(platformRole === 'ADMIN' || platformRole === 'OPERATOR' ? [{ href: '/platform', label: 'Platform' }] : []),
    ...(canManageTeam ? [{ href: '/settings/team', label: 'Team' }] : []),
    ...(canManageTeam || platformRole === 'OPERATOR' ? [{ href: '/settings/dealership', label: 'Dealership Settings' }] : [])
  ].filter((item) => canAccess(item.href, authUser, selectedDealership || null));

  const isRouteAllowed = canAccess(pathname, authUser, selectedDealership || null);
  const unreadCount = notifications.filter((item) => !item.read).length;

  function onNotificationNavigate(item: AppNotification): void {
    if (!selectedDealership) return;
    setNotifications(markNotificationRead(selectedDealership, item.id));
    setNotificationOpen(false);
    router.push(item.href);
  }

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
              <Input placeholder="Search leads, customers, tasks, and appointments" readOnly style={{ width: 'min(620px, 56vw)', minWidth: 320, paddingRight: 64, cursor: 'pointer' }} />
              <span className="command-shortcut">⌘K</span>
            </button>
            <Select
              value={selectedDealership}
              onChange={(event) => {
                const nextDealershipId = event.target.value;
                setSwitchingDealership(true);
                setSelectedDealership(nextDealershipId);
                setSelectedDealershipId(nextDealershipId);
                router.replace(pathname);
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
            {switchingDealership ? <small style={{ color: 'var(--muted-foreground)' }}>Switching dealership…</small> : null}
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
                        if (!selectedDealership) return;
                        setNotifications(markAllNotificationsRead(selectedDealership));
                        push('Marked all notifications as read');
                      }}
                    >
                      Mark all as read
                    </Button>
                  </div>
                  <div className="notifications-list">
                    {notifications.map((item) => (
                      <div key={item.id} className={`notification-item ${item.read ? '' : 'unread'}`}>
                        <button className="notification-main" onClick={() => onNotificationNavigate(item)}>
                          <div style={{ fontWeight: 600 }}>{item.title}</div>
                          <small style={{ color: 'var(--muted-foreground)' }}>{item.message}</small>
                          <small style={{ color: 'var(--muted-foreground)', display: 'block', marginTop: 4 }}>{getNotificationRelativeTime(item.createdAt)}</small>
                        </button>
                        <Button variant="ghost" onClick={() => onNotificationNavigate(item)}>{item.ctaLabel}</Button>
                      </div>
                    ))}
                    {notifications.length === 0 ? <small style={{ color: 'var(--muted-foreground)' }}>No notifications yet.</small> : null}
                  </div>
                  <Button variant="secondary" onClick={() => { setNotificationOpen(false); router.push('/settings/integrations'); }}>
                    View integrations
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
        <main key={`${pathname}:${selectedDealership}`} className="content page-enter">
          {isRouteAllowed ? children : (
            <div className="section-card" style={{ maxWidth: 680 }}>
              <h2 style={{ marginBottom: 8 }}>Not authorized</h2>
              <p style={{ color: 'var(--muted-foreground)' }}>You do not have permission to view this page.</p>
              <div style={{ marginTop: 16 }}>
                <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
              </div>
            </div>
          )}
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
