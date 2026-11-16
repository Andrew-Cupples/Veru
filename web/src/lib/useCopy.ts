import { useCallback, useEffect, useRef, useState } from 'react';

/** Copies text to the clipboard and remembers what was copied last for ~1.4s, for a "Copied" hint. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return; // Clipboard blocked (insecure origin or denied permission): nothing to confirm.
    }
    setCopied(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1400);
  }, []);

  return { copied, copy };
}
