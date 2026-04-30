export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const FUDO_AUTH = 'https://auth.fu.do/api';
  const FUDO_API = 'https://api.fu.do/v1alpha1';

  const credenciales = {
    'CORALES': { apiKey: 'MUA0MzI4OA==', apiSecret: 'm77IGbUCfx1ndxSUTrmiIj5RrRc2Snlu' }
  };

  const { accion, sede, fecha } = { ...req.query, ...req.body };
  const fechaHoy = fecha || new Date().toISOString().split('T')[0];

  if (!sede || !credenciales[sede.toUpperCase()]) {
    return res.json({ success: false, error: 'Sede no válida', sedes: Object.keys(credenciales) });
  }

  const creds = credenciales[sede.toUpperCase()];

  // Obtener token
  async function getToken() {
    const r = await fetch(FUDO_AUTH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: creds.apiKey, apiSecret: creds.apiSecret })
    });
    const data = await r.json();
    return data.token;
  }

  // Obtener pedidos
  async function getPedidos(token) {
    const r = await fetch(`${FUDO_API}/sales?page[size]=500`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return await r.json();
  }

  try {
    if (accion === 'test') {
      const token = await getToken();
      return res.json({ success: !!token, mensaje: token ? 'Conexión exitosa' : 'Error', sede });
    }

    if (accion === 'traer_domicilios' || accion === 'consultar_pedidos') {
      const token = await getToken();
      const resultado = await getPedidos(token);
      const pedidos = resultado.data || [];

      if (accion === 'consultar_pedidos') {
        return res.json({ success: true, fecha: fechaHoy, sede, total: pedidos.length, pedidos });
      }

      // FILTRAR DOMICILIOS - CORREGIDO
      const domicilios = pedidos.filter(p => {
        const customerName = (p.attributes?.customerName || '').toLowerCase();
        return customerName.includes('domicilio');
      }).map(p => ({
        id: p.id,
        numero: p.attributes?.customerName || '',
        total: p.attributes?.total || 0,
        fecha: p.attributes?.createdAt || '',
        saleType: p.attributes?.saleType || '',
        _raw: p.attributes
      }));

      return res.json({
        success: true,
        fecha: fechaHoy,
        sede,
        totalPedidos: pedidos.length,
        totalDomicilios: domicilios.length,
        domicilios
      });
    }

    return res.json({ success: false, error: 'Acción no válida', acciones: ['test', 'consultar_pedidos', 'traer_domicilios'] });

  } catch (error) {
    return res.json({ success: false, error: error.message });
  }
}
