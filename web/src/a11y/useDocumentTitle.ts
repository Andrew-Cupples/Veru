import { useEffect } from 'react';

/** Sets the tab title, which screen readers announce on page change. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Veru` : 'Veru';
  }, [title]);
}
