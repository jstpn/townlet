import * as THREE from 'three';

/** Night tint, a faint vignette and light grain, as one full-screen pass. Runs on the linear buffer before output. */
export const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    nightColor: { value: new THREE.Color('#4a3b63') },
    night: { value: 0 },
    time: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 nightColor;
    uniform float night;
    uniform float time;
    const float GRAIN = 0.014;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // Night pulls the picture toward the palette's night colour rather than toward black.
      vec3 dim = c.rgb * nightColor * 1.7 + nightColor * 0.12;
      vec3 col = mix(c.rgb, dim, night * 0.65);
      float d = distance(vUv, vec2(0.5));
      col *= 1.0 - smoothstep(0.4, 0.95, d) * 0.22;
      col += (hash(vUv * 1024.0 + fract(time)) - 0.5) * GRAIN;
      gl_FragColor = vec4(col, c.a);
    }
  `,
};
