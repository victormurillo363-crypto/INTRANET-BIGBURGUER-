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
  const fechaFiltro = fecha || new Date().toISOString().split('T')[0];

  if (!sede || !credenciales[sede.toUpperCase()]) {
    return res.json({ success: false, error: 'Sede no válida', sedes: Object.keys(credenciales) });
  }

  const creds = credenciales[sede.toUpperCase()];

  async function getToken() {
    const r = await fetch(FUDO_AUTH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: creds.apiKey, apiSecret: creds.apiSecret })
    });
    const data = await r.json();
    return data.token;
  }

  // Obtener pedidos CON items incluidos
  async function getPedidos(token, pagina = 1) {
    const url = `${FUDO_API}/sales?page[size]=500&page[number]=${pagina}&include=items`;
    const r = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return await r.json();
  }

  try {
    if (accion === 'test') {
      const token = await getToken();
      return res.json({ success: !!token, mensaje: token ? 'Conexión exitosa' : 'Error', sede });
    }

    if (accion === 'consultar_pedidos') {
      const token = await getToken();
      const resultado = await getPedidos(token);
      return res.json({ 
        success: true, 
        fecha: fechaFiltro, 
        sede, 
        total: resultado.data?.length || 0, 
        pedidos: resultado.data || [],
        included: resultado.included || []
      });
    }

    if (accion === 'traer_domicilios') {
      const token = await getToken();
      const resultado = await getPedidos(token);
      const pedidos = resultado.data || [];
      const included = resultado.included || [];

      // Crear mapa de items por ID
      const itemsMap = {};
      included.forEach(item => {
        if (item.type === 'Item' || item.type === 'SaleItem') {
          itemsMap[item.id] = item;
        }
      });

      // Filtrar pedidos por fecha y que tengan producto "domicilio"
      const domicilios = [];

      pedidos.forEach(pedido => {
        const fechaPedido = (pedido.attributes?.createdAt || '').split('T')[0];
        
        // Filtrar por fecha
        if (fechaPedido !== fechaFiltro) return;

        // Buscar items del pedido
        const itemsRefs = pedido.relationships?.items?.data || [];
        
        itemsRefs.forEach(ref => {
          const item = itemsMap[ref.id];
          if (item) {
            const nombreItem = (item.attributes?.name || '').toLowerCase();
            
            // Si el item contiene "domicilio"
            if (nombreItem.includes('domicilio')) {
              domicilios.push({
                pedidoId: pedido.id,
                itemId: item.id,
                nombreProducto: item.attributes?.name || '',
                precioProducto: item.attributes?.price || item.attributes?.total || 0,
                totalPedido: pedido.attributes?.total || 0,
                fechaPedido: pedido.attributes?.createdAt || '',
                customerName: pedido.attributes?.customerName || '',
                _rawItem: item.attributes,
                _rawPedido: pedido.attributes
              });
            }
          }
        });
      });

      return res.json({
        success: true,
        fecha: fechaFiltro,
        sede,
        totalPedidos: pedidos.length,
        totalDomicilios: domicilios.length,
        domicilios,
        debug: {
          totalIncluded: included.length,
          tiposIncluded: [...new Set(included.map(i => i.type))]
        }
      });
    }

    return res.json({ success: false, error: 'Acción no válida', acciones: ['test', 'consultar_pedidos', 'traer_domicilios'] });

  } catch (error) {
    return res.json({ success: false, error: error.message });
  }
}
