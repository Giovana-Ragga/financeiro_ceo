const OWNER='Giovana-Ragga', REPO='financeiro_ceo', BRANCH='main', PATH='data.json';
const api=`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
const gh=(t)=>({Authorization:`Bearer ${t}`,Accept:'application/vnd.github+json','User-Agent':'painel-financeiro','Content-Type':'application/json'});

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido'});
  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({error:'GITHUB_TOKEN não configurado na Vercel'});
  const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  if (!Array.isArray(b.expenses) || b.expenses.length === 0) return res.status(400).json({error:'Dados inválidos'});
  try {
    const cur = await fetch(`${api}?ref=${BRANCH}`, {headers: gh(token)});
    let sha, curUpdated = null;
    if (cur.ok) {
      const j = await cur.json(); sha = j.sha;
      try { curUpdated = JSON.parse(Buffer.from(j.content,'base64').toString('utf8')).updatedAt || null; } catch(e){}
    } else if (cur.status !== 404) return res.status(502).json({error:'Falha ao ler GitHub ('+cur.status+')'});
    if (!b.force && curUpdated && b.baseUpdatedAt !== curUpdated) return res.status(409).json({error:'conflito', updatedAt: curUpdated});
    const updatedAt = new Date().toISOString();
    const content = JSON.stringify({updatedAt, ceoName:b.ceoName||'', cartaoTitular:b.cartaoTitular||'', expenses:b.expenses, history:Array.isArray(b.history)?b.history.slice(-1000):[]});
    const put = await fetch(api, {method:'PUT', headers: gh(token), body: JSON.stringify({
      message:`Atualiza despesas (${b.expenses.length}) - ${updatedAt}`, content: Buffer.from(content,'utf8').toString('base64'), branch: BRANCH, sha })});
    if (!put.ok) return res.status(502).json({error:'Falha ao gravar no GitHub ('+put.status+')'});
    return res.status(200).json({ok:true, updatedAt});
  } catch (e) { return res.status(500).json({error:e.message}); }
};
