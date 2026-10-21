import { describe, expect, it } from 'vitest';
import {
  MAP_SIZE,
  TILE_COUNT,
  UNREACHABLE,
  distanceField,
  idx,
  largestRegionSize,
  lineTiles,
  rectTiles,
  roadPath,
  snapToAxis,
} from '../src/sim/grid';

describe('largestRegionSize', () => {
  it('counts the biggest 4-connected blob only', () => {
    const mask = new Uint8Array(TILE_COUNT);
    for (const [x, y] of [
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
      [2, 2],
      [3, 2],
      [10, 10],
      [11, 10],
      [12, 10],
    ]) {
      mask[idx(x, y)] = 1;
    }
    expect(largestRegionSize((tile) => mask[tile] === 1)).toBe(6);
  });

  it('does not join tiles that only touch at a corner', () => {
    const mask = new Uint8Array(TILE_COUNT);
    mask[idx(5, 5)] = 1;
    mask[idx(6, 6)] = 1;
    expect(largestRegionSize((tile) => mask[tile] === 1)).toBe(1);
    expect(largestRegionSize(() => false)).toBe(0);
  });
});

describe('distanceField', () => {
  it('measures steps from the nearest source and marks nothing unreachable on an open grid', () => {
    const field = distanceField((tile) => tile === idx(10, 10));
    expect(field[idx(10, 10)]).toBe(0);
    expect(field[idx(13, 10)]).toBe(3);
    expect(field[idx(12, 12)]).toBe(4);
    expect(field[idx(0, 0)]).toBe(20);
    expect(Array.from(field).includes(UNREACHABLE)).toBe(false);
  });

  it('marks every tile unreachable when there are no sources', () => {
    const field = distanceField(() => false);
    expect(field[0]).toBe(UNREACHABLE);
    expect(field[TILE_COUNT - 1]).toBe(UNREACHABLE);
  });
});

describe('lines and rectangles', () => {
  it('snaps a drag onto the axis that moved most, favouring horizontal on a tie', () => {
    expect(snapToAxis({ x: 2, y: 2 }, { x: 7, y: 4 })).toEqual({ x: 7, y: 2 });
    expect(snapToAxis({ x: 2, y: 2 }, { x: 3, y: 9 })).toEqual({ x: 2, y: 9 });
    expect(snapToAxis({ x: 2, y: 2 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 2 });
  });

  it('walks a line in either direction and clips it to the map', () => {
    expect(lineTiles(4, 1, 1, 1)).toEqual([idx(4, 1), idx(3, 1), idx(2, 1), idx(1, 1)]);
    expect(lineTiles(0, 3, 0, 5)).toEqual([idx(0, 3), idx(0, 4), idx(0, 5)]);
    expect(lineTiles(MAP_SIZE - 2, 0, MAP_SIZE + 1, 0)).toEqual([
      idx(MAP_SIZE - 2, 0),
      idx(MAP_SIZE - 1, 0),
    ]);
  });

  it('covers a rectangle from any two corners and clips it to the map', () => {
    expect(rectTiles(3, 3, 2, 2)).toEqual([idx(2, 2), idx(3, 2), idx(2, 3), idx(3, 3)]);
    expect(rectTiles(-1, 0, 0, 0)).toEqual([idx(0, 0)]);
  });
});

describe('roadPath', () => {
  const road = new Uint8Array(TILE_COUNT);
  for (let x = 2; x <= 8; x++) road[idx(x, 5)] = 1;
  for (let y = 5; y <= 9; y++) road[idx(8, y)] = 1;
  road[idx(20, 20)] = 1;

  it('follows the road from one tile to another', () => {
    const path = roadPath(road, idx(2, 5), idx(8, 9));
    expect(path?.[0]).toBe(idx(2, 5));
    expect(path?.at(-1)).toBe(idx(8, 9));
    expect(path).toHaveLength(11);
    expect(path?.every((t) => road[t] === 1)).toBe(true);
  });

  it('is undefined between disconnected roads', () => {
    expect(roadPath(road, idx(2, 5), idx(20, 20))).toBeUndefined();
  });

  it('is a single tile when start and end match', () => {
    expect(roadPath(road, idx(4, 5), idx(4, 5))).toEqual([idx(4, 5)]);
  });
});
