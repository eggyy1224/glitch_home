import * as THREE from "three";

export const clamp01 = (value) => THREE.MathUtils.clamp(value, 0, 1);

export const toVec3 = (anchor) => new THREE.Vector3(anchor?.x || 0, anchor?.y || 0, anchor?.z || 0);

export const makeRing = (names, radius, yOffset, jitter, center) => {
  const N = Math.max(names.length, 1);
  return names.map((name, index) => {
    const t = (index / N) * Math.PI * 2;
    return {
      name,
      pos: new THREE.Vector3(
        center.x + Math.cos(t) * radius,
        center.y + yOffset + Math.sin(index * 1.3) * 0.4 * jitter,
        center.z + Math.sin(t) * radius,
      ),
    };
  });
};

export const wobblePosition = (pos, t, speed = 0.2, amp = 0.4, phase = 0) =>
  new THREE.Vector3(
    pos.x + Math.sin(t * speed + phase + pos.z * 0.1) * amp,
    pos.y + Math.sin(t * (speed * 1.3) + phase + pos.x * 0.1) * amp * 0.4,
    pos.z + Math.cos(t * (speed * 0.9) + phase + pos.y * 0.1) * amp,
  );

export const seededRandom = (key, salt = 0) => {
  const str = `${key}:${salt}`;
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash) * 43758.5453;
  return x - Math.floor(x);
};

export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
