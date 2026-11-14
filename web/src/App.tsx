import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { PromptLedger } from '@veru/prompt-ledger';
import { AppLayout } from './layout/AppLayout';
import { RawDataPage } from './features/raw-data/RawDataPage';
import { PersonalizePage } from './features/personalize/PersonalizePage';
import { ReportsPage } from './features/reports/ReportsPage';
import { AnalyticsPage } from './features/analytics/AnalyticsPage';
import { LEDGER_PRESET, ThemeProvider, useTheme } from './theme/ThemeProvider';
import { useDocumentTitle } from './a11y/useDocumentTitle';
import { MotionProvider } from './motion/MotionProvider';

export function App() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } }),
  );

  return (
    <ThemeProvider>
      <MotionProvider>
        <QueryClientProvider client={queryClient}>
          {/* Synchronous route updates, so a page slide can snapshot the new page as soon as navigate() returns. */}
          <BrowserRouter useTransitions={false}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<RawDataPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="ledger" element={<ThemedLedger queryClient={queryClient} />} />
                <Route path="personalize" element={<PersonalizePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </QueryClientProvider>
      </MotionProvider>
    </ThemeProvider>
  );
}

/**
 * The ledger keeps its own palette under Classic and follows the app's tokens under every other theme.
 * Light/dark is always the app's (set on Personalize), so there is a single switch for it.
 */
function ThemedLedger({ queryClient }: { queryClient: QueryClient }) {
  const { theme, scheme } = useTheme();
  useDocumentTitle('Prompt ledger');
  return (
    <PromptLedger
      queryClient={queryClient}
      colorScheme={scheme}
      hostControlsScheme
      preset={theme.skinsLedger ? LEDGER_PRESET : undefined}
    />
  );
}
