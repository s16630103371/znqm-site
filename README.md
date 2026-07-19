# ZNQM · AI 生成工作室

上传图片或视频，AI 帮你生成**海报与视频**。基于混元生图（`hy-image-v3.0`）与前端实时合成（Canvas + MediaRecorder）。

## 功能
- **图生图**：参考图 + 提示词 → 生成新画面（混元 `hy-image-v3.0`）
- **图生视频**：多张图片 / 一段视频 → 可下载的动态视频（前端合成，离线可用）
- **图生海报**：主视觉 + AI 文案 → 可下载海报 PNG（前端 Canvas + `qwen3.5-plus` 写文案）
- 作品长廊：真实 AI 作品，点击「生成相似」一键带入创作台

## 目录
```
znqm-site/
├── index.html              # 站点入口
├── assets/
│   ├── css/style.css       # 视觉样式（青+品红主轴）
│   ├── js/
│   │   ├── api.js          # 封装 /api 接口
│   │   ├── app.js          # 交互主控（Tab/上传/状态机/画廊/toast）
│   │   ├── poster.js       # 前端海报合成
│   │   └── video.js        # 前端视频合成
│   └── img/gallery/        # 预生成的作品（真实 AI 图）
├── worker/                 # Cloudflare Worker（生产后端）
│   ├── index.js
│   └── wrangler.toml
└── server/dev.mjs          # 本地开发代理（用于测试，密钥走环境变量）
```

## 本地预览 / 测试
```bash
# 需要 Node 18+
API_KEY=sk-xxxx node server/dev.mjs
# 打开 http://localhost:8788
```
`API_KEY` 即 `tokenhub.tencentmaas.com` 的 Bearer Key。

## 部署到 znqm.cloud
站点为纯静态，后端是 Cloudflare Worker。两种常见组合：

### A. 静态托管（GitHub Pages / Cloudflare Pages）+ Cloudflare Worker
1. 把 `index.html` 与 `assets/` 部署到静态主机（已绑定 znqm.cloud）。
2. 部署 Worker：
   ```bash
   cd worker
   npm i -g wrangler
   wrangler login
   wrangler secret put API_KEY      # 填入 tokenhub 的 Key
   wrangler deploy
   ```
3. 在 Cloudflare 把 `znqm.cloud/api/*` 路由指向该 Worker（见 `wrangler.toml` 的 routes）。

### B. 全站 Cloudflare Pages（Functions 合并）
将 `worker/index.js` 作为 `functions/api/[[path]].js`，构建输出为站点的 `index.html` + `assets/`；在 Pages 项目设置里添加环境变量 `API_KEY`（密文）。

> 密钥只存在于后端环境变量，**不会**下发到浏览器。前端一律通过同源 `/api/*` 调用。

## 接口契约（同源 /api）
| 方法 | 路径 | 入参 | 返回 |
|------|------|------|------|
| POST | `/api/img2img` | `{prompt, image?, size?, n?}` | `{images:[dataUrl], revised_prompt}` |
| POST | `/api/describe` | `{image(dataUrl)}` | `{description}` |
| POST | `/api/copy` | `{brief}` | `{title, subtitle, tags:[]}` |
| GET  | `/api/health` | — | `{ok:true, model}` |

图片以 base64 data URL 返回，规避 COS 签名 URL 过期与跨域问题。

## 备注
- 视频生成目前为前端实时合成（网关视频接口未开放）；如需真·AI 视频，待网关开放后可在 Worker 增加 `/api/video` 并在 `video.js` 接入。
- 生成配额取决于 tokenhub 账户；画廊 6 张图已由 `hy-image-v3.0` 预生成并落盘。
