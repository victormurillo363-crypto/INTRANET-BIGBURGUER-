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

        const fechaFiltro = fecha || new Date().toISOString().split('T')[0];
        let todosLosPedidos = [];
        let todosLosItems = [];
        
        // CAMBIO: Ordenar por closedAt descendente para traer los más recientes primero
        // Y traer varias páginas hasta encontrar la fecha
        let pagina = 1;
        let encontrada = false;
        
        while (pagina <= 15 && !encontrada) {
            // Probar con sort=-closedAt para orden descendente
            const url = `${FUDO_API}/sales?page[size]=500&page[number]=${pagina}&include=items&sort=-closedAt`;
            
            const pedidosRes = await fetch(url, {
                headers: { 'Authorization': `Bearer ${tokenData.token}` }
            });
            const pedidosData = await pedidosRes.json();
            
            if (pedidosData.data && pedidosData.data.length > 0) {
                // Agregar pedidos
                todosLosPedidos = todosLosPedidos.concat(pedidosData.data);
                
                if (pedidosData.included) {
                    todosLosItems = todosLosItems.concat(
                        pedidosData.included.filter(i => i.type === 'Item')
                    );
                }
                
                // Ver si ya tenemos pedidos de la fecha que buscamos
                const tienesFecha = pedidosData.data.some(p => {
                    const fp = p.attributes?.closedAt?.split('T')[0] || '';
                    return fp === fechaFiltro;
                });
                
                if (tienesFecha) encontrada = true;
                
                // Ver la fecha del último pedido de esta página
                const ultimaFecha = pedidosData.data[pedidosData.data.length - 1]?.attributes?.closedAt?.split('T')[0] || '';
                
                // Si la última fecha es anterior a la que buscamos, ya pasamos
                if (ultimaFecha && ultimaFecha < fechaFiltro) {
                    break;
                }
            } else {
                break;
            }
            
            pagina++;
        }

        if (accion === 'consultar_pedidos') {
            // Mostrar los más recientes para debug
            const primerasFechas = todosLosPedidos.slice(0, 10).map(p => ({
                id: p.id,
                closedAt: p.attributes?.closedAt,
                total: p.attributes?.total
            }));
            
            return res.json({
                success: true,
                fecha: fechaFiltro,
                sede,
                totalPedidos: todosLosPedidos.length,
                totalItems: todosLosItems.length,
                paginasConsultadas: pagina,
                primerasFechas,  // Para ver qué fechas están viniendo
                pedidos: todosLosPedidos.slice(0, 3),
                items: todosLosItems.slice(0, 5)
            });
        }

        if (accion === 'traer_domicilios') {
            // Filtrar pedidos por fecha exacta
            const pedidosFecha = todosLosPedidos.filter(p => {
                const fp = p.attributes?.closedAt?.split('T')[0] || 
                           p.attributes?.createdAt?.split('T')[0] || '';
                return fp === fechaFiltro;
            });

            const domicilios = [];
            
            for (const pedido of pedidosFecha) {
                const itemsRef = pedido.relationships?.items?.data || [];
                
                for (const ref of itemsRef) {
                    const item = todosLosItems.find(i => i.id === ref.id);
                    if (!item) continue;
                    
                    const productId = item.relationships?.product?.data?.id;
                    
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
                _debug: {
                    totalPedidosTotales: todosLosPedidos.length,
                    paginasConsultadas: pagina,
                    primeraFechaEncontrada: todosLosPedidos[0]?.attributes?.closedAt || 'ninguna'
                }
            });
        }

        return res.status(400).json({ success: false, error: 'Acción no válida' });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
