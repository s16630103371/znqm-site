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
├── index.html                 # 站点入口
├── assets/
│   ├── css/style.css          # 视觉样式（青+品红主轴）
│   ├── js/
│   │   ├── api.js             # 封装 /api 接口
│   │   ├── app.js             # 交互主控（Tab/上传/状态机/画廊/toast）
│   │   ├── poster.js          # 前端海报合成
│   │   └── video.js           # 前端视频合成
│   └── img/gallery/           # 预生成的作品（真实 AI 图）
├── functions/api/
│   └── [[route]].js           # Cloudflare Pages Functions（生产后端 /api/*）
├── worker/                    # 备选：独立 Cloudflare Worker（替换旧坏后端用）
│   ├── index.js
│   └── wrangler.toml
├── .github/workflows/
│   └── deploy.yml             # 推送到 main 自动部署到 Cloudflare Pages
├── wrangler.toml              # 根：Pages 项目配置
├── .dev.vars.example          # 本地密钥模板（复制为 .dev.vars）
└── server/dev.mjs             # 本地开发代理（用于测试，密钥走环境变量）
```

## 本地预览 / 测试
```bash
# 方式一：纯前端 + 本地 Node 代理（最简单）
API_KEY=sk-xxxx node server/dev.mjs
# 打开 http://localhost:8788

# 方式二：用 wrangler 跑完整 Pages（含 Functions）
cp .dev.vars.example .dev.vars   # 填入真实 Key
npx wrangler pages dev .
```

## 部署到 znqm.cloud

### ★ 推荐：Cloudflare Pages（静态 + Functions 单仓单部署）
`index.html` + `assets/` 是静态站，`functions/api/[[route]].js` 自动接管 `/api/*`，**同域、无需额外路由**。

**方式 A — GitHub Actions 自动部署（零 CLI）**
1. 在 Cloudflare 控制台拿到 `CLOUDFLARE_API_TOKEN`（Pages 编辑权限）和 `CLOUDFLARE_ACCOUNT_ID`。
2. 在 GitHub 仓库 `Settings → Secrets` 添加这两个密钥。
3. `git push` 到 `main`，Action 自动 `wrangler pages deploy .`。
4. Cloudflare Pages 控制台 → znqm-site → **Settings → Variables** 添加名为 `API_KEY` 的 Secret（值 = tokenhub Bearer Key）。
5. 控制台 → **Custom domains** 添加 `znqm.cloud`（一次性）。

**方式 B — 本地一条命令**
```bash
cp .dev.vars.example .dev.vars   # 填入真实 Key
npx wrangler pages deploy . --project-name znqm-site
# 若首次建项目：npx wrangler pages project create znqm-site --production-branch=main
```

### 备选：独立 Cloudflare Worker（替换你现有的坏后端）
你当前 znqm.cloud 的后端是个返回 500 的 Worker。可直接用 `worker/` 替换它：
```bash
cd worker
npx wrangler login
npx wrangler secret put API_KEY      # 填入 tokenhub 的 Key
npx wrangler deploy                  # 部署为 znqm-api
```
然后在 Cloudflare 把 `znqm.cloud/api/*` 路由指向该 Worker（见 `worker/wrangler.toml` 的 routes 注释）。

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
