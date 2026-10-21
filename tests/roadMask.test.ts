import { describe, expect, it } from 'vitest';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, roadConnections } from '../src/render/roadMask';
import { foundedSim } from './helpers';

describe('roadConnections', () => {
  it('reports which neighbours a road tile joins, as N E S W bits', () => {
    const sim = foundedSim();
    sim.placeRoadLine(2, 5, 6, 5);
    sim.placeRoadLine(4, 5, 4, 7);
    const road = sim.state.road;
    expect(roadConnections(road, 3, 5)).toBe(ROAD_E | ROAD_W);
    expect(roadConnections(road, 4, 5)).toBe(ROAD_E | ROAD_W | ROAD_S);
    expect(roadConnections(road, 2, 5)).toBe(ROAD_E);
    expect(roadConnections(road, 4, 7)).toBe(ROAD_N);
    expect(roadConnections(road, 0, 0)).toBe(0);
  });
});
