import * as THREE from 'three';

/** Temporary scene used to prove the toolchain renders. Replaced by the real renderer. */
export function startBlankScene(canvas: HTMLCanvasElement): void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f4ecd8');

  const aspect = window.innerWidth / window.innerHeight;
  const size = 10;
  const camera = new THREE.OrthographicCamera(-size * aspect, size * aspect, size, -size, 0.1, 200);
  camera.position.set(20, 20, 20);
  camera.lookAt(0, 0, 0);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: '#9fb37c', flatShading: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const house = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({ color: '#e9b5c4', flatShading: true }),
  );
  house.position.y = 1;
  scene.add(house);

  scene.add(new THREE.HemisphereLight('#dfe9f3', '#8a7a5a', 0.8));
  const sun = new THREE.DirectionalLight('#fff2d6', 2);
  sun.position.set(10, 20, 5);
  scene.add(sun);

  const resize = (): void => {
    const a = window.innerWidth / window.innerHeight;
    camera.left = -size * a;
    camera.right = size * a;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', resize);
  resize();

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
}
