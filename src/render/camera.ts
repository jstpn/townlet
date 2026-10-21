import * as THREE from 'three';
import { MAP_SIZE, inBounds, mod, type Point } from '../sim/grid';

const PITCH = THREE.MathUtils.degToRad(35.264);
const DISTANCE = 140;
const ZOOM_MIN = 6;
export const ZOOM_MAX = 44;
const SETTLED = 1e-4;

/** Where the camera looks, for saving. */
export type CameraPose = { x: number; z: number; zoom: number; rotation: number };

/** Orthographic camera on a rail: four snap rotations, smooth zoom, a ground target. */
export class CameraRig {
  readonly camera: THREE.OrthographicCamera;
  readonly target = new THREE.Vector3(MAP_SIZE / 2, 0, MAP_SIZE / 2);
  /** Which quarter turn the rail sits on, 0 to 3. Zero is the postcard view. */
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
  private readonly ndc = new THREE.Vector2();

  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
    this.apply();
  }

  pose(): CameraPose {
    return {
      x: this.target.x,
      z: this.target.z,
      zoom: this.zoomTarget,
      rotation: this.rotationIndex,
    };
  }

  /** Jumps straight to a saved pose, with no easing. */
  setPose(pose: CameraPose): void {
    this.target.set(pose.x, 0, pose.z);
    this.zoom = this.zoomTarget = THREE.MathUtils.clamp(pose.zoom, ZOOM_MIN, ZOOM_MAX);
    this.rotationIndex = mod(pose.rotation, 4);
    this.yaw = this.yawTarget = Math.PI / 4 + (this.rotationIndex * Math.PI) / 2;
    this.apply();
  }

  resize(width: number, height: number): void {
    this.aspect = width / height;
    this.apply();
  }

  rotate(direction: 1 | -1): void {
    this.rotationIndex = mod(this.rotationIndex + direction, 4);
    this.yawTarget += (direction * Math.PI) / 2;
  }

  /** Ends a drag rotation: the view keeps its dragged angle and eases onto the nearest quarter turn. */
  commitDrag(): void {
    const steps = Math.round(this.dragYaw / (Math.PI / 2));
    this.yaw += this.dragYaw;
    this.dragYaw = 0;
    this.rotationIndex = (((this.rotationIndex + steps) % 4) + 4) % 4;
    this.yawTarget += steps * (Math.PI / 2);
  }

  /**
   * Zooms about a screen point, keeping the ground under it still. Both samples use the settled
   * zoom, so repeated wheel ticks during the easing do not let the anchor drift.
   */
  zoomBy(factor: number, anchorNdc: THREE.Vector2Like): void {
    const savedZoom = this.zoom;
    this.zoom = this.zoomTarget;
    this.apply();
    const before = this.groundPoint(anchorNdc);
    this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * factor, ZOOM_MIN, ZOOM_MAX);
    this.zoom = this.zoomTarget;
    this.apply();
    const after = this.groundPoint(anchorNdc);
    this.zoom = savedZoom;
    if (before && after) this.target.add(before.sub(after));
    this.apply();
  }

  /** Pans in screen terms: right and up on the screen as fractions of the view, so the ground tracks the cursor. */
  pan(right: number, up: number): void {
    const yaw = this.yaw + this.dragYaw;
    const rx = Math.sin(yaw);
    const rz = -Math.cos(yaw);
    const fx = -Math.cos(yaw);
    const fz = -Math.sin(yaw);
    // The ground-forward axis is foreshortened by the pitch, so it needs more world distance per screen unit.
    const forward = (up * this.zoom) / Math.sin(PITCH);
    const sideways = right * this.zoom;
    this.target.x += rx * sideways + fx * forward;
    this.target.z += rz * sideways + fz * forward;
    const margin = 6;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -margin, MAP_SIZE + margin);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -margin, MAP_SIZE + margin);
    this.apply();
  }

  /** World point on the ground plane under a normalised device coordinate. */
  groundPoint(ndc: THREE.Vector2Like): THREE.Vector3 | undefined {
    this.raycaster.setFromCamera(this.ndc.set(ndc.x, ndc.y), this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, hit) ?? undefined;
  }

  /** Screen position (normalised device coordinates) of a ground point. */
  project(x: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, 0, z).project(this.camera);
    return { x: v.x, y: v.y };
  }

  /** The map tile under a normalised device coordinate, if any. */
  pickTile(ndc: THREE.Vector2Like): Point | undefined {
    const point = this.groundPoint(ndc);
    if (!point) return undefined;
    const x = Math.floor(point.x);
    const y = Math.floor(point.z);
    return inBounds(x, y) ? { x, y } : undefined;
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 10);
    this.yaw += (this.yawTarget - this.yaw) * k;
    this.zoom += (this.zoomTarget - this.zoom) * k;
    if (Math.abs(this.yawTarget - this.yaw) < SETTLED) this.yaw = this.yawTarget;
    if (Math.abs(this.zoomTarget - this.zoom) < SETTLED) this.zoom = this.zoomTarget;
    this.apply();
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
    c.updateMatrixWorld();
    c.updateProjectionMatrix();
  }
}
