/** A random element of a non-empty list. */
export const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
