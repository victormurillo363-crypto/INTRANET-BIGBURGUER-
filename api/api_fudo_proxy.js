// api_fudo_proxy.js - Para Vercel Serverless Functions
// Ubicación: /api/api_fudo_proxy.js

const FUDO_AUTH = 'https://auth.fu.do/api';
const FUDO_API = 'https://api.fu.do/v1alpha1';

// IDs de productos de domicilio conocidos
const PRODUCTOS_DOMICILIO = ['150', '151', '152', '153', '154', '155'];

const CREDENCIALES = {
    'CORALES': {
        apiKey: 'MUA0MzI4OA==',
        apiSecret: 'm77IGbUCfx1ndxSUTrmiIj5RrRc2Snlu'
    }
};

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { accion, sede, fecha } = req.query;
    
    if (!sede) {
        return res.status(400).json({ success: false, error: 'Sede no especificada' });
    }

    const sedeUpper = sede.toUpperCase();
    const creds = CREDENCIALES[sedeUpper];
    
    if (!creds) {
        return res.status(400).json({ 
            success: false, 
            error: `Credenciales no configuradas para: ${sede}`,
            sedesDisponibles: Object.keys(CREDENCIALES)
        });
    }

    try {
        // Obtener token
        const tokenRes = await fetch(FUDO_AUTH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: creds.apiKey, apiSecret: creds.apiSecret })
        });
        
        const tokenData = await tokenRes.json();
        
        if (!tokenData.token) {
            return res.json({ success: false, error: 'No se obtuvo token', data: tokenData });
        }

        if (accion === 'test' || accion === 'obtener_token') {
            return res.json({ success: true, mensaje: 'Conexión exitosa', sede });
        }

        // Consultar pedidos CON ITEMS Y PRODUCTS incluidos
        const fechaFiltro = fecha || new Date().toISOString().split('T')[0];
        let todosLosPedidos = [];
        let todosLosIncluded = [];
        let pagina = 1;
        let hayMasPaginas = true;

        while (hayMasPaginas && pagina <= 20) {
            // IMPORTANTE: include=items,products para obtener productos con nombres
            const url = `${FUDO_API}/sales?page[size]=500&page[number]=${pagina}&include=items,products`;
            
            const pedidosRes = await fetch(url, {
                headers: { 'Authorization': `Bearer ${tokenData.token}` }
            });
            
            const pedidosData = await pedidosRes.json();
            
            if (pedidosData.data && Array.isArray(pedidosData.data)) {
                todosLosPedidos = todosLosPedidos.concat(pedidosData.data);
            }
            
            if (pedidosData.included && Array.isArray(pedidosData.included)) {
                todosLosIncluded = todosLosIncluded.concat(pedidosData.included);
            }
            
            if (!pedidosData.data || pedidosData.data.length < 500) {
                hayMasPaginas = false;
            } else {
                pagina++;
            }
        }

        // Separar Items y Products del included
        const items = todosLosIncluded.filter(inc => inc.type === 'Item');
        const products = todosLosIncluded.filter(inc => inc.type === 'Product');

        // Crear mapa de productos por ID
        const productosMap = {};
        products.forEach(prod => {
            productosMap[prod.id] = {
                id: prod.id,
                nombre: prod.attributes?.name || prod.attributes?.productName || '',
                precio: prod.attributes?.price || 0
            };
        });

        if (accion === 'consultar_pedidos') {
            return res.json({
                success: true,
                fecha: fechaFiltro,
                sede,
                totalPedidos: todosLosPedidos.length,
                totalItems: items.length,
                totalProducts: products.length,
                pedidos: todosLosPedidos.slice(0, 3),
                items: items.slice(0, 10),
                products: products.slice(0, 20), // Muestra algunos productos para ver estructura
                productosMap: Object.fromEntries(Object.entries(productosMap).slice(0, 20))
            });
        }

        if (accion === 'traer_domicilios') {
            // Filtrar pedidos por fecha
            const pedidosFecha = todosLosPedidos.filter(pedido => {
                const fechaPedido = pedido.attributes?.closedAt?.split('T')[0] || 
                                    pedido.attributes?.createdAt?.split('T')[0] || '';
                return fechaPedido === fechaFiltro;
            });

            const domiciliosEncontrados = [];
            
            for (const pedido of pedidosFecha) {
                const pedidoId = pedido.id;
                const fechaPedido = pedido.attributes?.closedAt?.split('T')[0] || 
                                    pedido.attributes?.createdAt?.split('T')[0] || '';
                const totalPedido = pedido.attributes?.total || 0;
                const saleType = pedido.attributes?.saleType || '';
                
                // Obtener items de este pedido
                const itemsDelPedido = pedido.relationships?.items?.data || [];
                
                for (const itemRef of itemsDelPedido) {
                    // Buscar el item completo en included
                    const itemCompleto = items.find(it => it.id === itemRef.id);
                    
                    if (itemCompleto) {
                        // Obtener el product ID
                        const productId = itemCompleto.relationships?.product?.data?.id;
                        
                        // Verificar si es un producto de domicilio (por ID conocido)
                        if (productId && PRODUCTOS_DOMICILIO.includes(productId)) {
                            const producto = productosMap[productId] || {};
                            
                            domiciliosEncontrados.push({
                                pedidoId: pedidoId,
                                fecha: fechaPedido,
                                valorPedido: totalPedido,
                                saleType: saleType,
                                itemId: itemCompleto.id,
                                productId: productId,
                                nombreDomicilio: producto.nombre || `Domicilio (ID: ${productId})`,
                                precioDomicilio: itemCompleto.attributes?.price || 0,
                                cantidad: itemCompleto.attributes?.quantity || 1
                            });
                        }
                        // También buscar por nombre si el producto está disponible
                        else if (productId && productosMap[productId]) {
                            const nombreProd = (productosMap[productId].nombre || '').toLowerCase();
                            if (nombreProd.includes('domicilio')) {
                                domiciliosEncontrados.push({
                                    pedidoId: pedidoId,
                                    fecha: fechaPedido,
                                    valorPedido: totalPedido,
                                    saleType: saleType,
                                    itemId: itemCompleto.id,
                                    productId: productId,
                                    nombreDomicilio: productosMap[productId].nombre,
                                    precioDomicilio: itemCompleto.attributes?.price || 0,
                                    cantidad: itemCompleto.attributes?.quantity || 1
                                });
                            }
                        }
                    }
                }
            }

            return res.json({
                success: true,
                fecha: fechaFiltro,
                sede,
                totalPedidosEnFecha: pedidosFecha.length,
                totalDomiciliosEncontrados: domiciliosEncontrados.length,
                domicilios: domiciliosEncontrados,
                // Debug info
                _debug: {
                    totalPedidosTotales: todosLosPedidos.length,
                    totalItems: items.length,
                    totalProducts: products.length,
                    productosDomicilioIds: PRODUCTOS_DOMICILIO
                }
            });
        }

        return res.status(400).json({ 
            success: false, 
            error: 'Acción no válida',
            accionesDisponibles: ['test', 'obtener_token', 'consultar_pedidos', 'traer_domicilios']
        });

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}
