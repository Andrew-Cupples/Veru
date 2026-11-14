import { useMemo, useState, type CSSProperties } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createLedgerClient } from './api/client';
import { LedgerApiProvider } from './api/LedgerApiContext';
import { Workspace } from './components/Workspace';
import { presetStyle, type ColorScheme, type ThemePreset } from './theme/theme';
import '@fontsource-variable/inter';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/jetbrains-mono';
import './theme/tokens.css';

export interface PromptLedgerProps {
  /** Origin that serves the ledger's `/api` routes. Defaults to the current origin. */
  apiBaseUrl?: string;
  /** Pass the host app's QueryClient to share caching; otherwise the module creates its own. */
  queryClient?: QueryClient;
  /** Initial color scheme. The toolbar lets the user switch it afterwards, unless the host controls it. */
  colorScheme?: ColorScheme;
  /**
   * The host app owns light/dark: the module follows `colorScheme` as it changes and hides its own
   * scheme button, so there is one control for it instead of two that disagree.
   */
  hostControlsScheme?: boolean;
  /** Token overrides applied on top of the color scheme (the hook for future color presets). */
  preset?: ThemePreset;
  className?: string;
  style?: CSSProperties;
}

/**
 * The Prompt Ledger, as a self-contained module. It fills its parent's box (give the parent a height),
 * scopes all of its styles under `.pl-root`, and owns no routing, so it can drop into a host app as is.
 */
export function PromptLedger({ apiBaseUrl = '', queryClient, colorScheme = 'system', hostControlsScheme = false, preset, className, style }: PromptLedgerProps) {
  const client = useMemo(() => createLedgerClient(apiBaseUrl), [apiBaseUrl]);
  const [ownQueryClient] = useState(
    // Three retries with backoff (~7s) covers the API still starting when the UI loads first.
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 3 } } }),
  );
  const [ownScheme, setScheme] = useState<ColorScheme>(colorScheme);
  const scheme = hostControlsScheme ? colorScheme : ownScheme;

  return (
    <QueryClientProvider client={queryClient ?? ownQueryClient}>
      <LedgerApiProvider client={client}>
        <div
          className={['pl-root', className].filter(Boolean).join(' ')}
          data-pl-scheme={scheme}
          style={{ height: '100%', ...presetStyle(preset), ...style }}
        >
          <Workspace scheme={scheme} onSchemeChange={hostControlsScheme ? undefined : setScheme} />
        </div>
      </LedgerApiProvider>
    </QueryClientProvider>
  );
}
