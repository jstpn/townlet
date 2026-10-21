import * as THREE from 'three';
import { GeometryBuilder } from './geometryBuilder';

/** Which palette colour a model part takes. Walls and roofs vary per building. */
export type Role = 'wall' | 'roof' | 'trim' | 'foliage' | 'trunk' | 'dark' | 'accent';

/** A window slot in model space: position and outward normal. */
export type WindowSlot = { x: number; y: number; z: number; nx: number; nz: number };

export type Model = {
  size: 1 | 2;
  parts: Map<Role, THREE.BufferGeometry>;
  windows: WindowSlot[];
};

export type ModelKey = keyof ReturnType<typeof buildModels>;

const WHITE = new THREE.Color('#ffffff');
const TAU = Math.PI * 2;

/** Builds one model's parts, grouped by role, in a local space of `size` tiles on a side. */
class ModelBuilder {
  private readonly parts = new Map<Role, GeometryBuilder>();
  readonly windows: WindowSlot[] = [];

  constructor(private readonly size: 1 | 2) {}

  private g(role: Role): GeometryBuilder {
    let builder = this.parts.get(role);
    if (!builder) {
      builder = new GeometryBuilder();
      this.parts.set(role, builder);
    }
    return builder;
  }

  box(role: Role, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): this {
    this.g(role).box(x0, y0, z0, x1, y1, z1, WHITE);
    return this;
  }

  /** Two-slope roof over a rectangle, ridge along x when `alongX`, with a small overhang. */
  gable(
    role: Role,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y0: number,
    y1: number,
    alongX = true,
  ): this {
    const o = 0.05;
    const g = this.g(role);
    if (alongX) {
      const zm = (z0 + z1) / 2;
      g.quad(
        x0 - o,
        y0,
        z0 - o,
        x0 - o,
        y1,
        zm,
        x1 + o,
        y1,
        zm,
        x1 + o,
        y0,
        z0 - o,
        0,
        0.7,
        -0.7,
        WHITE,
      );
      g.quad(
        x1 + o,
        y0,
        z1 + o,
        x1 + o,
        y1,
        zm,
        x0 - o,
        y1,
        zm,
        x0 - o,
        y0,
        z1 + o,
        0,
        0.7,
        0.7,
        WHITE,
      );
      g.tri(x0, y0, z0, x0, y1, zm, x0, y0, z1, WHITE);
      g.tri(x1, y0, z1, x1, y1, zm, x1, y0, z0, WHITE);
    } else {
      const xm = (x0 + x1) / 2;
      g.quad(
        x1 + o,
        y0,
        z0 - o,
        xm,
        y1,
        z0 - o,
        xm,
        y1,
        z1 + o,
        x1 + o,
        y0,
        z1 + o,
        0.7,
        0.7,
        0,
        WHITE,
      );
      g.quad(
        x0 - o,
        y0,
        z1 + o,
        xm,
        y1,
        z1 + o,
        xm,
        y1,
        z0 - o,
        x0 - o,
        y0,
        z0 - o,
        -0.7,
        0.7,
        0,
        WHITE,
      );
      g.tri(x0, y0, z0, xm, y1, z0, x1, y0, z0, WHITE);
      g.tri(x1, y0, z1, xm, y1, z1, x0, y0, z1, WHITE);
    }
    return this;
  }

  /** Four-slope roof meeting at a point or short ridge. */
  hip(role: Role, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number): this {
    const o = 0.05;
    const g = this.g(role);
    const w = x1 - x0;
    const d = z1 - z0;
    const inset = Math.min(w, d) / 2;
    const rx0 = x0 + inset;
    const rx1 = x1 - inset;
    const rz0 = z0 + inset;
    const rz1 = z1 - inset;
    g.quad(x0 - o, y0, z0 - o, rx0, y1, rz0, rx1, y1, rz0, x1 + o, y0, z0 - o, 0, 0.7, -0.7, WHITE);
    g.quad(x1 + o, y0, z1 + o, rx1, y1, rz1, rx0, y1, rz1, x0 - o, y0, z1 + o, 0, 0.7, 0.7, WHITE);
    g.quad(x1 + o, y0, z0 - o, rx1, y1, rz0, rx1, y1, rz1, x1 + o, y0, z1 + o, 0.7, 0.7, 0, WHITE);
    g.quad(x0 - o, y0, z1 + o, rx0, y1, rz1, rx0, y1, rz0, x0 - o, y0, z0 - o, -0.7, 0.7, 0, WHITE);
    if (rx1 > rx0 || rz1 > rz0) g.floor(rx0, rz0, rx1, rz1, y1, WHITE);
    return this;
  }

