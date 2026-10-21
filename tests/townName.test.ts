import { describe, expect, it } from 'vitest';
import { townName } from '../src/ui/townName';

describe('townName', () => {
  it('is stable for a seed and differs between seeds', () => {
    expect(townName('budapest')).toBe(townName('budapest'));
    expect(townName('budapest')).not.toBe(townName('moonrise'));
    expect(townName('budapest')).toMatch(/^[A-Z][A-Za-z ]+$/);
  });
});
