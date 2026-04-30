// api_fudo_proxy.js - Para Vercel Serverless Functions
const FUDO_AUTH = 'https://auth.fu.do/api';
const FUDO_API = 'https://api.fu.do/v1alpha1';

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

        const fechaFiltro = fecha || new Date().toISOString().split('T')[0];
        let todosLosPedidos = [];
        let todosLosIncluded = [];
        
        let pagina = 1;
        let continuar = true;
        
        while (pagina <= 30 && continuar) {
            // Incluir items y shippingCosts
            const url = `${FUDO_API}/sales?page[size]=500&page[number]=${pagina}&include=items,shippingCosts&sort=-createdAt`;
            
            const pedidosRes = await fetch(url, {
                headers: { 'Authorization': `Bearer ${tokenData.token}` }
            });
            const pedidosData = await pedidosRes.json();
            
            if (pedidosData.data && pedidosData.data.length > 0) {
                todosLosPedidos = todosLosPedidos.concat(pedidosData.data);
                
                if (pedidosData.included) {
                    todosLosIncluded = todosLosIncluded.concat(pedidosData.included);
                }
                
                const ultimaFecha = pedidosData.data[pedidosData.data.length - 1]?.attributes?.createdAt?.split('T')[0] || '';
                if (ultimaFecha && ultimaFecha < fechaFiltro) continuar = false;
            } else {
                continuar = false;
            }
            
            pagina++;
        }

        // Separar items y shippingCosts
        const items = todosLosIncluded.filter(i => i.type === 'Item');
        const shippingCosts = todosLosIncluded.filter(i => i.type === 'ShippingCost');

        if (accion === 'consultar_pedidos') {
            const primerasFechas = todosLosPedidos.slice(0, 10).map(p => ({
                id: p.id,
                createdAt: p.attributes?.createdAt,
                saleType: p.attributes?.saleType,
                saleState: p.attributes?.saleState,
                total: p.attributes?.total
            }));
            
            return res.json({
                success: true,
                fechaBuscada: fechaFiltro,
                sede,
                totalPedidos: todosLosPedidos.length,
                totalItems: items.length,
                totalShippingCosts: shippingCosts.length,
                paginasConsultadas: pagina - 1,
                primerasFechas,
                shippingCostsMuestra: shippingCosts.slice(0, 5)
            });
        }

        if (accion === 'traer_domicilios') {
            const pedidosFecha = todosLosPedidos.filter(p => {
                const fp = p.attributes?.createdAt?.split('T')[0] || '';
                const esFecha = fp === fechaFiltro;
                const esCerrado = p.attributes?.saleState === 'CLOSED';
                const esDelivery = p.attributes?.saleType === 'DELIVERY';
                return esFecha && esCerrado && esDelivery;
            });

            const domicilios = [];
            
            for (const pedido of pedidosFecha) {
                // Buscar el costo de envío
                let valorDomicilio = 0;
                const shippingRef = pedido.relationships?.shippingCosts?.data || [];
                
                for (const ref of shippingRef) {
                    const shipping = shippingCosts.find(s => s.id === ref.id);
                    if (shipping) {
                        valorDomicilio = shipping.attributes?.amount || shipping.attributes?.price || 0;
                        break;
                    }
                }
                
                domicilios.push({
                    pedidoId: pedido.id,
                    fecha: pedido.attributes?.createdAt?.split('T')[0] || '',
                    hora: pedido.attributes?.createdAt?.split('T')[1]?.substring(0,5) || '',
                    valorPedido: pedido.attributes?.total || 0,
                    valorDomicilio: valorDomicilio,
                    customerName: pedido.attributes?.customerName || pedido.attributes?.anonymousCustomer?.name || '',
                    telefono: pedido.attributes?.anonymousCustomer?.phone || '',
                    direccion: pedido.attributes?.anonymousCustomer?.address || ''
                });
            }

            return res.json({
                success: true,
                fechaBuscada: fechaFiltro,
                sede,
                totalDomicilios: domicilios.length,
                domicilios,
                _debug: {
                    totalPedidosTotales: todosLosPedidos.length,
                    paginasConsultadas: pagina - 1
                }
            });
        }

        return res.status(400).json({ success: false, error: 'Acción no válida' });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
