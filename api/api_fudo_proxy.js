// api_fudo_proxy.js - Para Vercel Serverless Functions
const FUDO_AUTH = 'https://auth.fu.do/api';
const FUDO_API = 'https://api.fu.do/v1alpha1';

// IDs de productos de domicilio
const PRODUCTOS_DOMICILIO = {
    '548': { nombre: 'Domicilio 0', precio: 0 },
    '516': { nombre: 'Domicilio 6', precio: 6000 },
    '544': { nombre: 'Domicilio 9', precio: 9000 },
    '545': { nombre: 'Domicilio 11', precio: 11000 },
    '546': { nombre: 'Domicilio 13', precio: 13000 },
    '547': { nombre: 'Domicilio 16', precio: 16000 },
    '745': { nombre: 'Domicilio 17', precio: 17000 },
    '746': { nombre: 'Domicilio 18', precio: 18000 }
};

const CREDENCIALES = {
    'CORALES': {
        apiKey: 'MUA0MzI4OA==',
        apiSecret: 'm77IGbUCfx1ndxSUTrmiIj5RrRc2Snlu'
    }
};

// Función para verificar si un pedido es de Rappi (para excluirlo)
function esDeRappi(pedido) {
    const customerName = (pedido.attributes?.customerName || '').toLowerCase();
    const comment = (pedido.attributes?.comment || '').toLowerCase();
    const anonName = (pedido.attributes?.anonymousCustomer?.name || '').toLowerCase();
    
    return customerName.includes('rappi') || 
           comment.includes('rappi') || 
           anonName.includes('rappi') ||
           customerName.includes('online rappi');
}

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
            // Incluir items Y shippingCosts
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
                customerName: p.attributes?.customerName,
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
            // Filtrar pedidos por fecha y CLOSED, EXCLUYENDO RAPPI
            const pedidosFecha = todosLosPedidos.filter(p => {
                const fp = p.attributes?.createdAt?.split('T')[0] || '';
                const esFecha = fp === fechaFiltro;
                const esCerrado = p.attributes?.saleState === 'CLOSED';
                const noEsRappi = !esDeRappi(p);
                return esFecha && esCerrado && noEsRappi;
            });

            const domicilios = [];
            
            for (const pedido of pedidosFecha) {
                let valorDomicilio = 0;
                let tipoDomicilio = '';
                let origenDomicilio = ''; // 'producto' o 'costo_envio'
                let productId = null;
                
                // OPCIÓN 1: Buscar en productos de domicilio
                const itemsRef = pedido.relationships?.items?.data || [];
                for (const ref of itemsRef) {
                    const item = items.find(i => i.id === ref.id);
                    if (!item) continue;
                    
                    const pid = item.relationships?.product?.data?.id;
                    
                    if (pid && PRODUCTOS_DOMICILIO[pid]) {
                        valorDomicilio = item.attributes?.price || PRODUCTOS_DOMICILIO[pid].precio;
                        tipoDomicilio = PRODUCTOS_DOMICILIO[pid].nombre;
                        origenDomicilio = 'producto';
                        productId = pid;
                        break;
                    }
                }
                
                // OPCIÓN 2: Si no encontró producto, buscar en shippingCosts (Costo de envío)
                if (!valorDomicilio) {
                    const shippingRef = pedido.relationships?.shippingCosts?.data || [];
                    for (const ref of shippingRef) {
                        const shipping = shippingCosts.find(s => s.id === ref.id);
                        if (shipping) {
                            valorDomicilio = shipping.attributes?.amount || shipping.attributes?.price || 0;
                            tipoDomicilio = 'Costo de envío';
                            origenDomicilio = 'costo_envio';
                            break;
                        }
                    }
                }
                
                // Solo agregar si tiene domicilio
                if (valorDomicilio > 0 || origenDomicilio) {
                    domicilios.push({
                        pedidoId: pedido.id,
                        fecha: pedido.attributes?.createdAt?.split('T')[0] || '',
                        hora: pedido.attributes?.createdAt?.split('T')[1]?.substring(0,5) || '',
                        valorPedido: pedido.attributes?.total || 0,
                        valorDomicilio: valorDomicilio,
                        tipoDomicilio: tipoDomicilio,
                        origenDomicilio: origenDomicilio,
                        productId: productId,
                        saleType: pedido.attributes?.saleType,
                        customerName: pedido.attributes?.customerName || ''
                    });
                }
            }

            // Contar excluidos por Rappi
            const pedidosRappi = todosLosPedidos.filter(p => {
                const fp = p.attributes?.createdAt?.split('T')[0] || '';
                return fp === fechaFiltro && p.attributes?.saleState === 'CLOSED' && esDeRappi(p);
            }).length;

            return res.json({
                success: true,
                fechaBuscada: fechaFiltro,
                sede,
                totalPedidosCerrados: pedidosFecha.length,
                totalDomicilios: domicilios.length,
                pedidosRappiExcluidos: pedidosRappi,
                domicilios,
                _debug: {
                    paginasConsultadas: pagina - 1,
                    productIdsBuscados: Object.keys(PRODUCTOS_DOMICILIO)
                }
            });
        }

        return res.status(400).json({ success: false, error: 'Acción no válida' });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