  cylinder(role: Role, cx: number, cz: number, r: number, y0: number, y1: number, segs = 8): this {
    const g = this.g(role);
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * TAU;
      const a1 = ((i + 1) / segs) * TAU;
      const x0 = cx + r * Math.cos(a0);
      const z0 = cz + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1);
      const z1 = cz + r * Math.sin(a1);
      g.wall(x1, z1, x0, z0, y0, y1, WHITE);
      g.tri(cx, y1, cz, x0, y1, z0, x1, y1, z1, WHITE);
    }
    return this;
  }

  cone(role: Role, cx: number, cz: number, r: number, y0: number, y1: number, segs = 8): this {
    const g = this.g(role);
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * TAU;
      const a1 = ((i + 1) / segs) * TAU;
      g.tri(
        cx + r * Math.cos(a1),
        y0,
        cz + r * Math.sin(a1),
        cx + r * Math.cos(a0),
        y0,
        cz + r * Math.sin(a0),
        cx,
        y1,
        cz,
        WHITE,
      );
    }
    return this;
  }

  dome(role: Role, cx: number, cz: number, r: number, y: number, segs = 8, rings = 3): this {
    const g = this.g(role);
    const ring = (k: number): { r: number; y: number } => ({
      r: r * Math.cos((k / rings) * (Math.PI / 2)),
      y: y + r * Math.sin((k / rings) * (Math.PI / 2)),
    });
    for (let k = 0; k < rings; k++) {
      const lo = ring(k);
      const hi = ring(k + 1);
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * TAU;
        const a1 = ((i + 1) / segs) * TAU;
        const p = (rr: number, yy: number, a: number): [number, number, number] => [
          cx + rr * Math.cos(a),
          yy,
          cz + rr * Math.sin(a),
        ];
        const [ax, ay, az] = p(lo.r, lo.y, a1);
        const [bx, by, bz] = p(lo.r, lo.y, a0);
        const [cx1, cy1, cz1] = p(hi.r, hi.y, a0);
        const [dx, dy, dz] = p(hi.r, hi.y, a1);
        g.tri(ax, ay, az, bx, by, bz, cx1, cy1, cz1, WHITE);
        if (hi.r > 1e-6) g.tri(ax, ay, az, cx1, cy1, cz1, dx, dy, dz, WHITE);
      }
    }
    return this;
  }

  /** A small tree: trunk and two crowns. */
  tree(cx: number, cz: number, scale = 1): this {
    this.cylinder('trunk', cx, cz, 0.05 * scale, 0, 0.3 * scale, 5);
    this.cone('foliage', cx, cz, 0.28 * scale, 0.22 * scale, 0.7 * scale, 6);
    this.cone('foliage', cx, cz, 0.2 * scale, 0.5 * scale, 0.92 * scale, 6);
    return this;
  }

  /**
   * `n` windows spread along the wall from (ax, az) to (bx, bz), at each height in `ys`, facing
   * right of the a-to-b direction: walk the wall with the building on your left.
   */
  windowsOn(ax: number, az: number, bx: number, bz: number, ys: number[], n: number): this {
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      for (const y of ys) {
        this.windows.push({ x: ax + (bx - ax) * t, y, z: az + (bz - az) * t, nx, nz });
      }
    }
    return this;
  }

  /** Windows on all four sides of a box, `n` per side along x and `m` per side along z. */
  windowsAround(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    ys: number[],
    n: number,
    m: number,
  ): this {
    this.windowsOn(x0, z1, x1, z1, ys, n);
    this.windowsOn(x1, z0, x0, z0, ys, n);
    this.windowsOn(x1, z1, x1, z0, ys, m);
    this.windowsOn(x0, z0, x0, z1, ys, m);
    return this;
  }

  build(): Model {
    const parts = new Map<Role, THREE.BufferGeometry>();
    for (const [role, g] of this.parts) parts.set(role, g.build());
    return { size: this.size, parts, windows: this.windows };
  }
}

/** The front of every model faces +z; the layer turns it toward the nearest road. */
function define(size: 1 | 2, draw: (m: ModelBuilder) => void): Model {
  const m = new ModelBuilder(size);
  draw(m);
  return m.build();
}

