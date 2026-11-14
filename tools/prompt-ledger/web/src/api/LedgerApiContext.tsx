import { createContext, useContext, type ReactNode } from 'react';
import type { LedgerClient } from './client';

const LedgerApiContext = createContext<LedgerClient | null>(null);

export function LedgerApiProvider({ client, children }: { client: LedgerClient; children: ReactNode }) {
  return <LedgerApiContext.Provider value={client}>{children}</LedgerApiContext.Provider>;
}

export function useLedgerClient(): LedgerClient {
  const client = useContext(LedgerApiContext);
  if (!client) throw new Error('useLedgerClient must be used inside <PromptLedger>.');
  return client;
}
