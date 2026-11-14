import type { KeyboardEvent } from 'react';

/**
 * Keyboard behaviour for a role="radiogroup" of buttons, per the WAI-ARIA radio group pattern:
 * one Tab stop (the checked option), and arrow keys / Home / End move the choice and focus together.
 *
 * Spread `radioProps(value)` onto each option and put `onKeyDown` on the group.
 */
export function radioGroup<T extends string>(values: readonly T[], current: T, select: (value: T) => void) {
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const index = values.indexOf(current);
    let next: number;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % values.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index - 1 + values.length) % values.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = values.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const value = values[next]!;
    select(value);
    const options = e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
    options[next]?.focus();
  };

  const radioProps = (value: T) => ({
    role: 'radio' as const,
    'aria-checked': value === current,
    // If nothing matches (e.g. a stale value), keep the first option reachable.
    tabIndex: value === current || (!values.includes(current) && value === values[0]) ? 0 : -1,
    onClick: () => select(value),
  });

  return { onKeyDown, radioProps };
}
