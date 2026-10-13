import * as THREE from 'three';

function surfaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d');
  const image = context.createImageData(512, 512);
  let seed = 113;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const value = 128 + (random() - .5) * 26;
    const index = (y * 512 + x) * 4;
    image.data[index] = image.data[index + 1] = image.data[index + 2] = value;
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(28, 28);
  return texture;
}

export function addStudio(scene, renderer) {
  const floorTexture = surfaceTexture();
  floorTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({
    color: 0x252b30, roughness: .48, metalness: .12,
    bumpMap: floorTexture, bumpScale: .025,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

}
