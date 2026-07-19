#!/usr/bin/env bash
# 一键部署 ZNQM 到 Cloudflare Pages（静态 + Functions 同仓单部署）
#
# 需要：
#   CLOUDFLARE_API_TOKEN  Cloudflare API Token（Pages 编辑权限；兼容旧名 CF_API_TOKEN）
#   CLOUDFLARE_ACCOUNT_ID Cloudflare 账户 ID
#   API_KEY               tokenhub.tencentmaas.com 的 Bearer Key（也可放仓库根 .dev.vars 的 API_KEY=...）
#
# 用法：
#   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=yyy API_KEY=zzz bash scripts/deploy-cf.sh
#
# 部署后：到 Cloudflare Pages 控制台 -> znqm-site -> Custom domains 添加 znqm.cloud（一次性）。
set -euo pipefail

# 兼容新旧变量名（CF_API_TOKEN 已弃用，优先 CLOUDFLARE_API_TOKEN）
: "${CLOUDFLARE_API_TOKEN:=${CF_API_TOKEN:-}}"
: "${CLOUDFLARE_API_TOKEN:?请提供 Cloudflare API Token（环境变量 CLOUDFLARE_API_TOKEN 或 CF_API_TOKEN）}"
: "${CLOUDFLARE_ACCOUNT_ID:?请提供 CLOUDFLARE_ACCOUNT_ID（Cloudflare 账户 ID）}"
export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID

cd "$(dirname "$0")/.."

# 读取 API_KEY：优先环境变量，其次 .dev.vars
if [ -z "${API_KEY:-}" ] && [ -f .dev.vars ]; then
  API_KEY="$(grep '^API_KEY=' .dev.vars | head -1 | cut -d= -f2-)"
fi
: "${API_KEY:?请提供 API_KEY（tokenhub Bearer Key），可放 .dev.vars 或作为环境变量}"

echo ">> 创建 Pages 项目（若已存在则忽略）"
npx wrangler pages project create znqm-site --production-branch=main 2>/dev/null || true

echo ">> 设置后端密钥 API_KEY（Pages Secret）"
printf '%s' "$API_KEY" | npx wrangler pages secret put API_KEY --project-name znqm-site

echo ">> 部署静态站 + Functions 到 Cloudflare Pages"
npx wrangler pages deploy . --project-name znqm-site

echo ""
echo "✅ 部署完成。"
echo "   下一步：Cloudflare Pages 控制台 -> znqm-site -> Custom domains 添加 znqm.cloud"
