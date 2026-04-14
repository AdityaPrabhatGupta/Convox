import { useState, useEffect } from 'react';

/**
 * Returns a debounced version of `value`.
 * Only updates after `delay` ms of no changes.
 *
 * @param {any}    value  - The value to debounce (your search query)
 * @param {number} delay  - Milliseconds to wait (use 350 for chat search)
 */
export function useDebounce(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set a timer to update debounced value after delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // CRITICAL: Cancel the timer if value changes before delay expires
    // This is the core of debounce — the cleanup function
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}