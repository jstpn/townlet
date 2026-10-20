import * as THREE from 'three';

/**
 * Accumulates flat-shaded, vertex-coloured triangles into one BufferGeometry.
 * Every quad gets its own vertices, so faces stay crisp with flat shading.
 */
export class GeometryBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly color = new THREE.Color();
  private readonly ab = new THREE.Vector3();
  private readonly ac = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();

  /** Adds a quad a-b-c-d (counter-clockwise seen from the front) in one colour. */
  quad(
    a: THREE.Vector3Like,
    b: THREE.Vector3Like,
    c: THREE.Vector3Like,
    d: THREE.Vector3Like,
    hex: string | number,
  ): void {
    this.tri(a, b, c, hex);
    this.tri(a, c, d, hex);
  }

  tri(
    a: THREE.Vector3Like,
    b: THREE.Vector3Like,
    c: THREE.Vector3Like,
    hex: string | number,
  ): void {
    this.ab.set(b.x - a.x, b.y - a.y, b.z - a.z);
    this.ac.set(c.x - a.x, c.y - a.y, c.z - a.z);
    this.normal.crossVectors(this.ab, this.ac).normalize();
    this.color.set(hex);
    for (const p of [a, b, c]) {
      this.positions.push(p.x, p.y, p.z);
      this.normals.push(this.normal.x, this.normal.y, this.normal.z);
      this.colors.push(this.color.r, this.color.g, this.color.b);
    }
  }

  /** Axis-aligned box from min corner to max corner, in one colour, optionally without the bottom face. */
  box(min: THREE.Vector3Like, max: THREE.Vector3Like, hex: string | number, bottom = false): void {
    const { x: x0, y: y0, z: z0 } = min;
    const { x: x1, y: y1, z: z1 } = max;
    const v = (x: number, y: number, z: number): THREE.Vector3Like => ({ x, y, z });
    this.quad(v(x0, y1, z0), v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0), hex); // top
    this.quad(v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0), v(x0, y0, z0), hex); // west
    this.quad(v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1), hex); // east
    this.quad(v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0), v(x1, y0, z0), hex); // north
    this.quad(v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1), v(x0, y0, z1), hex); // south
    if (bottom) this.quad(v(x0, y0, z1), v(x1, y0, z1), v(x1, y0, z0), v(x0, y0, z0), hex);
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    return geometry;
  }

  get isEmpty(): boolean {
    return this.positions.length === 0;
  }
}
