import { DAYS_PER_MONTH } from '../sim/sim';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "14 March, year 2" from a day count starting at 0 on 1 January, year 1. */
export function formatDate(day: number): string {
  const month = Math.floor(day / DAYS_PER_MONTH);
  const dayOfMonth = (day % DAYS_PER_MONTH) + 1;
  const name = MONTHS[month % 12] ?? MONTHS[0];
  return `${dayOfMonth} ${name}, year ${Math.floor(month / 12) + 1}`;
}
