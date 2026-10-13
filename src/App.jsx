import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { dateAtOffset, getSunPosition, formatTime } from './lib/sun';
import { placeModel, disposeScene } from './lib/model';
import './App.css';

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

function App() {
  const [minuteOfDay, setMinuteOfDay] = useState(14 * 60);
  const [dateStr, setDateStr] = useState(localToday);
  const [lat, setLat] = useState(31.2304);
  const [lon, setLon] = useState(121.4737);
  const [utcOffset, setUtcOffset] = useState(8);
  const [modelStatus, setModelStatus] = useState('loading');
  const [sceneError, setSceneError] = useState('');
  const [retry, setRetry] = useState(0);
  const mountRef = useRef(null);
  const sceneRef = useRef({});
  const currentDate = useMemo(() => dateAtOffset(dateStr, minuteOfDay, utcOffset), [dateStr, minuteOfDay, utcOffset]);
  const sunPos = useMemo(() => getSunPosition(currentDate, lat, lon), [currentDate, lat, lon]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let active = true;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x161d26);
    scene.fog = new THREE.Fog(0x161d26, 60, 180);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 250);
    camera.position.set(20, 13, 22);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setSceneError('3D 场景启动失败，请启用浏览器硬件加速后重试。');
      return;
    }
    setSceneError('');
    setModelStatus('loading');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.minDistance = 8;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.65;
    disposeScene(room);
    pmrem.dispose();

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x252b32, roughness: 0.85, metalness: 0.1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(100, 50, 0x52606b, 0x303b46);
    grid.position.y = 0.015;
    scene.add(grid);

    new GLTFLoader().load(`${import.meta.env.BASE_URL}f1-2025_redbull_rb21/scene.gltf`, gltf => {
      if (!active) { disposeScene(gltf.scene); return; }
      try {
        placeModel(gltf.scene);
        gltf.scene.traverse(child => {
          if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
        });
        scene.add(gltf.scene);
        setModelStatus('ready');
      } catch {
        disposeScene(gltf.scene);
        setModelStatus('error');
      }
    }, undefined, () => { if (active) setModelStatus('error'); });

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xfffaf0, 3);
    dirLight.castShadow = true;
    Object.assign(dirLight.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 0.5, far: 150 });
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.normalBias = 0.02;
    scene.add(dirLight);
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffc35c }));
    scene.add(sunMesh);
    sceneRef.current = { dirLight, hemiLight, sunMesh, scene, controls, camera };

    for (const [text, x, z] of [['N', 0, -22], ['S', 0, 22], ['E', 22, 0], ['W', -22, 0]]) {
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#bdcad7'; ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center'; ctx.fillText(text, 64, 45);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
      sprite.position.set(x, 1, z); sprite.scale.set(3, 1.5, 1);
      scene.add(sprite);
    }
    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    const lostContext = event => {
      event.preventDefault();
      setSceneError('3D 渲染已暂停，请点击重新加载恢复场景。');
    };
    renderer.domElement.addEventListener('webglcontextlost', lostContext);
    return () => {
      active = false;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('webglcontextlost', lostContext);
      controls.dispose();
      disposeScene(scene);
      environment.dispose();
      dirLight.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = {};
    };
  }, [retry]);

  useEffect(() => {
    const { dirLight, sunMesh, hemiLight, scene } = sceneRef.current;
    if (!dirLight) return;
    sunMesh.position.set(sunPos.x, sunPos.y, sunPos.z);
    dirLight.position.copy(sunMesh.position);
    const daylight = sunPos.altitude > 0;
    const angleFactor = Math.max(0, Math.sin(sunPos.altitude));
    dirLight.intensity = daylight ? Math.max(0.5, angleFactor * 3) : 0;
    hemiLight.intensity = daylight ? 0.4 + angleFactor * 0.4 : 0.12;
    hemiLight.color.setHex(daylight ? 0xffffff : 0x7788bb);
    hemiLight.groundColor.setHex(daylight ? 0x444444 : 0x111522);
    scene.environmentIntensity = daylight ? 0.65 : 0.08;
    sunMesh.visible = daylight;
  }, [sunPos, retry]);

  function preset(latitude, longitude, offset) {
    setLat(latitude); setLon(longitude); setUtcOffset(offset);
  }
  function resetView() {
    const { controls, camera } = sceneRef.current;
    if (controls) { camera.position.set(20, 13, 22); controls.target.set(0, 1, 0); controls.update(); }
  }

  return (
    <main className="app">
      <div ref={mountRef} className="scene" aria-label="F1 赛车太阳轨迹与阴影三维场景" />
      <section className="panel" aria-label="太阳位置控制">
        <header><span className="eyebrow">SUNSHADE / F1</span><h1>追踪日光，观察阴影</h1><p>Red Bull RB21 · 太阳位置模拟</p></header>
        <div className="presets"><button onClick={() => preset(31.2304, 121.4737, 8)}>上海</button><button onClick={() => preset(1.3521, 103.8198, 8)}>新加坡</button><button onClick={() => preset(51.5074, -0.1278, 0)}>伦敦</button></div>
        <label htmlFor="date">日期<input id="date" type="date" value={dateStr} min="1900-01-01" max="2100-12-31" onChange={e => { if (e.target.value && e.target.validity.valid) setDateStr(e.target.value); }} /></label>
        <label htmlFor="time">当地时间 <strong>{formatTime(minuteOfDay)}</strong><input id="time" type="range" min="0" max="1439" value={minuteOfDay} onChange={e => setMinuteOfDay(Number(e.target.value))} /></label>
        <div className="time-ticks"><span>00:00</span><span>12:00</span><span>23:59</span></div>
        <label htmlFor="offset">UTC 偏移<select id="offset" value={utcOffset} onChange={e => setUtcOffset(Number(e.target.value))}>{Array.from({ length: 105 }, (_, i) => -12 + i / 4).map(offset => <option key={offset} value={offset}>UTC{offset >= 0 ? '+' : ''}{offset}</option>)}</select></label>
        <div className="coordinates"><label htmlFor="latitude">纬度<input id="latitude" type="number" min="-90" max="90" step="0.0001" value={lat} onChange={e => { if (e.target.value !== '' && e.target.validity.valid) setLat(Number(e.target.value)); }} /></label><label htmlFor="longitude">经度<input id="longitude" type="number" min="-180" max="180" step="0.0001" value={lon} onChange={e => { if (e.target.value !== '' && e.target.validity.valid) setLon(Number(e.target.value)); }} /></label></div>
        <div className="metrics"><div><span>太阳高度角</span><strong>{(sunPos.altitude * 180 / Math.PI).toFixed(1)}°</strong></div><div><span>方位角 · 北为 0°</span><strong>{sunPos.bearing.toFixed(1)}°</strong></div></div>
        <p className="day-state"><i className={sunPos.altitude > 0 ? 'day' : ''} />{sunPos.altitude > 0 ? '日间 · 太阳位于地平线上方' : '夜间 · 太阳位于地平线下方'}</p>
        <p className="note">时间按所选 UTC 偏移计算。伦敦预设为 UTC+0，夏令时请改为 UTC+1。</p>
      </section>
      <div className="scene-toolbar"><button onClick={resetView}>重置视角</button><span>拖动旋转 · 滚轮缩放 · 右键平移</span></div>
      {(modelStatus !== 'ready' || sceneError) && <div className="status" role="status">{sceneError || (modelStatus === 'loading' ? '正在加载 RB21 赛车…' : '赛车模型加载失败，请检查网络后重试。')}{(modelStatus === 'error' || sceneError) && <button onClick={() => setRetry(value => value + 1)}>重新加载</button>}</div>}
      <a className="credits" href="https://github.com/jerryli12sh/sunshade_f1" target="_blank" rel="noreferrer">项目与模型来源 ↗</a>
    </main>
  );
}

export default App;
