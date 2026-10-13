import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { disposeScene } from './lib/model';
import { earthSunDirection } from './lib/sun';

export default function SunDiagram({ sunPos, lat, lon }) {
  const mountRef = useRef(null);
  const state = useRef({});
  useEffect(() => {
    const mount = mountRef.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 40);
    camera.position.set(5.4, 3.3, 7);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false;
    controls.minDistance = 6; controls.maxDistance = 14;
    scene.add(new THREE.AmbientLight(0x617889, .65));
    const earthTexture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/earth.jpg`);
    earthTexture.colorSpace = THREE.SRGBColorSpace;
    // Align equirectangular longitudes with our +Z=90°E Earth-fixed frame.
    earthTexture.wrapS = THREE.RepeatWrapping; earthTexture.repeat.x = -1; earthTexture.offset.x = 1;
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1.15, 48, 32), new THREE.MeshStandardMaterial({ map: earthTexture, color: 0xa9bac5, roughness: .95 }));
    scene.add(globe);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x8199aa, transparent: true, opacity: .22 });
    for (let latitude = -60; latitude <= 60; latitude += 30) {
      const phi = latitude * Math.PI / 180;
      const points = Array.from({ length: 97 }, (_, i) => {
        const a = i / 96 * Math.PI * 2;
        return new THREE.Vector3(1.16 * Math.cos(phi) * Math.cos(a), 1.16 * Math.sin(phi), 1.16 * Math.cos(phi) * Math.sin(a));
      });
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial));
    }
    for (let longitude = 0; longitude < 180; longitude += 30) {
      const lambda = longitude * Math.PI / 180;
      const points = Array.from({ length: 97 }, (_, i) => {
        const phi = i / 96 * Math.PI * 2;
        return new THREE.Vector3(1.16 * Math.cos(phi) * Math.cos(lambda), 1.16 * Math.sin(phi), 1.16 * Math.cos(phi) * Math.sin(lambda));
      });
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial));
    }
    const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-1.5,0),new THREE.Vector3(0,1.5,0)]), new THREE.LineBasicMaterial({color:0x8094a4}));
    scene.add(axis);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(.065,16,12), new THREE.MeshBasicMaterial({color:0xf4bd69}));
    scene.add(marker);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(.24,24,16), new THREE.MeshBasicMaterial({color:0xffd795}));
    scene.add(sun);
    const light = new THREE.DirectionalLight(0xffefcf, 3);
    scene.add(light);
    const ray = new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(0,0,4),2.7,0xe7b76f,.23,.1);
    scene.add(ray);
    const horizon = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:64},(_,i)=>new THREE.Vector3(Math.cos(i/64*Math.PI*2)*.3,0,Math.sin(i/64*Math.PI*2)*.3))),new THREE.LineBasicMaterial({color:0xf4bd69,transparent:true,opacity:.8}));
    scene.add(horizon);
    const dailyPath = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(96*3),3)),new THREE.LineBasicMaterial({color:0x738392,transparent:true,opacity:.18}));
    scene.add(dailyPath);
    state.current = { sun, light, marker, ray, horizon, dailyPath };
    mount.appendChild(renderer.domElement);
    const resize = () => {
      const {width,height} = mount.getBoundingClientRect();
      camera.aspect = width / Math.max(height,1); camera.updateProjectionMatrix(); renderer.setSize(width,height);
    };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
    return () => {observer.disconnect(); renderer.setAnimationLoop(null);controls.dispose();disposeScene(scene);renderer.dispose();renderer.domElement.remove();state.current={};};
  }, []);

  useEffect(() => {
    const {sun,light,marker,ray,horizon,dailyPath} = state.current;
    if (!sun) return;
    const {up,direction} = earthSunDirection(sunPos,lat,lon);
    const vector = new THREE.Vector3(...direction);
    sun.position.copy(vector).multiplyScalar(3.2);
    light.position.copy(sun.position);
    marker.position.set(...up).multiplyScalar(1.18);
    ray.position.copy(vector).multiplyScalar(2.85);
    ray.setDirection(vector.clone().negate());
    ray.setLength(1.64,.2,.08);
    const pathPoints = dailyPath.geometry.attributes.position;
    const horizontal = Math.sqrt(Math.max(0,1-vector.y*vector.y));
    for (let i=0;i<96;i++) {const angle=i/96*Math.PI*2;pathPoints.setXYZ(i,3.2*horizontal*Math.cos(angle),3.2*vector.y,3.2*horizontal*Math.sin(angle));}
    pathPoints.needsUpdate=true;dailyPath.geometry.computeBoundingSphere();
    horizon.position.copy(marker.position);
    horizon.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...up));
  }, [sunPos,lat,lon]);

  return <aside className="sun-diagram"><div className="diagram-heading"><span>EARTH / SUN</span><span>入射光方向</span></div><div className="diagram-canvas" ref={mountRef} role="img" aria-label="地球固定坐标系中的太阳方向，金色点为观测位置，箭头为入射光" /><div className="diagram-legend"><span><i />观测位置</span><span>拖动旋转</span></div><p>地球固定坐标 · 日周视运动 · 距离示意</p></aside>;
}
