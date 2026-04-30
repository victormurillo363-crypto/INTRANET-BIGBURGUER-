// api_fudo_proxy.js - Para Vercel Serverless Functions
const FUDO_AUTH = 'https://auth.fu.do/api';
const FUDO_API = 'https://api.fu.do/v1alpha1';

// IDs de productos de domicilio
const PRODUCTOS_DOMICILIO = {
    '150': { nombre: 'Domicilio 0', precio: 0 },
    '151': { nombre: 'Domicilio 6', precio: 6000 },
    '152': { nombre: 'Domicilio 9', precio: 9000 },
    '153': { nombre: 'Domicilio 11', precio: 11000 },
    '154': { nombre: 'Domicilio 13', precio: 13000 },
    '155': { nombre: 'Domicilio 16', precio: 16000 }
};

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
        let continuar = true;
        
        while (pagina <= 30 && continuar) {
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
                
                const ultimaFecha = pedidosData.data[pedidosData.data.length - 1]?.attributes?.createdAt?.split('T')[0] || '';
                if (ultimaFecha && ultimaFecha < fechaFiltro) continuar = false;
            } else {
                continuar = false;
            }
            
            pagina++;
        }

        if (accion === 'consultar_pedidos') {
            // Mostrar los Product IDs únicos para debug
            const productIdsUnicos = [...new Set(
                todosLosItems.map(item => item.relationships?.product?.data?.id).filter(Boolean)
            )].sort((a, b) => Number(a) - Number(b));
            
            return res.json({
                success: true,
                fechaBuscada: fechaFiltro,
                sede,
                totalPedidos: todosLosPedidos.length,
                totalItems: todosLosItems.length,
                paginasConsultadas: pagina - 1,
                productIdsUnicos: productIdsUnicos,
                // Mostrar items con Product IDs cercanos a 150-155
                itemsCercanos: todosLosItems
                    .filter(item => {
                        const pid = item.relationships?.product?.data?.id;
                        return pid && Number(pid) >= 140 && Number(pid) <= 170;
                    })
                    .slice(0, 10)
                    .map(item => ({
                        itemId: item.id,
                        productId: item.relationships?.product?.data?.id,
                        price: item.attributes?.price,
                        saleId: item.relationships?.sale?.data?.id
                    }))
            });
        }

        if (accion === 'traer_domicilios') {
            // Filtrar pedidos por fecha y CLOSED
            const pedidosFecha = todosLosPedidos.filter(p => {
                const fp = p.attributes?.createdAt?.split('T')[0] || '';
                const esFecha = fp === fechaFiltro;
                const esCerrado = p.attributes?.saleState === 'CLOSED';
                return esFecha && esCerrado;
            });

            // Obtener IDs de los pedidos de la fecha
            const pedidosFechaIds = pedidosFecha.map(p => p.id);
            
            // Filtrar items que pertenecen a pedidos de la fecha
            const itemsDeFecha = todosLosItems.filter(item => {
                const saleId = item.relationships?.sale?.data?.id;
                return pedidosFechaIds.includes(saleId);
            });

            const domicilios = [];
            const productIdsEncontrados = [];
            
            for (const pedido of pedidosFecha) {
                const itemsRef = pedido.relationships?.items?.data || [];
                
                for (const ref of itemsRef) {
                    const item = todosLosItems.find(i => i.id === ref.id);
                    if (!item) continue;
                    
                    const productId = item.relationships?.product?.data?.id;
                    if (productId) productIdsEncontrados.push(productId);
                    
                    // Si es un producto de domicilio
                    if (productId && PRODUCTOS_DOMICILIO[productId]) {
                        const infoDomicilio = PRODUCTOS_DOMICILIO[productId];
                        
                        domicilios.push({
                            pedidoId: pedido.id,
                            fecha: pedido.attributes?.createdAt?.split('T')[0] || '',
                            hora: pedido.attributes?.createdAt?.split('T')[1]?.substring(0,5) || '',
                            valorPedido: pedido.attributes?.total || 0,
                            valorDomicilio: item.attributes?.price || infoDomicilio.precio,
                            tipoDomicilio: infoDomicilio.nombre,
                            productId: productId,
                            saleType: pedido.attributes?.saleType,
                            customerName: pedido.attributes?.customerName || ''
                        });
                        
                        break;
                    }
                }
            }

            // Product IDs únicos encontrados en pedidos de la fecha
            const productIdsUnicosFecha = [...new Set(productIdsEncontrados)].sort((a, b) => Number(a) - Number(b));

            return res.json({
                success: true,
                fechaBuscada: fechaFiltro,
                sede,
                totalPedidosCerrados: pedidosFecha.length,
                totalItemsEnFecha: itemsDeFecha.length,
                totalDomicilios: domicilios.length,
                domicilios,
                _debug: {
                    totalPedidosTotales: todosLosPedidos.length,
                    totalItemsTotales: todosLosItems.length,
                    paginasConsultadas: pagina - 1,
                    productIdsBuscados: Object.keys(PRODUCTOS_DOMICILIO),
                    productIdsEncontradosEnFecha: productIdsUnicosFecha
                }
            });
        }

        return res.status(400).json({ success: false, error: 'Acción no válida' });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
