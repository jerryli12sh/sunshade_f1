import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { dateAtOffset, getSunPosition, formatTime, solarPhase, solarEvents } from './lib/sun';
import { addStudio } from './lib/studio';
import SunDiagram from './SunDiagram';
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
  const phase = solarPhase(sunPos.altitude * 180 / Math.PI);
  const events = useMemo(() => solarEvents(dateStr, lat, lon, utcOffset), [dateStr, lat, lon, utcOffset]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let active = true;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x191d20);
    scene.fog = new THREE.Fog(0x191d20, 55, 140);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 250);
    camera.position.set(17, 8, 19);
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
    renderer.toneMappingExposure = 1.15;
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

    addStudio(scene, renderer);

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
      ctx.fillStyle = '#8a939b'; ctx.font = '32px sans-serif';
      ctx.textAlign = 'center'; ctx.fillText(text, 64, 45);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
      sprite.position.set(x, .12, z); sprite.scale.set(2, 1, 1);
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
    const degrees = sunPos.altitude * 180 / Math.PI;
    const daylight = degrees > 0;
    const angleFactor = Math.max(0, Math.sin(sunPos.altitude));
    // No direct solar beam below the geometric horizon. Sky light decays continuously through twilight.
    const stops = [
      [-18, 0x060910, .018, .025],
      [-12, 0x101728, .055, .07],
      [-6, 0x293343, .16, .17],
      [0, 0x3c3532, .3, .32],
      [15, 0x20272d, .48, .52],
      [90, 0x20272d, .6, .65],
    ];
    const index = stops.findIndex(stop => degrees <= stop[0]);
    const high = stops[index < 0 ? stops.length - 1 : index];
    const low = stops[Math.max(0, index < 0 ? stops.length - 2 : index - 1)];
    const blend = high === low ? 0 : THREE.MathUtils.clamp((degrees - low[0]) / (high[0] - low[0]), 0, 1);
    scene.background.setHex(low[1]).lerp(new THREE.Color(high[1]), blend);
    scene.fog.color.copy(scene.background);
    hemiLight.intensity = THREE.MathUtils.lerp(low[2], high[2], blend);
    scene.environmentIntensity = THREE.MathUtils.lerp(low[3], high[3], blend);
    const warmth = THREE.MathUtils.smoothstep(degrees, 0, 18);
    dirLight.color.setHex(0xffb774).lerp(new THREE.Color(0xfff4df), warmth);
    dirLight.intensity = daylight ? 4 * Math.pow(angleFactor, .45) : 0;
    hemiLight.color.setHex(0x849acb).lerp(new THREE.Color(0xd8e4ee), THREE.MathUtils.smoothstep(degrees, -18, 3));
    hemiLight.groundColor.setHex(0x33312e);
    sunMesh.visible = daylight;

  }, [sunPos, retry]);

  function preset(latitude, longitude, offset) {
    setLat(latitude); setLon(longitude); setUtcOffset(offset);
  }
  function resetView() {
    const { controls, camera } = sceneRef.current;
    if (controls) { camera.position.set(17, 8, 19); controls.target.set(0, 1, 0); controls.update(); }
  }

  return (
    <main className="app">
      <div ref={mountRef} className="scene" aria-label="F1 赛车太阳轨迹与阴影三维场景" />
      <section className="panel" aria-label="太阳位置控制">
        <header><span className="eyebrow"><i /> LIGHT STUDY / 01</span><h1>Sunshade F1<span>日光与阴影</span></h1><p>RED BULL RB21</p></header>
        <div className="presets">{[['上海',31.2304,121.4737,8],['新加坡',1.3521,103.8198,8],['伦敦',51.5074,-.1278,0]].map(([name,latitude,longitude,offset]) => <button key={name} aria-pressed={lat === latitude && lon === longitude} onClick={() => preset(latitude,longitude,offset)}>{name}</button>)}</div>
        <label className="date-label" htmlFor="date">日期<input id="date" type="date" value={dateStr} min="1900-01-01" max="2100-12-31" onChange={e => { if (e.target.value && e.target.validity.valid) setDateStr(e.target.value); }} /></label>
        <label className="time-label" htmlFor="time">当地时间 <strong>{formatTime(minuteOfDay)}</strong><input id="time" type="range" min="0" max="1439" value={minuteOfDay} onChange={e => setMinuteOfDay(Number(e.target.value))} /></label>
        <div className="time-ticks"><span>00:00</span><span>12:00</span><span>23:59</span></div>
        <div className="metrics"><div><span>高度角</span><strong>{(sunPos.altitude * 180 / Math.PI).toFixed(1)}<small>°</small></strong></div><div><span>方位角</span><strong>{sunPos.bearing.toFixed(1)}<small>°</small></strong></div></div>
        <div className={`phase phase-${phase.key}`}><i /><span>{phase.label}</span><small>{phase.description}</small></div>
        <details className="settings"><summary>位置与时区 <span>UTC{utcOffset >= 0 ? '+' : ''}{utcOffset}</span></summary>
          <div className="coordinates"><label htmlFor="latitude">纬度<input id="latitude" type="number" min="-90" max="90" step="0.0001" value={lat} onChange={e => { if (e.target.value !== '' && e.target.validity.valid) setLat(Number(e.target.value)); }} /></label><label htmlFor="longitude">经度<input id="longitude" type="number" min="-180" max="180" step="0.0001" value={lon} onChange={e => { if (e.target.value !== '' && e.target.validity.valid) setLon(Number(e.target.value)); }} /></label></div>
          <label htmlFor="offset">UTC 偏移<select id="offset" value={utcOffset} onChange={e => setUtcOffset(Number(e.target.value))}>{Array.from({ length: 105 }, (_, i) => -12 + i / 4).map(offset => <option key={offset} value={offset}>UTC{offset >= 0 ? '+' : ''}{offset}</option>)}</select></label>
          <p className="note">当地时间按所选 UTC 偏移换算。伦敦夏令时请改为 UTC+1。</p>
        </details>
        <details className="settings"><summary>日照与曙暮光时刻</summary><div className="events">{events.map(([name,time,threshold]) => <div key={name}><span>{name}<small>{threshold}</small></span><strong>{time}</strong></div>)}</div><p className="note">均为所选时区的时间。— 表示当日未发生该高度角交叉；极昼、极夜或连续曙暮光下会出现此情况。</p></details>
        <details className="settings method"><summary>光照与天文口径</summary><p className="note">高度角为太阳中心的几何高度；方位角从北顺时针计，东为 90°。日出/日落阈值为 −0.833°，包含标准大气折射与太阳视半径。民用、航海、天文曙暮光边界分别为 −6°、−12°、−18°。<a href="https://aa.usno.navy.mil/faq/RST_defs" target="_blank" rel="noreferrer"> USNO 定义 ↗</a></p><p className="note">场景采用太阳平行光、连续曙暮光填充与摄影棚环境反射。直接光及地面阴影遵循几何太阳方向；颜色和亮度为视觉模拟，不表示实测照度。</p></details>
      </section>
      <SunDiagram sunPos={sunPos} lat={lat} lon={lon} />
      <div className="scene-caption"><span>RB21</span><p>太阳直射 / 环境反射</p></div>
      <div className="scene-toolbar"><button onClick={resetView}>↺ <span>重置视角</span></button><span>拖动旋转 · 滚轮缩放 · 右键平移</span></div>
      {(modelStatus !== 'ready' || sceneError) && <div className="status" role="status">{sceneError || (modelStatus === 'loading' ? '正在加载 RB21 赛车…' : '赛车模型加载失败，请检查网络后重试。')}{(modelStatus === 'error' || sceneError) && <button onClick={() => setRetry(value => value + 1)}>重新加载</button>}</div>}
      <a className="credits" href="https://github.com/jerryli12sh/sunshade_f1" target="_blank" rel="noreferrer">项目与模型来源 ↗</a>
    </main>
  );
}

export default App;
