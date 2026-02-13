'use client';

import { Appointment, Lead, Message } from '@/lib/api';

export type NotificationType = 'lead' | 'appointment' | 'integration' | 'message';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  ctaLabel: string;
  href: string;
  entityId?: string;
  createdAt: string;
  read: boolean;
};

const NOTIFICATION_EVENT = 'dealerforge:notifications:new';

function storageKey(dealershipId: string): string {
  return `notifications:${dealershipId}`;
}

function readFromStorage(dealershipId: string): AppNotification[] {
  if (!dealershipId) return [];
  const raw = localStorage.getItem(storageKey(dealershipId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as AppNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToStorage(dealershipId: string, notifications: AppNotification[]): void {
  if (!dealershipId) return;
  localStorage.setItem(storageKey(dealershipId), JSON.stringify(notifications));
}

function upsertNotifications(dealershipId: string, incoming: AppNotification[]): AppNotification[] {
  const existing = readFromStorage(dealershipId);
  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];

  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    merged.unshift(item);
    seen.add(item.id);
  }

  const trimmed = merged
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 100);
  writeToStorage(dealershipId, trimmed);
  return trimmed;
}

function emitUpdate(): void {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT));
}

function toRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));

  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function getNotifications(dealershipId: string): AppNotification[] {
  return readFromStorage(dealershipId);
}

export function markAllNotificationsRead(dealershipId: string): AppNotification[] {
  const notifications = readFromStorage(dealershipId).map((item) => ({ ...item, read: true }));
  writeToStorage(dealershipId, notifications);
  emitUpdate();
  return notifications;
}

export function markNotificationRead(dealershipId: string, notificationId: string): AppNotification[] {
  const notifications = readFromStorage(dealershipId).map((item) =>
    item.id === notificationId ? { ...item, read: true } : item
  );
  writeToStorage(dealershipId, notifications);
  emitUpdate();
  return notifications;
}

export function subscribeToNotificationUpdates(callback: () => void): () => void {
  const handler = (): void => callback();
  window.addEventListener(NOTIFICATION_EVENT, handler);
  return () => window.removeEventListener(NOTIFICATION_EVENT, handler);
}

export function ingestLeadNotifications(dealershipId: string, leads: Lead[]): AppNotification[] {
  const recentLeads = leads.filter((lead) => {
    const created = new Date(lead.createdAt).getTime();
    return Date.now() - created <= 1000 * 60 * 60 * 24;
  });

  const items: AppNotification[] = recentLeads.map((lead) => ({
    id: `lead:${lead.id}`,
    type: 'lead',
    title: 'New lead assigned',
    message: `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || 'New lead available',
    ctaLabel: 'Review lead',
    href: `/leads?focus=${lead.id}`,
    entityId: lead.id,
    createdAt: lead.createdAt,
    read: false
  }));

  const merged = upsertNotifications(dealershipId, items);
  emitUpdate();
  return merged;
}

export function ingestAppointmentNotifications(
  dealershipId: string,
  appointments: Appointment[]
): AppNotification[] {
  const recentAppointments = appointments.filter((appointment) => {
    const updated = new Date(appointment.updatedAt).getTime();
    return Date.now() - updated <= 1000 * 60 * 60 * 24;
  });

  const items: AppNotification[] = recentAppointments.map((appointment) => ({
    id: `appointment:${appointment.id}`,
    type: 'appointment',
    title: 'Appointment rescheduled',
    message: appointment.lead
      ? `${appointment.lead.firstName ?? ''} ${appointment.lead.lastName ?? ''}`.trim() || appointment.lead.id
      : 'Appointment update received',
    ctaLabel: 'Open calendar',
    href: `/appointments?focus=${appointment.id}`,
    entityId: appointment.id,
    createdAt: appointment.updatedAt,
    read: false
  }));

  const merged = upsertNotifications(dealershipId, items);
  emitUpdate();
  return merged;
}

export function pushCsvImportNotification(
  dealershipId: string,
  summary: string
): AppNotification[] {
  const now = new Date().toISOString();
  const merged = upsertNotifications(dealershipId, [
    {
      id: `integration:csv:${now}`,
      type: 'integration',
      title: 'CSV import completed',
      message: summary,
      ctaLabel: 'View integrations',
      href: '/settings/integrations',
      createdAt: now,
      read: false
    }
  ]);
  emitUpdate();
  return merged;
}

export function getNotificationRelativeTime(createdAt: string): string {
  return toRelativeTime(createdAt);
}


export function ingestMessageNotifications(dealershipId: string, messages: Message[]): AppNotification[] {
  const outbound = messages.filter((message) => {
    if (message.direction !== 'OUTBOUND') return false;
    const created = new Date(message.createdAt).getTime();
    return Date.now() - created <= 1000 * 60 * 60 * 24;
  });

  const items: AppNotification[] = outbound.map((message) => ({
    id: `message:${message.id}`,
    type: 'message',
    title: 'Message sent',
    message: `${message.channel} • ${message.body.slice(0, 90)}`,
    ctaLabel: 'Open lead',
    href: message.thread?.leadId ? `/leads/${message.thread.leadId}` : '/leads',
    entityId: message.id,
    createdAt: message.createdAt,
    read: false
  }));

  const merged = upsertNotifications(dealershipId, items);
  emitUpdate();
  return merged;
}
