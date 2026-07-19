// 本地开发代理 / 静态服务器 —— 用于在本机端到端测试（无需部署 Cloudflare）。
// 用法: API_KEY=sk-xxx node server/dev.mjs  然后访问 http://localhost:8788
// 功能: 1) 托管 znqm-site 下的静态文件  2) 把 /api/* 转发到 tokenhub (密钥不进浏览器)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8788;
const KEY = process.env.API_KEY;
const GATEWAY = 'https://tokenhub.tencentmaas.com';
const IMG_MODEL = 'hy-image-v3.0';
const VISION_MODEL = 'hunyuan-t1-vision-20250916';
const CHAT_MODEL = 'qwen3.5-plus';

const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.webp':'image/webp', '.ico':'image/x-icon' };

function sendJSON(res, data, status = 200) {
  const b = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(b);
}
function bufToBase64(buf) {
  return Buffer.from(buf).toString('base64');
}

async function genImage(body) {
  const payload = { model: IMG_MODEL, prompt: String(body.prompt || '').slice(0, 1000), n: Math.min(Math.max(parseInt(body.n) || 1, 1), 4), size: body.size || '1024x1024' };
  if (body.image) payload.image = body.image;
  let up = await fetch(`${GATEWAY}/v1/images/generations`, { method:'POST', headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  let data = await up.json().catch(()=>({}));
  if (body.image && (up.status !== 200 || !data.data)) {
    delete payload.image;
    up = await fetch(`${GATEWAY}/v1/images/generations`, { method:'POST', headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    data = await up.json().catch(()=>({}));
  }
  if (up.status !== 200 || !data.data || !data.data.length) throw new Error(data?.error?.message || 'image generation failed');
  const images = [];
  for (const it of data.data) {
    if (!it?.url) continue;
    const r = await fetch(it.url);
    const ct = r.headers.get('content-type') || 'image/jpeg';
    images.push(`data:${ct};base64,${bufToBase64(Buffer.from(await r.arrayBuffer()))}`);
  }
  return { images, revised_prompt: data.revised_prompt || body.prompt };
}
async function describe(image) {
  const r = await fetch(`${GATEWAY}/v1/chat/completions`, { method:'POST', headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},
    body: JSON.stringify({ model: VISION_MODEL, stream:false, max_tokens:200, messages:[{role:'user',content:[{type:'text',text:'用一句话描述这张图片的画面内容，中文，不超过40字。'},{type:'image_url',image_url:{url:image}}]}] }) });
  const d = await r.json().catch(()=>({}));
  return (d.choices?.[0]?.message?.content || '').trim();
}
async function copy(brief) {
  const sys = '你是一个资深海报文案专家。根据用户提供的主题或图片描述，生成海报标题(title)、副标题(subtitle)和3个标签(tags数组)。只输出JSON，不要解释。格式:{"title":"...","subtitle":"...","tags":["...","...","..."]}';
  const r = await fetch(`${GATEWAY}/v1/chat/completions`, { method:'POST', headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},
    body: JSON.stringify({ model: CHAT_MODEL, stream:false, temperature:0.9, max_tokens:300, messages:[{role:'system',content:sys},{role:'user',content:String(brief||'未来科技主题').slice(0,600)}] }) });
  const d = await r.json().catch(()=>({}));
  const content = d.choices?.[0]?.message?.content || '{}';
  const m = content.match(/\{[\s\S]*\}/);
  let p = { title:'', subtitle:'', tags:[] };
  try { p = JSON.parse(m ? m[0] : '{}'); } catch {}
  return { title: p.title||'', subtitle: p.subtitle||'', tags: Array.isArray(p.tags)?p.tags:[] };
}

async function handleApi(req, res, pathname) {
  if (!KEY) return sendJSON(res, { error: '缺少 API_KEY 环境变量' }, 500);
  try {
    if (pathname === '/api/health') return sendJSON(res, { ok:true, model: IMG_MODEL });
    const body = await new Promise((ok) => { let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{ok(JSON.parse(d||'{}'))}catch{ok({})}}); });
    if (pathname === '/api/img2img') {
      if (!body.prompt && !body.image) return sendJSON(res, { error:'prompt 或 image 必填' }, 400);
      return sendJSON(res, await genImage(body));
    }
    if (pathname === '/api/describe') {
      if (!body.image) return sendJSON(res, { error:'image 必填' }, 400);
      return sendJSON(res, { description: await describe(body.image) });
    }
    if (pathname === '/api/copy') {
      return sendJSON(res, await copy(body.brief || body.prompt));
    }
    return sendJSON(res, { error:'Not found' }, 404);
  } catch (e) {
    return sendJSON(res, { error: String(e?.message || e) }, 500);
  }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  if (u.pathname.startsWith('/api/')) {
    if (req.method === 'OPTIONS') { res.writeHead(204, {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}); return res.end(); }
    return handleApi(req, res, u.pathname);
  }
  // static
  let rel = decodeURIComponent(u.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, {'Content-Type':'text/plain'}); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
server.listen(PORT, () => console.log(`ZNQM dev server: http://localhost:${PORT}  (API_KEY ${KEY?'set':'MISSING'})`));
