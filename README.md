# Sunshade F1

交互式 F1 赛车日光与阴影模拟。使用真实太阳位置计算驱动 Three.js 光照，在 Red Bull RB21 三维模型上观察日期、时间和地理位置如何改变日照与阴影。

**[打开在线界面](https://jerryli12sh.github.io/sunshade_f1/)**

- 调整日期、当地时间、经纬度和 UTC 偏移，实时查看太阳高度角与方位角。
- 上海、新加坡、伦敦一键预设；支持旋转、缩放、平移和重置视角。
- 赛车按包围盒自动缩放、居中并贴地，保留原始材质并添加环境反射。
- 细腻地面微纹理、PBR 车身材质与环境反射，配合随太阳高度变化的直射光和曙暮光。
- 地球与太阳方向示意联动：显示观测位置、昼夜分界、入射光与地球固定坐标下的日周视运动。
- 民用、航海、天文曙暮光分段与连续天光变化，显示日出、日落、太阳正午及各阶段时刻。
- 简约控制面板将位置、时区和专业口径折叠；兼容桌面与手机，提供加载状态、失败重试和 WebGL 错误提示。

## 本地运行

需要 Node.js 20.19+ 或 22.12+。

```sh
npm ci
npm run dev
```

## 验证与发布

```sh
npm test
npm run build
npm run deploy
```

`deploy` 会先运行测试和构建，再把 `dist` 发布到现有的 `gh-pages` 分支。执行者需要仓库写入权限。GitHub Pages 使用该分支的根目录，Vite 的部署前缀为 `/sunshade_f1/`。

测试覆盖 UTC 日期换算（含跨日和半小时时区）、昼夜太阳位置、模型缩放与贴地，赛车全部纹理和二进制资源的完整性、曙暮光边界、极地缺失事件及地球示意与场景高度角的一致性。

## 计算口径

太阳位置由 SunCalc 根据时刻和经纬度计算。当地时间通过显式 UTC 偏移换算，结果不依赖访问者浏览器的时区。预设偏移不会自动切换夏令时；伦敦夏令时请选择 UTC+1。方位角采用北为 0°、东为 90°的顺时针定义。日出/日落采用太阳中心几何高度 −0.833°；民用、航海、天文曙暮光边界分别为 −6°、−12°、−18°，参见 [USNO 标准定义](https://aa.usno.navy.mil/faq/RST_defs)。

太阳平行光方向和赛车地面阴影使用同一几何太阳向量；地球示意把该向量转换到地球固定坐标系，观测点法向量与光线夹角对应同一个太阳高度。示意中的日周轨迹以当前太阳赤纬绘制，距离未按比例。地球地图来自 NASA Blue Marble，纹理与经纬度标记对齐。

场景中的赛车长度归一化为 12 个场景单位。车漆、金属、玻璃沿用原始 PBR 材质，环境贴图提供摄影棚反射。太阳低于几何地平线后关闭直接光，天空与环境填充随高度连续衰减。颜色与亮度用于视觉模拟，不表示实测照度。日出时刻包含标准折射与太阳视半径，渲染的光线方向采用几何太阳中心。

## 模型来源

This work is based on [F1-2025 Redbull RB21](https://sketchfab.com/3d-models/f1-2025-redbull-rb21-1eca853cad0e4d2f8f23c3ca0c8e2b82) by [MattsActuallyUsefulModels](https://sketchfab.com/MattsActuallyUsefulModels), licensed under [CC-BY-NC-SA-4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). 模型用于非商业展示，原始授权信息保留在 `public/f1-2025_redbull_rb21/license.txt`。

地球纹理：NASA Visible Earth / [Blue Marble](https://visibleearth.nasa.gov/images/57723/the-blue-marble)，Reto Stöckli / NASA Goddard Space Flight Center。