/** Every model, built fresh. The literal's keys define `ModelKey`. */
export function buildModels() {
  return {
    res1: define(1, (m) => {
      m.box('wall', 0.22, 0, 0.22, 0.78, 0.36, 0.78)
        .gable('roof', 0.22, 0.22, 0.78, 0.78, 0.36, 0.62)
        .box('dark', 0.6, 0.5, 0.3, 0.68, 0.72, 0.38)
        .box('trim', 0.44, 0, 0.78, 0.56, 0.24, 0.8)
        .windowsOn(0.22, 0.78, 0.78, 0.78, [0.2], 2)
        .windowsOn(0.78, 0.22, 0.22, 0.22, [0.2], 2);
    }),
    res2: define(1, (m) => {
      m.box('wall', 0.14, 0, 0.18, 0.86, 0.72, 0.82)
        .box('trim', 0.12, 0.34, 0.16, 0.88, 0.37, 0.84)
        .hip('roof', 0.14, 0.18, 0.86, 0.82, 0.72, 0.98)
        .box('dark', 0.7, 0.8, 0.4, 0.78, 1.04, 0.48)
        .box('trim', 0.44, 0, 0.82, 0.56, 0.26, 0.84)
        .windowsAround(0.14, 0.18, 0.86, 0.82, [0.2, 0.55], 3, 2);
    }),
    res3: define(1, (m) => {
      m.box('wall', 0.1, 0, 0.12, 0.9, 1.25, 0.88)
        .box('trim', 0.08, 1.25, 0.1, 0.92, 1.32, 0.9)
        .box('roof', 0.1, 1.32, 0.12, 0.9, 1.36, 0.88)
        .box('trim', 0.3, 1.36, 0.3, 0.55, 1.52, 0.5)
        .box('trim', 0.42, 0, 0.88, 0.58, 0.3, 0.9)
        .windowsAround(0.1, 0.12, 0.9, 0.88, [0.2, 0.55, 0.9], 3, 3);
    }),
    com1: define(1, (m) => {
      m.box('wall', 0.28, 0, 0.3, 0.72, 0.34, 0.7)
        .box('accent', 0.2, 0.34, 0.22, 0.8, 0.4, 0.78)
        .box('trim', 0.26, 0.4, 0.28, 0.74, 0.44, 0.72)
        .box('trim', 0.3, 0.1, 0.7, 0.7, 0.26, 0.72)
        .windowsOn(0.72, 0.7, 0.72, 0.3, [0.18], 1)
        .windowsOn(0.28, 0.3, 0.28, 0.7, [0.18], 1);
    }),
    com2: define(1, (m) => {
      m.box('wall', 0.1, 0, 0.15, 0.9, 0.58, 0.85)
        .box('trim', 0.08, 0.58, 0.13, 0.92, 0.64, 0.87)
        .box('accent', 0.14, 0.3, 0.85, 0.86, 0.34, 0.98)
        .box('trim', 0.62, 0, 0.85, 0.74, 0.26, 0.87)
        .windowsOn(0.1, 0.85, 0.9, 0.85, [0.16], 2)
        .windowsAround(0.1, 0.15, 0.9, 0.85, [0.46], 3, 2);
    }),
    com3: define(1, (m) => {
      m.box('wall', 0.08, 0, 0.1, 0.92, 0.98, 0.9)
        .box('trim', 0.06, 0.32, 0.08, 0.94, 0.35, 0.92)
        .box('trim', 0.06, 0.64, 0.08, 0.94, 0.67, 0.92)
        .box('trim', 0.06, 0.98, 0.08, 0.94, 1.05, 0.92)
        .box('accent', 0.3, 1.05, 0.46, 0.7, 1.22, 0.54)
        .box('trim', 0.36, 0, 0.9, 0.64, 0.28, 0.92)
        .windowsAround(0.08, 0.1, 0.92, 0.9, [0.18, 0.5, 0.82], 4, 3);
    }),
    ind1: define(1, (m) => {
      m.box('wall', 0.12, 0, 0.14, 0.88, 0.4, 0.86)
        .gable('roof', 0.12, 0.14, 0.5, 0.86, 0.4, 0.58, false)
        .gable('roof', 0.5, 0.14, 0.88, 0.86, 0.4, 0.58, false)
        .box('dark', 0.74, 0.3, 0.2, 0.82, 0.7, 0.28)
        .box('dark', 0.3, 0, 0.86, 0.56, 0.3, 0.88)
        .windowsOn(0.88, 0.14, 0.12, 0.14, [0.26], 3);
    }),
    ind2: define(1, (m) => {
      m.box('wall', 0.1, 0, 0.12, 0.9, 0.56, 0.88)
        .box('roof', 0.08, 0.56, 0.1, 0.92, 0.62, 0.9)
        .cylinder('dark', 0.74, 0.3, 0.07, 0.6, 1.15, 6)
        .cylinder('trim', 0.74, 0.3, 0.085, 1.1, 1.18, 6)
        .box('dark', 0.26, 0, 0.88, 0.52, 0.34, 0.9)
        .windowsOn(0.9, 0.12, 0.1, 0.12, [0.36], 4)
        .windowsOn(0.1, 0.88, 0.9, 0.88, [0.36], 2);
    }),
    ind3: define(1, (m) => {
      m.box('wall', 0.06, 0, 0.1, 0.62, 0.8, 0.9)
        .box('roof', 0.04, 0.8, 0.08, 0.64, 0.86, 0.92)
        .box('wall', 0.62, 0, 0.3, 0.94, 0.42, 0.9)
        .box('roof', 0.6, 0.42, 0.28, 0.96, 0.47, 0.92)
        .cylinder('trim', 0.8, 0.18, 0.11, 0, 0.55, 8)
        .cylinder('dark', 0.2, 0.26, 0.07, 0.86, 1.5, 6)
        .cylinder('dark', 0.44, 0.26, 0.07, 0.86, 1.3, 6)
        .box('dark', 0.22, 0, 0.9, 0.46, 0.4, 0.92)
        .windowsOn(0.62, 0.1, 0.06, 0.1, [0.3, 0.6], 3)
        .windowsOn(0.06, 0.9, 0.62, 0.9, [0.6], 3);
    }),
    townHall: define(2, (m) => {
      m.box('wall', 0.55, 0, 0.5, 1.45, 0.95, 1.5)
        .box('trim', 0.52, 0.95, 0.47, 1.48, 1.02, 1.53)
        .box('wall', 0.12, 0, 0.6, 0.55, 0.62, 1.4)
        .box('wall', 1.45, 0, 0.6, 1.88, 0.62, 1.4)
        .hip('roof', 0.12, 0.6, 0.55, 1.4, 0.62, 0.85)
        .hip('roof', 1.45, 0.6, 1.88, 1.4, 0.62, 0.85)
        .cylinder('wall', 1, 1, 0.26, 1.02, 1.2, 10)
        .dome('roof', 1, 1, 0.3, 1.2, 10, 3)
        .box('trim', 0.98, 1.48, 0.98, 1.02, 1.62, 1.02)
        .box('trim', 0.7, 0, 1.5, 1.3, 0.08, 1.75)
        .box('trim', 0.78, 0.08, 1.5, 1.22, 0.14, 1.66)
        .box('dark', 0.9, 0.14, 1.5, 1.1, 0.5, 1.52)
        .box('trim', 0.62, 0.14, 1.5, 0.68, 0.9, 1.56)
        .box('trim', 1.32, 0.14, 1.5, 1.38, 0.9, 1.56)
        .windowsOn(0.55, 1.5, 1.45, 1.5, [0.32, 0.7], 4)
        .windowsOn(1.45, 0.5, 0.55, 0.5, [0.32, 0.7], 4)
        .windowsOn(0.12, 1.4, 0.55, 1.4, [0.3], 2)
        .windowsOn(1.45, 1.4, 1.88, 1.4, [0.3], 2);
    }),
    windTurbine: define(1, (m) => {
      m.cylinder('trim', 0.5, 0.5, 0.05, 0, 1.7, 6)
        .cylinder('trim', 0.5, 0.5, 0.09, 0, 0.1, 6)
        .box('trim', 0.42, 1.64, 0.4, 0.58, 1.78, 0.62);
    }),
    turbineBlades: define(1, (m) => {
      // One blade up the y axis from the hub; the layer places three per turbine, spinning about z.
      m.box('trim', -0.025, 0, -0.012, 0.025, 0.52, 0.012).box(
        'trim',
        -0.05,
        -0.05,
        -0.03,
        0.05,
        0.05,
        0.03,
      );
    }),
    waterTower: define(1, (m) => {
      for (const [x, z] of [
        [0.3, 0.3],
        [0.7, 0.3],
        [0.3, 0.7],
        [0.7, 0.7],
      ] as const) {
        m.box('dark', x - 0.03, 0, z - 0.03, x + 0.03, 0.9, z + 0.03);
      }
      m.box('dark', 0.26, 0.45, 0.26, 0.74, 0.49, 0.74)
        .cylinder('trim', 0.5, 0.5, 0.3, 0.9, 1.3, 8)
        .box('accent', 0.2, 1.05, 0.49, 0.8, 1.16, 0.51)
        .cone('roof', 0.5, 0.5, 0.33, 1.3, 1.52, 8);
    }),
    park: define(1, (m) => {
      m.box('foliage', 0.04, 0, 0.04, 0.96, 0.03, 0.96)
        .box('trim', 0.46, 0.03, 0.04, 0.54, 0.05, 0.96)
        .tree(0.25, 0.3, 0.75)
        .tree(0.72, 0.68, 0.85)
        .tree(0.3, 0.74, 0.6)
        .box('trunk', 0.62, 0.05, 0.24, 0.82, 0.12, 0.3);
    }),
    school: define(2, (m) => {
      m.box('wall', 0.15, 0, 0.45, 1.85, 0.6, 1.4)
        .gable('roof', 0.15, 0.45, 1.85, 1.4, 0.6, 0.92)
        .box('wall', 1.5, 0, 0.5, 1.9, 1.15, 0.9)
        .hip('roof', 1.5, 0.5, 1.9, 0.9, 1.15, 1.4)
        .box('accent', 1.66, 0.96, 0.66, 1.74, 1.06, 0.74)
        .box('trim', 0.72, 0, 1.4, 0.92, 0.36, 1.42)
        .box('trim', 0.15, 0, 1.4, 1.85, 0.05, 1.5)
        .windowsOn(0.15, 1.4, 1.5, 1.4, [0.34], 5)
        .windowsOn(1.85, 0.45, 0.15, 0.45, [0.34], 6);
    }),
    clinic: define(1, (m) => {
      m.box('wall', 0.12, 0, 0.14, 0.88, 0.66, 0.86)
        .box('trim', 0.1, 0.66, 0.12, 0.9, 0.74, 0.88)
        .box('accent', 0.44, 0.42, 0.86, 0.56, 0.6, 0.88)
        .box('accent', 0.38, 0.48, 0.86, 0.62, 0.54, 0.88)
        .box('dark', 0.4, 0, 0.86, 0.6, 0.3, 0.88)
        .windowsOn(0.12, 0.86, 0.88, 0.86, [0.2], 2)
        .windowsAround(0.12, 0.14, 0.88, 0.86, [0.5], 0, 2);
    }),
    fireStation: define(1, (m) => {
      m.box('wall', 0.1, 0, 0.12, 0.9, 0.62, 0.88)
        .box('roof', 0.08, 0.62, 0.1, 0.92, 0.68, 0.9)
        .box('dark', 0.18, 0, 0.88, 0.5, 0.48, 0.9)
        .box('dark', 0.54, 0, 0.88, 0.84, 0.48, 0.9)
        .box('accent', 0.1, 0.5, 0.88, 0.9, 0.58, 0.9)
        .box('wall', 0.14, 0.68, 0.16, 0.36, 1.3, 0.38)
        .hip('roof', 0.14, 0.16, 0.36, 0.38, 1.3, 1.46)
        .windowsOn(0.9, 0.12, 0.1, 0.12, [0.36], 3)
        .windowsOn(0.14, 0.38, 0.36, 0.38, [0.9, 1.1], 1);
    }),
    policeStation: define(1, (m) => {
      m.box('wall', 0.12, 0, 0.14, 0.88, 0.66, 0.86)
        .hip('roof', 0.12, 0.14, 0.88, 0.86, 0.66, 0.9)
        .box('dark', 0.42, 0, 0.86, 0.58, 0.32, 0.88)
        .box('trim', 0.3, 0, 0.86, 0.7, 0.04, 0.96)
        .cylinder('dark', 0.78, 0.94, 0.02, 0, 0.5, 5)
        .box('accent', 0.74, 0.5, 0.9, 0.82, 0.6, 0.98)
        .windowsOn(0.12, 0.86, 0.88, 0.86, [0.22], 2)
        .windowsAround(0.12, 0.14, 0.88, 0.86, [0.48], 3, 2);
    }),
    tree: define(1, (m) => {
      m.tree(0.5, 0.5, 1.05);
    }),
    plaza: define(1, (m) => {
      m.box('trim', 0.02, 0, 0.02, 0.98, 0.04, 0.98)
        .cylinder('accent', 0.5, 0.5, 0.18, 0.04, 0.06, 10)
        .cylinder('dark', 0.5, 0.5, 0.05, 0.06, 0.22, 6)
        .cylinder('trim', 0.5, 0.5, 0.12, 0.22, 0.26, 10);
      for (const [x, z] of [
        [0.12, 0.12],
        [0.88, 0.12],
        [0.12, 0.88],
        [0.88, 0.88],
      ] as const) {
        m.box('dark', x - 0.025, 0.04, z - 0.025, x + 0.025, 0.2, z + 0.025);
      }
    }),
  };
}
