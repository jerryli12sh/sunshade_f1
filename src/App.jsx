import { useRef, useEffect, useState, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import SunCalc from "suncalc";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// --- 配置常量 ---
const INIT_LAT = 31.2304; // 上海纬度
const INIT_LON = 121.4737; // 上海经度
const RADIUS = 50; // 太阳轨道半径 (稍微加大)

/**
 * 计算太阳坐标
 * SunCalc: 0=南, PI/2=西
 * Three: Z=南, X=东
 */
function getSunPosition(date, lat, lon) {
  const pos = SunCalc.getPosition(date, lat, lon);
  const { altitude, azimuth } = pos;

  const r_flat = Math.cos(altitude) * RADIUS;
  const y = Math.sin(altitude) * RADIUS;

  const x = -r_flat * Math.sin(azimuth);
  const z = r_flat * Math.cos(azimuth);

  return { x, y, z, altitude, azimuth };
}

function formatTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function App() {
  // --- 状态 ---
  const [minuteOfDay, setMinuteOfDay] = useState(14 * 60); // 下午2点，光影效果较好
  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [lat, setLat] = useState(INIT_LAT);
  const [lon, setLon] = useState(INIT_LON);

  // 计算日期对象
  const currentDate = useMemo(() => {
    const d = new Date(dateStr);
    const h = Math.floor(minuteOfDay / 60);
    const m = minuteOfDay % 60;
    d.setHours(h, m, 0, 0);
    return d;
  }, [dateStr, minuteOfDay]);

  // 计算太阳位置
  const sunPos = useMemo(() => getSunPosition(currentDate, lat, lon), [currentDate, lat, lon]);

  // --- Refs ---
  const mountRef = useRef(null);
  const sceneRef = useRef({
    sunMesh: null,
    dirLight: null,
    hemiLight: null,
  });

  // --- 初始化 Three.js ---
  useEffect(() => {
    if (!mountRef.current) return;
    
    // 1. 场景设置
    const scene = new THREE.Scene();
    // 使用深灰色背景，更能衬托赛车的高光
    scene.background = new THREE.Color(0x222222); 
    scene.fog = new THREE.Fog(0x222222, 50, 200);

    // 2. 相机 (针对F1赛车调整视角)
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(30, 15, 30); // 45度角俯视
    camera.lookAt(0, 0, 0);

    // 3. 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 开启物理光照修正，让光感更真实
    renderer.useLegacyLights = false; 
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    mountRef.current.innerHTML = "";
    mountRef.current.appendChild(renderer.domElement);

    // 4. 控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // 防止看到地底

    // --- 场景内容 ---

    // A. 沥青地面 (接收阴影)
    const planeGeo = new THREE.PlaneGeometry(200, 200);
    const planeMat = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a, // 深色沥青
        roughness: 0.8,
        metalness: 0.1
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);

    // B. 加载 F1 赛车
    const loader = new GLTFLoader();
    const f1Url = "/sunshade_f1/f1-2025_redbull_rb21/scene.gltf"; // 保持你的路径

    loader.load(f1Url, (gltf) => {
        const model = gltf.scene;
        
        // 1. 强制居中与归一化
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.x -= center.x;
        model.position.z -= center.z;
        model.position.y = 0; // 贴地

        // 2. 缩放 (如果模型太小)
        // 注意：根据你之前的代码，你需要放大100倍。
        // 如果加载出来太大或太小，请调整这里的 scale
        model.scale.set(100, 100, 100); 

        // 3. 材质修复 (关键步骤：防止赛车全黑)
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                // 如果材质是金属的，但在简单场景中没有环境反射，它会变黑。
                // 这里强制调整一下，让它能对光有反应。
                if (child.material) {
                    child.material.envMapIntensity = 1.0;
                    // 稍微降低金属度，增加粗糙度，让漫反射光能照亮它
                    // 注意：这会改变一点原始质感，但能保证看清楚
                    if (child.material.metalness > 0.8) {
                        child.material.metalness = 0.6;
                        child.material.roughness = Math.max(child.material.roughness, 0.3);
                    }
                }
            }
        });

        scene.add(model);
    }, 
    (xhr) => console.log(`加载进度: ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`),
    (err) => {
        console.error("F1模型加载失败，加载替代方块", err);
        // Fallback: 如果模型没加载出来，放个红色方块代表车
        const box = new THREE.Mesh(new THREE.BoxGeometry(5, 1.5, 10), new THREE.MeshStandardMaterial({color: 'red'}));
        box.position.y = 0.75;
        box.castShadow = true;
        box.receiveShadow = true;
        scene.add(box);
    });

    // C. 辅助坐标和网格
    const grid = new THREE.GridHelper(100, 100, 0x555555, 0x222222);
    grid.position.y = 0.01; // 防止z-fighting
    scene.add(grid);

    // --- 光照系统 (核心修改) ---

    // 1. 半球光 (Hemisphere Light) - 模拟天光
    // 即使太阳没照到的阴影面，也会被天空照亮（蓝色）和地面反光（灰色）
    // 这是解决“车身死黑”的关键。
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);
    sceneRef.current.hemiLight = hemiLight;

    // 2. 太阳光 (Directional Light) - 主光源
    const dirLight = new THREE.DirectionalLight(0xfffaf0, 30.0); // 强度设高一点
    dirLight.castShadow = true;
    
    // 阴影设置：必须覆盖赛车的大小
    const shadowSize = 30; // 根据赛车缩放后的大小调整
    dirLight.shadow.camera.left = -shadowSize;
    dirLight.shadow.camera.right = shadowSize;
    dirLight.shadow.camera.top = shadowSize;
    dirLight.shadow.camera.bottom = -shadowSize;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0005; // 减少阴影波纹
    
    scene.add(dirLight);
    sceneRef.current.dirLight = dirLight;

    // 3. 太阳可视化球体
    const sunGeo = new THREE.SphereGeometry(2, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunMesh);
    sceneRef.current.sunMesh = sunMesh;

    // 4. 方位文字
    const addLabel = (text, x, z) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128; canvas.height = 64;
        ctx.fillStyle = "white";
        ctx.font = "bold 40px Arial";
        ctx.fillText(text, 20, 45);
        const map = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map }));
        sprite.position.set(x, 5, z);
        sprite.scale.set(5, 2.5, 1);
        scene.add(sprite);
    };
    addLabel("N", 0, -45);
    addLabel("S", 0, 45);
    addLabel("E", 45, 0);
    addLabel("W", -45, 0);

    // --- 动画 ---
    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      renderer.dispose();
      if(mountRef.current) mountRef.current.innerHTML = "";
    };
  }, []);

  // --- 实时更新：太阳位置与光照 ---
  useEffect(() => {
    const { dirLight, sunMesh, hemiLight } = sceneRef.current;
    if (!dirLight || !sunMesh) return;

    // 1. 移动太阳可视化球
    sunMesh.position.set(sunPos.x, sunPos.y, sunPos.z);

    // 2. 移动主光源
    // 关键：光源位置跟随太阳，但目标(Target)默认是(0,0,0)，正好是我们放车的地方
    dirLight.position.set(sunPos.x, sunPos.y, sunPos.z);

    // 3. 昼夜光照强度模拟
    if (sunPos.altitude <= 0) {
      // 夜晚
      dirLight.intensity = 0;
      hemiLight.intensity = 0.05; // 极弱月光
      hemiLight.color.setHex(0x111133); // 偏蓝夜色
      hemiLight.groundColor.setHex(0x000000);
      sunMesh.visible = false;
    } else {
      // 白天
      const angleFactor = Math.sin(sunPos.altitude); // 0~1
      
      // 太阳直射光：正午最强 (3.0), 早晚弱
      dirLight.intensity = Math.max(0.5, angleFactor * 3.0);
      
      // 环境光：根据太阳高度变亮
      hemiLight.intensity = 0.4 + angleFactor * 0.4; 
      hemiLight.color.setHex(0xffffff); // 白昼天光
      hemiLight.groundColor.setHex(0x444444); // 地面反光
      
      sunMesh.visible = true;
    }
  }, [sunPos]);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#000" }}>
      {/* 控制面板 */}
      <div style={{
        position: "absolute", top: 20, left: 20, zIndex: 10,
        background: "rgba(30, 30, 30, 0.9)", padding: "20px",
        borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        width: "300px", fontFamily: "sans-serif", color: "white",
        border: "1px solid #444"
      }}>
        <h3 style={{margin:"0 0 15px 0", borderBottom:"1px solid #555", paddingBottom:10}}>Sun Path</h3>
        
        <div style={{marginBottom: 15}}>
          <label style={{fontSize:12, color:"#aaa"}}>日期</label>
          <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} 
            style={{width:"100%", background:"#333", color:"white", border:"1px solid #555", padding:5, borderRadius:4}}/>
        </div>

        <div style={{marginBottom: 15}}>
          <label style={{fontSize:12, color:"#aaa"}}>时间: <span style={{color:"#fff", fontSize:14}}>{formatTime(minuteOfDay)}</span></label>
          <input type="range" min="0" max="1439" value={minuteOfDay} 
            onChange={e => setMinuteOfDay(Number(e.target.value))} style={{width: "100%", accentColor: "#ffaa00"}}/>
        </div>

        <div style={{marginBottom: 15}}>
          <label style={{fontSize:12, color:"#aaa"}}>纬度 (Lat): {lat}</label>
          <input type="range" min="-90" max="90" step="0.1" value={lat} 
            onChange={e => setLat(Number(e.target.value))} style={{width: "100%", accentColor: "#00aaff"}}/>
        </div>

        <div style={{fontSize: "12px", color: "#888", marginTop: 10, borderTop:"1px solid #444", paddingTop:10}}>
          <p>高度角: <span style={{color:"#ffaa00"}}>{(sunPos.altitude * 180/Math.PI).toFixed(1)}°</span></p>
          <p>方位角: <span style={{color:"#00aaff"}}>{(sunPos.azimuth * 180/Math.PI).toFixed(1)}°</span></p>
        </div>
      </div>

      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

export default App;
