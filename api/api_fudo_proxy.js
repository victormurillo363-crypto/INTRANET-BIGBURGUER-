// api_fudo_proxy.js - Para Vercel Serverless Functions
// Ubicación: /api/api_fudo_proxy.js

const FUDO_AUTH = 'https://auth.fu.do/api';
const FUDO_API = 'https://api.fu.do/v1alpha1';

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

        // Consultar pedidos CON ITEMS incluidos
        const fechaFiltro = fecha || new Date().toISOString().split('T')[0];
        let todosLosPedidos = [];
        let todosLosIncluded = [];
        let pagina = 1;
        let hayMasPaginas = true;

        while (hayMasPaginas && pagina <= 10) {
            // IMPORTANTE: include=items para obtener los productos
            const url = `${FUDO_API}/sales?page[size]=500&page[number]=${pagina}&include=items`;
            
            const pedidosRes = await fetch(url, {
                headers: { 'Authorization': `Bearer ${tokenData.token}` }
            });
            
            const pedidosData = await pedidosRes.json();
            
            if (pedidosData.data && Array.isArray(pedidosData.data)) {
                todosLosPedidos = todosLosPedidos.concat(pedidosData.data);
            }
            
            // Guardar los items incluidos
            if (pedidosData.included && Array.isArray(pedidosData.included)) {
                todosLosIncluded = todosLosIncluded.concat(pedidosData.included);
            }
            
            // Verificar si hay más páginas
            if (!pedidosData.data || pedidosData.data.length < 500) {
                hayMasPaginas = false;
            } else {
                pagina++;
            }
        }

        if (accion === 'consultar_pedidos') {
            return res.json({
                success: true,
                fecha: fechaFiltro,
                sede,
                totalPedidos: todosLosPedidos.length,
                totalItemsIncluded: todosLosIncluded.length,
                pedidos: todosLosPedidos.slice(0, 5), // Muestra solo 5 para ver estructura
                included: todosLosIncluded.slice(0, 20) // Muestra 20 items para ver estructura
            });
        }

        if (accion === 'traer_domicilios') {
            // Filtrar pedidos por fecha
            const pedidosFecha = todosLosPedidos.filter(pedido => {
                const fechaPedido = pedido.attributes?.date || 
                                    pedido.attributes?.createdAt?.split('T')[0] || '';
                return fechaPedido === fechaFiltro;
            });

            // Buscar items de domicilio en "included"
            const itemsDomicilio = todosLosIncluded.filter(item => {
                if (item.type !== 'items' && item.type !== 'saleItems' && item.type !== 'sale-items') {
                    return false;
                }
                const nombreItem = (item.attributes?.name || item.attributes?.productName || '').toLowerCase();
                return nombreItem.includes('domicilio');
            });

            // Crear mapa de items por pedido
            const domiciliosEncontrados = [];
            
            for (const pedido of pedidosFecha) {
                const pedidoId = pedido.id;
                const fechaPedido = pedido.attributes?.date || pedido.attributes?.createdAt?.split('T')[0] || '';
                const totalPedido = pedido.attributes?.total || pedido.attributes?.amount || 0;
                
                // Buscar items de domicilio relacionados con este pedido
                const itemsRelacionados = pedido.relationships?.items?.data || [];
                
                for (const itemRef of itemsRelacionados) {
                    const itemCompleto = todosLosIncluded.find(inc => 
                        inc.id === itemRef.id && (inc.type === itemRef.type || inc.type === 'items')
                    );
                    
                    if (itemCompleto) {
                        const nombreItem = (itemCompleto.attributes?.name || '').toLowerCase();
                        if (nombreItem.includes('domicilio')) {
                            domiciliosEncontrados.push({
                                pedidoId: pedidoId,
                                fecha: fechaPedido,
                                valorPedido: totalPedido,
                                itemId: itemCompleto.id,
                                nombreDomicilio: itemCompleto.attributes?.name || '',
                                precioDomicilio: itemCompleto.attributes?.price || itemCompleto.attributes?.unitPrice || 0,
                                cantidad: itemCompleto.attributes?.quantity || 1
                            });
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
                totalItemsIncluded: todosLosIncluded.length,
                domicilios: domiciliosEncontrados,
                // Debug: mostrar algunos items para verificar estructura
                _debug_items_muestra: todosLosIncluded.slice(0, 5)
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
