import * as THREE from 'three';

/**
 * Accumulates flat-shaded, vertex-coloured triangles into one BufferGeometry.
 * Every face gets its own vertices, so edges stay crisp. Colours are passed as
 * THREE.Color so conversion happens once per call, not once per vertex.
 */
export class GeometryBuilder {
  private positions = new Float32Array(3 * 1024);
  private normals = new Float32Array(3 * 1024);
  private colors = new Float32Array(3 * 1024);
  private count = 0;

  private vertex(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    c: THREE.Color,
  ): void {
    if (this.count * 3 + 3 > this.positions.length) this.grow();
    const i = this.count * 3;
    this.positions[i] = x;
    this.positions[i + 1] = y;
    this.positions[i + 2] = z;
    this.normals[i] = nx;
    this.normals[i + 1] = ny;
    this.normals[i + 2] = nz;
    this.colors[i] = c.r;
    this.colors[i + 1] = c.g;
    this.colors[i + 2] = c.b;
    this.count++;
  }

  private grow(): void {
    const next = this.positions.length * 2;
    const grownPositions = new Float32Array(next);
    grownPositions.set(this.positions);
    this.positions = grownPositions;
    const grownNormals = new Float32Array(next);
    grownNormals.set(this.normals);
    this.normals = grownNormals;
    const grownColors = new Float32Array(next);
    grownColors.set(this.colors);
    this.colors = grownColors;
  }

  /** Quad a-b-c-d, counter-clockwise seen from the front, with an explicit outward normal. */
  quad(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
    dx: number,
    dy: number,
    dz: number,
    nx: number,
    ny: number,
    nz: number,
    color: THREE.Color,
  ): void {
    this.vertex(ax, ay, az, nx, ny, nz, color);
    this.vertex(bx, by, bz, nx, ny, nz, color);
    this.vertex(cx, cy, cz, nx, ny, nz, color);
    this.vertex(ax, ay, az, nx, ny, nz, color);
    this.vertex(cx, cy, cz, nx, ny, nz, color);
    this.vertex(dx, dy, dz, nx, ny, nz, color);
  }

  /** Triangle a-b-c, counter-clockwise seen from the front; the normal comes from the winding. */
  tri(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
    color: THREE.Color,
  ): void {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    this.vertex(ax, ay, az, nx, ny, nz, color);
    this.vertex(bx, by, bz, nx, ny, nz, color);
    this.vertex(cx, cy, cz, nx, ny, nz, color);
  }

  /** Horizontal square facing up, from (x0, z0) to (x1, z1) at height y. */
  floor(x0: number, z0: number, x1: number, z1: number, y: number, color: THREE.Color): void {
    this.quad(x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0, 0, 1, 0, color);
  }

  /** Vertical face between ground points a and b, from y0 up to y1, facing left of the a-to-b direction. */
  wall(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    y0: number,
    y1: number,
    color: THREE.Color,
  ): void {
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = (bz - az) / len;
    const nz = -(bx - ax) / len;
    this.quad(ax, y0, az, ax, y1, az, bx, y1, bz, bx, y0, bz, nx, 0, nz, color);
  }

  /** Axis-aligned box from min corner to max corner, without a bottom face. */
  box(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    color: THREE.Color,
  ): void {
    this.floor(x0, z0, x1, z1, y1, color);
    this.wall(x0, z1, x0, z0, y0, y1, color);
    this.wall(x1, z0, x1, z1, y0, y1, color);
    this.wall(x0, z0, x1, z0, y0, y1, color);
    this.wall(x1, z1, x0, z1, y0, y1, color);
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const n = this.count * 3;
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions.slice(0, n), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(this.normals.slice(0, n), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors.slice(0, n), 3));
    return geometry;
  }
}
