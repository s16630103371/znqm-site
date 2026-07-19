// ZNQM API Worker — proxies tokenhub.tencentmaas.com (Tencent MaaS TokenHub)
// Secrets: API_KEY (your tokenhub Bearer key). Set via `wrangler secret put API_KEY`.
// Endpoints:
//   POST /api/img2img  { prompt, image?, size?, n? }      -> { images:[dataUrl], revised_prompt }
//   POST /api/describe { image(dataUrl) }                 -> { description }
//   POST /api/copy     { brief }                          -> { title, subtitle, tags:[] }
//   GET  /api/health                                        -> { ok:true, model }

const GATEWAY = 'https://tokenhub.tencentmaas.com';
const IMG_MODEL = 'hy-image-v3.0';
const VISION_MODEL = 'hunyuan-t1-vision-20250916';
const CHAT_MODEL = 'qwen3.5-plus';

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors() },
  });
}
function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function genImage(key, { prompt, image, size = '1024x1024', n = 1 }) {
  const payload = { model: IMG_MODEL, prompt: String(prompt).slice(0, 1000), n: Math.min(Math.max(parseInt(n) || 1, 1), 4), size };
  if (image) payload.image = image; // optional init image (img2img)
  let upstream = await fetch(`${GATEWAY}/v1/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let data = await upstream.json().catch(() => ({}));
  // If init-image is unsupported, retry as pure text-to-image
  if (image && (upstream.status !== 200 || !data.data)) {
    delete payload.image;
    upstream = await fetch(`${GATEWAY}/v1/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    data = await upstream.json().catch(() => ({}));
  }
  if (upstream.status !== 200 || !data.data || !data.data.length) {
    throw new Error(data?.error?.message || 'image generation failed');
  }
  const images = [];
  for (const item of data.data) {
    if (!item?.url) continue;
    const r = await fetch(item.url);
    const buf = await r.arrayBuffer();
    const ct = r.headers.get('content-type') || 'image/jpeg';
    images.push(`data:${ct};base64,${bufToBase64(buf)}`);
  }
  return { images, revised_prompt: data.revised_prompt || prompt };
}

async function describe(key, image) {
  const r = await fetch(`${GATEWAY}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL, stream: false, max_tokens: 200,
      messages: [{ role: 'user', content: [
        { type: 'text', text: '用一句话描述这张图片的画面内容，中文，不超过40字。' },
        { type: 'image_url', image_url: { url: image } },
      ] }],
    }),
  });
  const d = await r.json().catch(() => ({}));
  return (d.choices?.[0]?.message?.content || '').trim();
}

async function copy(key, brief) {
  const sys = '你是一个资深海报文案专家。根据用户提供的主题或图片描述，生成海报标题(title)、副标题(subtitle)和3个标签(tags数组)。只输出JSON，不要解释。格式:{"title":"...","subtitle":"...","tags":["...","...","..."]}';
  const r = await fetch(`${GATEWAY}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL, stream: false, temperature: 0.9, max_tokens: 300,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: String(brief || '未来科技主题').slice(0, 600) },
      ],
    }),
  });
  const d = await r.json().catch(() => ({}));
  const content = d.choices?.[0]?.message?.content || '{}';
  const m = content.match(/\{[\s\S]*\}/);
  let parsed = { title: '', subtitle: '', tags: [] };
  try { parsed = JSON.parse(m ? m[0] : '{}'); } catch {}
  return { title: parsed.title || '', subtitle: parsed.subtitle || '', tags: Array.isArray(parsed.tags) ? parsed.tags : [] };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
    const key = env.API_KEY;
    if (!key) return json({ error: 'Server missing API_KEY secret' }, 500);
    try {
      if (url.pathname === '/api/health') return json({ ok: true, model: IMG_MODEL });
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

      if (url.pathname === '/api/img2img') {
        const b = await request.json().catch(() => ({}));
        if (!b.prompt && !b.image) return json({ error: 'prompt or image required' }, 400);
        const res = await genImage(key, b);
        return json(res);
      }
      if (url.pathname === '/api/describe') {
        const b = await request.json().catch(() => ({}));
        if (!b.image) return json({ error: 'image required' }, 400);
        return json({ description: await describe(key, b.image) });
      }
      if (url.pathname === '/api/copy') {
        const b = await request.json().catch(() => ({}));
        return json(await copy(key, b.brief || b.prompt));
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      return json({ error: String(e?.message || e) }, 500);
    }
  },
};
