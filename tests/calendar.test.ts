import { describe, expect, it } from 'vitest';
import { formatDate } from '../src/ui/calendar';

describe('calendar', () => {
  it('counts thirty-day months from 1 January, year 1', () => {
    expect(formatDate(0)).toBe('1 January, year 1');
    expect(formatDate(29)).toBe('30 January, year 1');
    expect(formatDate(30)).toBe('1 February, year 1');
    expect(formatDate(359)).toBe('30 December, year 1');
    expect(formatDate(360)).toBe('1 January, year 2');
  });
});
