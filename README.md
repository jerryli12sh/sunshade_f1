# Sunshade F1

交互式 F1 赛车日光与阴影模拟。使用真实太阳位置计算驱动 Three.js 光照，在 Red Bull RB21 三维模型上观察日期、时间和地理位置如何改变日照与阴影。

**[打开在线界面](https://jerryli12sh.github.io/sunshade_f1/)**

- 调整日期、当地时间、经纬度和 UTC 偏移，实时查看太阳高度角与方位角。
- 上海、新加坡、伦敦一键预设；支持旋转、缩放、平移和重置视角。
- 赛车按包围盒自动缩放、居中并贴地，保留原始材质并添加环境反射。
- 桌面浮动面板、手机底部面板；提供模型加载状态、失败重试和 WebGL 错误提示。

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

测试覆盖 UTC 日期换算（含跨日和半小时时区）、昼夜太阳位置、模型缩放与贴地，以及赛车全部纹理和二进制资源的完整性。

## 计算口径

太阳位置由 SunCalc 根据时刻和经纬度计算。当地时间通过显式 UTC 偏移换算，结果不依赖访问者浏览器的时区。预设偏移不会自动切换夏令时；伦敦夏令时请选择 UTC+1。方位角采用北为 0°、东为 90°的顺时针定义。场景中的赛车长度归一化为 12 个场景单位，阴影用于交互展示。

## 模型来源

This work is based on [F1-2025 Redbull RB21](https://sketchfab.com/3d-models/f1-2025-redbull-rb21-1eca853cad0e4d2f8f23c3ca0c8e2b82) by [MattsActuallyUsefulModels](https://sketchfab.com/MattsActuallyUsefulModels), licensed under [CC-BY-NC-SA-4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). 模型用于非商业展示，原始授权信息保留在 `public/f1-2025_redbull_rb21/license.txt`。
