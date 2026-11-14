import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { PromptLedger } from '@veru/prompt-ledger';
import { AppLayout } from './layout/AppLayout';
import { RawDataPage } from './features/raw-data/RawDataPage';
import { PersonalizePage } from './features/personalize/PersonalizePage';
import { LEDGER_PRESET, ThemeProvider, useTheme } from './theme/ThemeProvider';

export function App() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<RawDataPage />} />
              <Route path="ledger" element={<ThemedLedger queryClient={queryClient} />} />
              <Route path="personalize" element={<PersonalizePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/** The ledger keeps its own palette under Classic and follows the app's tokens under every other theme. */
function ThemedLedger({ queryClient }: { queryClient: QueryClient }) {
  const { theme, scheme } = useTheme();
  return <PromptLedger queryClient={queryClient} colorScheme={scheme} preset={theme.skinsLedger ? LEDGER_PRESET : undefined} />;
}
