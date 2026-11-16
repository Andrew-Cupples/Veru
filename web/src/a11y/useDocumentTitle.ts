import { useEffect } from 'react';
import { useT } from '../i18n/I18nProvider';

/** Sets the tab title, which screen readers announce on page change. */
export function useDocumentTitle(title: string) {
  const t = useT();
  useEffect(() => {
    document.title = t.appTitle(title);
  }, [t, title]);
}
