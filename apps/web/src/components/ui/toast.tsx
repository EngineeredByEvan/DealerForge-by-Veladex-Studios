'use client';
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

const Ctx = createContext<{ push: (message: string) => void }>({ push: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [message, setMessage] = useState<string | null>(null);
  const value = useMemo(() => ({ push: (next: string) => { setMessage(next); setTimeout(() => setMessage(null), 2000); } }), []);
  return <Ctx.Provider value={value}>{children}{message ? <div className="toast">{message}</div> : null}</Ctx.Provider>;
}

export function useToast(): { push: (message: string) => void } { return useContext(Ctx); }
