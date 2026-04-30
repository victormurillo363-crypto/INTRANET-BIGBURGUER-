// api_fudo_proxy.js - Para Vercel Serverless Functions
const FUDO_AUTH = 'https://auth.fu.do/api';
const FUDO_API = 'https://api.fu.do/v1alpha1';

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
        let todosLosItems = [];
        
        let pagina = 1;
        let encontrada = false;
        
        while (pagina <= 20 && !encontrada) {
            // CAMBIO: Ordenar por createdAt descendente
            const url = `${FUDO_API}/sales?page[size]=500&page[number]=${pagina}&include=items&sort=-createdAt`;
            
            const pedidosRes = await fetch(url, {
                headers: { 'Authorization': `Bearer ${tokenData.token}` }
            });
            const pedidosData = await pedidosRes.json();
            
            if (pedidosData.data && pedidosData.data.length > 0) {
                todosLosPedidos = todosLosPedidos.concat(pedidosData.data);
                
                if (pedidosData.included) {
                    todosLosItems = todosLosItems.concat(
                        pedidosData.included.filter(i => i.type === 'Item')
                    );
                }
                
                // Ver si tenemos pedidos de la fecha buscada (usando createdAt)
                const tienesFecha = pedidosData.data.some(p => {
                    const fp = p.attributes?.createdAt?.split('T')[0] || '';
                    return fp === fechaFiltro;
                });
                
                if (tienesFecha) encontrada = true;
                
                // Ver la fecha del último pedido
                const ultimaFecha = pedidosData.data[pedidosData.data.length - 1]?.attributes?.createdAt?.split('T')[0] || '';
                
                if (ultimaFecha && ultimaFecha < fechaFiltro) break;
            } else {
                break;
            }
            
            pagina++;
        }

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
                totalItems: todosLosItems.length,
                paginasConsultadas: pagina,
                primerasFechas
            });
        }

        if (accion === 'traer_domicilios') {
            // Filtrar por fecha usando createdAt
            const pedidosFecha = todosLosPedidos.filter(p => {
                const fp = p.attributes?.createdAt?.split('T')[0] || '';
                return fp === fechaFiltro;
            });

            const domicilios = [];
            
            for (const pedido of pedidosFecha) {
                // Solo pedidos CLOSED (completados)
                if (pedido.attributes?.saleState !== 'CLOSED') continue;
                
                const itemsRef = pedido.relationships?.items?.data || [];
                
                for (const ref of itemsRef) {
                    const item = todosLosItems.find(i => i.id === ref.id);
                    if (!item) continue;
                    
                    const productId = item.relationships?.product?.data?.id;
                    
                    if (productId && PRODUCTOS_DOMICILIO.includes(productId)) {
                        domicilios.push({
                            pedidoId: pedido.id,
                            fecha: pedido.attributes?.createdAt?.split('T')[0] || '',
                            hora: pedido.attributes?.createdAt?.split('T')[1]?.substring(0,5) || '',
                            valorPedido: pedido.attributes?.total || 0,
                            saleType: pedido.attributes?.saleType,
                            productId: productId,
                            precioDomicilio: item.attributes?.price || 0,
                            cantidad: item.attributes?.quantity || 1
                        });
                    }
                }
            }

            return res.json({
                success: true,
                fechaBuscada: fechaFiltro,
                sede,
                totalPedidosEnFecha: pedidosFecha.length,
                totalDomicilios: domicilios.length,
                domicilios,
                _debug: {
                    totalPedidosTotales: todosLosPedidos.length,
                    paginasConsultadas: pagina,
                    fechaMasReciente: todosLosPedidos[0]?.attributes?.createdAt || 'ninguna'
                }
            });
        }

        return res.status(400).json({ success: false, error: 'Acción no válida' });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
