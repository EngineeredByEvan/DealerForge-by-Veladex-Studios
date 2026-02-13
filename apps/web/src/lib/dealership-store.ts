'use client';

const DEALERSHIP_ID_KEY = 'dealerforge_dealership_id';

type Listener = () => void;

let activeDealershipId = '';
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function initializeDealershipStore(): void {
  if (typeof window === 'undefined') return;
  if (!activeDealershipId) {
    activeDealershipId = localStorage.getItem(DEALERSHIP_ID_KEY) ?? '';
  }
}

export function subscribeToDealershipChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActiveDealershipId(): string {
  return activeDealershipId;
}

export function setActiveDealershipId(dealershipId: string): void {
  activeDealershipId = dealershipId;
  localStorage.setItem(DEALERSHIP_ID_KEY, dealershipId);
  window.dispatchEvent(new CustomEvent('dealerforge:dealership-change', { detail: { dealershipId } }));
  emit();
}

export function clearActiveDealershipId(): void {
  activeDealershipId = '';
  localStorage.removeItem(DEALERSHIP_ID_KEY);
  emit();
}
