import * as THREE from "three";

export function getOverlapBox(a: THREE.Box3, b: THREE.Box3) {
  if (!a.intersectsBox(b)) return null;

  const min = new THREE.Vector3(
    Math.max(a.min.x, b.min.x),
    Math.max(a.min.y, b.min.y),
    Math.max(a.min.z, b.min.z),
  );
  const max = new THREE.Vector3(
    Math.min(a.max.x, b.max.x),
    Math.min(a.max.y, b.max.y),
    Math.min(a.max.z, b.max.z),
  );
  if (max.x < min.x || max.y < min.y || max.z < min.z) return null;
  return new THREE.Box3(min, max);
}

export function getOverlapVolume(a: THREE.Box3, b: THREE.Box3) {
  const overlap = getOverlapBox(a, b);
  if (!overlap) return 0;
  const overlapSize = overlap.getSize(new THREE.Vector3());
  return overlapSize.x * overlapSize.y * overlapSize.z;
}
