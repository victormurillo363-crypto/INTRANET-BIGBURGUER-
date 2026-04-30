// api_fudo_proxy.js - Para Vercel Serverless Functions
const FUDO_AUTH = 'https://auth.fu.do/api';
const FUDO_API = 'https://api.fu.do/v1alpha1';

// IDs de productos de domicilio (los que me mostraste)
const PRODUCTOS_DOMICILIO = ['150', '151', '152', '153', '154', '155'];

const CREDENCIALES = {
    'CORALES': {
        apiKey: 'MUA0MzI4OA==',
        apiSecret: 'm77IGbUCfx1ndxSUTrmiIj5RrRc2Snlu'
    }
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { accion, sede, fecha } = req.query;
    
    if (!sede) return res.status(400).json({ success: false, error: 'Sede no especificada' });

    const creds = CREDENCIALES[sede.toUpperCase()];
    if (!creds) return res.status(400).json({ success: false, error: `Sede no configurada: ${sede}` });

    try {
        // Obtener token
        const tokenRes = await fetch(FUDO_AUTH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: creds.apiKey, apiSecret: creds.apiSecret })
        });
        const tokenData = await tokenRes.json();
        
        if (!tokenData.token) return res.json({ success: false, error: 'No se obtuvo token' });

        if (accion === 'test') {
            return res.json({ success: true, mensaje: 'Conexión exitosa', sede });
        }

        // Consultar pedidos con items (sin products para evitar timeout)
        const fechaFiltro = fecha || new Date().toISOString().split('T')[0];
        let todosLosPedidos = [];
        let todosLosItems = [];
        
        // Solo 1 página para probar rápido
        const url = `${FUDO_API}/sales?page[size]=500&page[number]=1&include=items`;
        
        const pedidosRes = await fetch(url, {
            headers: { 'Authorization': `Bearer ${tokenData.token}` }
        });
        const pedidosData = await pedidosRes.json();
        
        if (pedidosData.data) todosLosPedidos = pedidosData.data;
        if (pedidosData.included) todosLosItems = pedidosData.included.filter(i => i.type === 'Item');

        if (accion === 'consultar_pedidos') {
            return res.json({
                success: true,
                fecha: fechaFiltro,
                sede,
                totalPedidos: todosLosPedidos.length,
                totalItems: todosLosItems.length,
                pedidos: todosLosPedidos.slice(0, 5),
                items: todosLosItems.slice(0, 10)
            });
        }

        if (accion === 'traer_domicilios') {
            // Filtrar pedidos por fecha
            const pedidosFecha = todosLosPedidos.filter(p => {
                const fp = p.attributes?.closedAt?.split('T')[0] || p.attributes?.createdAt?.split('T')[0] || '';
                return fp === fechaFiltro;
            });

            const domicilios = [];
            
            for (const pedido of pedidosFecha) {
                const itemsRef = pedido.relationships?.items?.data || [];
                
                for (const ref of itemsRef) {
                    const item = todosLosItems.find(i => i.id === ref.id);
                    if (!item) continue;
                    
                    const productId = item.relationships?.product?.data?.id;
                    
                    // Verificar si es producto de domicilio por ID
                    if (productId && PRODUCTOS_DOMICILIO.includes(productId)) {
                        domicilios.push({
                            pedidoId: pedido.id,
                            fecha: pedido.attributes?.closedAt?.split('T')[0] || '',
                            hora: pedido.attributes?.closedAt?.split('T')[1]?.substring(0,5) || '',
                            valorPedido: pedido.attributes?.total || 0,
                            productId: productId,
                            precioDomicilio: item.attributes?.price || 0,
                            cantidad: item.attributes?.quantity || 1
                        });
                    }
                }
            }

            return res.json({
                success: true,
                fecha: fechaFiltro,
                sede,
                totalPedidosEnFecha: pedidosFecha.length,
                totalDomicilios: domicilios.length,
                domicilios,
                _debug: { totalPedidosTotales: todosLosPedidos.length }
            });
        }

        return res.status(400).json({ success: false, error: 'Acción no válida' });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
