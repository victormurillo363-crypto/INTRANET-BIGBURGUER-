// api/fudo-proxy.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const FUDO_AUTH_URL = 'https://auth.fu.do/api';
  const FUDO_API_URL = 'https://api.fu.do/v1alpha1';

  const credenciales = {
    'CORALES': { apiKey: 'MUA0MzI4OA==', apiSecret: 'm77IGbUCfx1ndxSUTrmiIj5RrRc2Snlu' }
  };

  const body = req.body || {};
  const query = req.query || {};
  const accion = body.accion || query.accion || '';
  const sede = (body.sede || query.sede || '').toUpperCase();
  const fecha = body.fecha || query.fecha || new Date().toISOString().split('T')[0];

  if (!sede) return res.status(400).json({ success: false, error: 'Sede no especificada' });
  
  const cred = credenciales[sede];
  if (!cred) return res.status(400).json({ success: false, error: `Sede ${sede} no configurada` });

  async function getToken() {
    const r = await fetch(FUDO_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: cred.apiKey, apiSecret: cred.apiSecret })
    });
    return r.json();
  }

  async function getPedidos(token) {
    const r = await fetch(`${FUDO_API_URL}/sales?page[size]=500`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return r.json();
  }

  try {
    if (accion === 'test') {
      const t = await getToken();
      return res.json({ success: !!t.token, mensaje: t.token ? 'Conexión exitosa' : 'Error', sede });
    }

    if (accion === 'traer_domicilios' || accion === 'consultar_pedidos') {
      const t = await getToken();
      if (!t.token) return res.status(401).json({ success: false, error: 'Auth fallida' });
      
      let pedidos = await getPedidos(t.token);
      if (pedidos.data) pedidos = pedidos.data;
      
      if (accion === 'traer_domicilios') {
        const domicilios = (pedidos || []).filter(p => {
          const n = (p.name || '').toLowerCase();
          return n.includes('domicilio');
        }).map(p => ({
          id: p.id,
          numero: p.name || '',
          total: p.total || 0,
          estado: p.status || '',
          fecha: p.date || ''
        }));
        return res.json({ success: true, fecha, sede, totalDomicilios: domicilios.length, domicilios });
      }
      return res.json({ success: true, fecha, sede, total: pedidos?.length || 0, pedidos });
    }

    return res.status(400).json({ success: false, error: 'Acción no válida' });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
