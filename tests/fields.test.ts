import { describe, expect, it } from 'vitest';
import { idx } from '../src/sim/grid';
import { Zone } from '../src/sim/types';
import { foundedSim as founded } from './helpers';

describe('coverage', () => {
  it('the town hall covers every service within its radius of the footprint', () => {
    const sim = founded();
    const cover = sim.coverage();
    expect(cover.school[idx(37, 37)]).toBe(1);
    expect(cover.power[idx(24, 24)]).toBe(1);
    expect(cover.water[idx(38, 30)]).toBe(0);
  });

  it('services add their own kind and follow building changes', () => {
    const sim = founded();
    expect(sim.coverage().park[idx(14, 14)]).toBe(0);
    sim.placeBuilding('park', 10, 10);
    expect(sim.coverage().park[idx(14, 14)]).toBe(1);
    expect(sim.coverage().park[idx(15, 10)]).toBe(0);
    expect(sim.coverage().power[idx(10, 10)]).toBe(0);
    sim.bulldozeRect(10, 10, 10, 10);
    expect(sim.coverage().park[idx(14, 14)]).toBe(0);
  });
});

describe('road access', () => {
  it('reaches two tiles either side of a road', () => {
    const sim = founded();
    sim.placeRoadLine(10, 10, 14, 10);
    const access = sim.roadAccess();
    expect(access[idx(12, 12)]).toBe(1);
    expect(access[idx(12, 13)]).toBe(0);
    expect(access[idx(16, 10)]).toBe(1);
    expect(access[idx(17, 10)]).toBe(0);
  });
});

describe('pollution', () => {
  it('falls off linearly from developed industry and is the max over emitters', () => {
    const sim = founded();
    sim.zoneRect(Zone.Industrial, 10, 10, 10, 10);
    expect(sim.pollution()[idx(10, 10)]).toBe(0);
    sim.state.level[idx(10, 10)] = 2;
    sim.state.rev.zones++;
    const field = sim.pollution();
    expect(field[idx(10, 10)]).toBeCloseTo(1);
    expect(field[idx(11, 10)]).toBeCloseTo(0.8);
    expect(field[idx(14, 14)]).toBeCloseTo(0.2);
    expect(field[idx(15, 10)]).toBe(0);
  });
});
