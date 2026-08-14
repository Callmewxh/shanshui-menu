// Cloudflare 状态探针：检查 Worker 是否存在 + workers.dev 子域是否已领取。
// 凭据走环境变量，绝不硬编码进文件。
const TOKEN = process.env.CF_API_TOKEN;
const ACCT = process.env.CF_ACCOUNT_ID;
const BASE = 'https://api.cloudflare.com/client/v4';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function get(path) {
  const r = await fetch(BASE + path, { headers: H });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

(async () => {
  // 1) 列出账号下已部署的 Worker
  const list = await get(`/accounts/${ACCT}/workers/scripts`);
  const scripts = (list.j.result || []).map((s) => s.id);
  console.log('[WORKER LIST] status=', list.status, '| workers:', scripts.join(', ') || '(none)');
  console.log('[CHECK] has shanshui-dav =', scripts.includes('shanshui-dav'));

  // 2) 查询 workers.dev 子域
  const sub = await get(`/accounts/${ACCT}/workers/subdomain`);
  console.log('[SUBDOMAIN] status=', sub.status);
  if (sub.status === 200 && sub.j.result && sub.j.result.subdomain) {
    console.log('[SUBDOMAIN] claimed ->', sub.j.result.subdomain);
    console.log('[URL] https://shanshui-dav.' + sub.j.result.subdomain + '.workers.dev/dav');
  } else {
    console.log('[SUBDOMAIN] NOT claimed yet. errors=', JSON.stringify(sub.j.errors || sub.j));
    // 若提供了 CLAIM_NAME 且尚未领取，则尝试领取
    if (process.env.CLAIM_NAME) {
      const cr = await fetch(BASE + `/accounts/${ACCT}/workers/subdomain`, {
        method: 'POST',
        headers: H,
        body: JSON.stringify({ subdomain: process.env.CLAIM_NAME }),
      });
      const cj = await cr.json();
      console.log('[CLAIM] status=', cr.status, '|', JSON.stringify(cj));
    } else {
      console.log('[CLAIM] 未提供 CLAIM_NAME，跳过领取（请在调用时传入 CLAIM_NAME=xxx）');
    }
  }
})();
