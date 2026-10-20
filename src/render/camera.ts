import * as THREE from 'three';
import { MAP_SIZE } from '../sim/grid';

const PITCH = THREE.MathUtils.degToRad(35.264);
const DISTANCE = 140;
export const ZOOM_MIN = 6;
export const ZOOM_MAX = 44;

/** Orthographic camera on a rail: four snap rotations, smooth zoom, a ground target. */
export class CameraRig {
  readonly camera: THREE.OrthographicCamera;
  readonly target = new THREE.Vector3(MAP_SIZE / 2, 0, MAP_SIZE / 2);
  rotationIndex = 0;
  /** Half of the visible height in world units. */
  zoom = 20;
  private zoomTarget = 20;
  private yaw = Math.PI / 4;
  private yawTarget = Math.PI / 4;
  /** Extra yaw while the user is dragging to rotate. */
  dragYaw = 0;
  private aspect = 1;
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly raycaster = new THREE.Raycaster();

  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
    this.apply();
  }

  resize(width: number, height: number): void {
    this.aspect = width / height;
    this.apply();
  }

  rotate(direction: 1 | -1): void {
    this.rotationIndex = (this.rotationIndex + direction + 4) % 4;
    this.yawTarget += (direction * Math.PI) / 2;
  }

  /** Snaps the drag rotation to the nearest quarter turn and folds it into the rail. */
  commitDrag(): void {
    const steps = Math.round(this.dragYaw / (Math.PI / 2));
    this.dragYaw = 0;
    if (steps === 0) return;
    this.rotationIndex = (((this.rotationIndex + steps) % 4) + 4) % 4;
    this.yaw += steps * (Math.PI / 2);
    this.yawTarget += steps * (Math.PI / 2);
  }

  zoomBy(factor: number, anchorNdc?: THREE.Vector2Like): void {
    const before = anchorNdc ? this.groundPoint(anchorNdc) : undefined;
    this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * factor, ZOOM_MIN, ZOOM_MAX);
    if (!before || !anchorNdc) return;
    // Keep the ground under the cursor still: move the target by the drift the zoom caused.
    const savedZoom = this.zoom;
    this.zoom = this.zoomTarget;
    this.apply();
    const after = this.groundPoint(anchorNdc);
    this.zoom = savedZoom;
    if (after) this.target.add(before.sub(after));
    this.apply();
  }

  /** Pans in screen terms: right and up on the screen, scaled to the current zoom. */
  pan(right: number, up: number): void {
    const yaw = this.yaw + this.dragYaw;
    const rx = Math.sin(yaw);
    const rz = -Math.cos(yaw);
    const fx = -Math.cos(yaw);
    const fz = -Math.sin(yaw);
    const scale = this.zoom;
    this.target.x += (rx * right + fx * up) * scale;
    this.target.z += (rz * right + fz * up) * scale;
    this.clampTarget();
  }

  /** World point on the ground plane under a normalised device coordinate, or undefined off-plane. */
  groundPoint(ndc: THREE.Vector2Like): THREE.Vector3 | undefined {
    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, hit) ?? undefined;
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 10);
    this.yaw += (this.yawTarget - this.yaw) * k;
    this.zoom += (this.zoomTarget - this.zoom) * k;
    this.apply();
  }

  private clampTarget(): void {
    const margin = 6;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -margin, MAP_SIZE + margin);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -margin, MAP_SIZE + margin);
  }

  private apply(): void {
    const yaw = this.yaw + this.dragYaw;
    const c = this.camera;
    c.left = -this.zoom * this.aspect;
    c.right = this.zoom * this.aspect;
    c.top = this.zoom;
    c.bottom = -this.zoom;
    c.position.set(
      this.target.x + Math.cos(yaw) * Math.cos(PITCH) * DISTANCE,
      this.target.y + Math.sin(PITCH) * DISTANCE,
      this.target.z + Math.sin(yaw) * Math.cos(PITCH) * DISTANCE,
    );
    c.lookAt(this.target);
    c.updateProjectionMatrix();
  }
}
