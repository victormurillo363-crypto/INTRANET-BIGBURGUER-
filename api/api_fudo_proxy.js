// api_fudo_proxy.js - Para Vercel Serverless Functions
const FUDO_AUTH = 'https://auth.fu.do/api';
const FUDO_API = 'https://api.fu.do/v1alpha1';

// 🕐 CONSTANTE: Colombia está en UTC-5 (no tiene horario de verano)
const OFFSET_COLOMBIA_MS = 5 * 60 * 60 * 1000; // 5 horas en milisegundos

// 🕐 Función para convertir fecha UTC a fecha Colombia (UTC-5)
// FUDO devuelve fechas en UTC, pero Colombia está en UTC-5
// Ejemplo: Pedido 11:30PM Colombia = 2026-05-03T04:30:00Z en FUDO
// Sin conversión, ese pedido del 2 de mayo aparecería como del 3 de mayo
function fechaUTCaColombia(fechaISO) {
    if (!fechaISO) return '';
    try {
        // Parsear la fecha ISO
        const fechaUTC = new Date(fechaISO);
        // Restar 5 horas usando milisegundos (más seguro que setHours)
        const fechaColombia = new Date(fechaUTC.getTime() - OFFSET_COLOMBIA_MS);
        // Extraer año, mes, día del objeto Date
        const year = fechaColombia.getUTCFullYear();
        const month = String(fechaColombia.getUTCMonth() + 1).padStart(2, '0');
        const day = String(fechaColombia.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error('Error convirtiendo fecha:', fechaISO, e);
        return fechaISO.split('T')[0] || '';
    }
}

// Función para obtener hora en Colombia
function horaUTCaColombia(fechaISO) {
    if (!fechaISO) return '';
    try {
        const fechaUTC = new Date(fechaISO);
        const fechaColombia = new Date(fechaUTC.getTime() - OFFSET_COLOMBIA_MS);
        const hours = String(fechaColombia.getUTCHours()).padStart(2, '0');
        const minutes = String(fechaColombia.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) {
        return fechaISO.split('T')[1]?.substring(0, 5) || '';
    }
}

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
                
                const ultimaFecha = fechaUTCaColombia(pedidosData.data[pedidosData.data.length - 1]?.attributes?.createdAt);
                if (ultimaFecha && ultimaFecha < fechaFiltro) continuar = false;
            } else {
                continuar = false;
            }
            
            pagina++;
        }

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
            // Estados válidos para domicilios (excluye Rappi)
            const ESTADOS_DOMICILIO_VALIDOS = ['CLOSED', 'IN_PROGRESS', 'IN-COURSE', 'DELIVERY-SENT'];
            
            const pedidosFecha = todosLosPedidos.filter(p => {
                // 🔐 IMPORTANTE: Convertir UTC a Colombia antes de comparar
                const fp = fechaUTCaColombia(p.attributes?.createdAt);
                const esFecha = fp === fechaFiltro;
                // ✅ DOMICILIOS: Traer CERRADOS, EN PROCESO, EN CURSO y ENVIADOS
                const estado = p.attributes?.saleState;
                const esEstadoValido = ESTADOS_DOMICILIO_VALIDOS.includes(estado);
                const noEsRappi = !esDeRappi(p);
                return esFecha && esEstadoValido && noEsRappi;
            });

            const domicilios = [];
            
            for (const pedido of pedidosFecha) {
                let valorDomicilio = 0;
                let tipoDomicilio = '';
                let origenDomicilio = '';
                let productId = null;
                
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
                
                if (valorDomicilio > 0 || origenDomicilio) {
                    domicilios.push({
                        pedidoId: pedido.id,
                        fecha: fechaUTCaColombia(pedido.attributes?.createdAt),
                        hora: horaUTCaColombia(pedido.attributes?.createdAt),
                        fechaOriginalUTC: pedido.attributes?.createdAt, // Para verificación en cliente
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

            const pedidosRappi = todosLosPedidos.filter(p => {
                const fp = fechaUTCaColombia(p.attributes?.createdAt);
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

        if (accion === 'traer_transferencias') {
            let pedidosConPagos = [];
            let pagosIncluidos = [];
            
            let pag = 1;
            let seguir = true;
            
            while (pag <= 30 && seguir) {
                // Incluir payments Y paymentMethod
                const url = `${FUDO_API}/sales?page[size]=500&page[number]=${pag}&include=payments,payments.paymentMethod&sort=-createdAt`;
                
                const pedidosRes = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${tokenData.token}` }
                });
                const pedidosData = await pedidosRes.json();
                
                if (pedidosData.data && pedidosData.data.length > 0) {
                    pedidosConPagos = pedidosConPagos.concat(pedidosData.data);
                    
                    if (pedidosData.included) {
                        pagosIncluidos = pagosIncluidos.concat(pedidosData.included);
                    }
                    
                    const ultimaFecha = fechaUTCaColombia(pedidosData.data[pedidosData.data.length - 1]?.attributes?.createdAt);
                    if (ultimaFecha && ultimaFecha < fechaFiltro) seguir = false;
                } else {
                    seguir = false;
                }
                
                pag++;
            }

            const payments = pagosIncluidos.filter(i => i.type === 'Payment');
            const paymentMethods = pagosIncluidos.filter(i => i.type === 'PaymentMethod');

            const pedidosFecha = pedidosConPagos.filter(p => {
                // 🔐 IMPORTANTE: Convertir UTC a Colombia antes de comparar
                const fp = fechaUTCaColombia(p.attributes?.createdAt);
                const esFecha = fp === fechaFiltro;
                const esCerrado = p.attributes?.saleState === 'CLOSED';
                const noEsRappi = !esDeRappi(p);
                return esFecha && esCerrado && noEsRappi;
            });

            const transferencias = [];
            
            // Mapeo de IDs de métodos de pago a bancos
            const METODOS_POR_ID = {
                '7': 'Bancolombia',
                '10': 'Daviplata',
                '11': 'Davivienda'
            };
            
            // IDs que son transferencias (no efectivo, no datáfono)
            const IDS_TRANSFERENCIAS = ['7', '10', '11'];
            
            for (const pedido of pedidosFecha) {
                const paymentsRef = pedido.relationships?.payments?.data || [];
                
                for (const ref of paymentsRef) {
                    const payment = payments.find(p => p.id === ref.id);
                    if (!payment) continue;
                    
                    // 🚫 IMPORTANTE: Ignorar pagos cancelados (cuando cambian método de pago)
                    if (payment.attributes?.canceled === true) continue;
                    
                    // Obtener el ID del método de pago
                    const paymentMethodId = payment.relationships?.paymentMethod?.data?.id;
                    
                    // Solo incluir si es una transferencia conocida
                    if (paymentMethodId && IDS_TRANSFERENCIAS.includes(paymentMethodId)) {
                        const banco = METODOS_POR_ID[paymentMethodId] || 'Otro';
                        
                        transferencias.push({
                            pedidoId: pedido.id,
                            fecha: fechaUTCaColombia(pedido.attributes?.createdAt),
                            hora: horaUTCaColombia(pedido.attributes?.createdAt),
                            fechaOriginalUTC: pedido.attributes?.createdAt, // Para verificación en cliente
                            banco: banco,
                            paymentMethodId: paymentMethodId,
                            valor: payment.attributes?.amount || 0,
                            valorPedido: pedido.attributes?.total || 0,
                            customerName: pedido.attributes?.customerName || ''
                        });
                    }
                }
            }

            const pedidosRappi = pedidosConPagos.filter(p => {
                const fp = fechaUTCaColombia(p.attributes?.createdAt);
                return fp === fechaFiltro && p.attributes?.saleState === 'CLOSED' && esDeRappi(p);
            }).length;

            return res.json({
                success: true,
                fechaBuscada: fechaFiltro,
                sede,
                totalPedidosCerrados: pedidosFecha.length,
                totalTransferencias: transferencias.length,
                pedidosRappiExcluidos: pedidosRappi,
                transferencias,
                _debug: {
                    paginasConsultadas: pag - 1,
                    totalPayments: payments.length,
                    totalPaymentMethods: paymentMethods.length,
                    metodosUsados: [...new Set(transferencias.map(t => t.banco))]
                }
            });
        }

        // 💰 TRAER TOTALES DE VENTAS (Efectivo y Online Rappi)
        if (accion === 'traer_totales_ventas') {
            let pedidosConPagos = [];
            let pagosIncluidos = [];
            
            let pag = 1;
            let seguir = true;
            
            while (pag <= 30 && seguir) {
                const url = `${FUDO_API}/sales?page[size]=500&page[number]=${pag}&include=payments,payments.paymentMethod&sort=-createdAt`;
                
                const pedidosRes = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${tokenData.token}` }
                });
                const pedidosData = await pedidosRes.json();
                
                if (pedidosData.data && pedidosData.data.length > 0) {
                    pedidosConPagos = pedidosConPagos.concat(pedidosData.data);
                    
                    if (pedidosData.included) {
                        pagosIncluidos = pagosIncluidos.concat(pedidosData.included);
                    }
                    
                    const ultimaFecha = fechaUTCaColombia(pedidosData.data[pedidosData.data.length - 1]?.attributes?.createdAt);
                    if (ultimaFecha && ultimaFecha < fechaFiltro) seguir = false;
                } else {
                    seguir = false;
                }
                
                pag++;
            }

            const payments = pagosIncluidos.filter(i => i.type === 'Payment');

            // Filtrar solo pedidos de la fecha (en hora Colombia) y CERRADOS
            const pedidosFecha = pedidosConPagos.filter(p => {
                const fp = fechaUTCaColombia(p.attributes?.createdAt);
                const esFecha = fp === fechaFiltro;
                const esCerrado = p.attributes?.saleState === 'CLOSED';
                return esFecha && esCerrado;
            });

            // IDs de métodos de pago
            const ID_EFECTIVO = '1';
            const ID_ONLINE_RAPPI = '12';
            const ID_DATAFONO = '4';
            
            let totalEfectivo = 0;
            let totalOnlineRappi = 0;
            let totalDatafono = 0;
            let pedidosEfectivo = 0;
            let pedidosRappi = 0;
            let pedidosDatafono = 0;

            for (const pedido of pedidosFecha) {
                const paymentsRef = pedido.relationships?.payments?.data || [];
                
                for (const ref of paymentsRef) {
                    const payment = payments.find(p => p.id === ref.id);
                    if (!payment) continue;
                    
                    // 🚫 IMPORTANTE: Ignorar pagos cancelados (cuando cambian método de pago)
                    if (payment.attributes?.canceled === true) continue;
                    
                    const paymentMethodId = payment.relationships?.paymentMethod?.data?.id;
                    const monto = payment.attributes?.amount || 0;
                    
                    if (paymentMethodId === ID_EFECTIVO) {
                        totalEfectivo += monto;
                        pedidosEfectivo++;
                    } else if (paymentMethodId === ID_ONLINE_RAPPI) {
                        totalOnlineRappi += monto;
                        pedidosRappi++;
                    } else if (paymentMethodId === ID_DATAFONO) {
                        totalDatafono += monto;
                        pedidosDatafono++;
                    }
                }
            }

            return res.json({
                success: true,
                fechaBuscada: fechaFiltro,
                fechaHoraColombia: `${fechaUTCaColombia(new Date().toISOString())} ${horaUTCaColombia(new Date().toISOString())}`,
                sede,
                totalPedidosCerrados: pedidosFecha.length,
                totales: {
                    efectivo: totalEfectivo,
                    onlineRappi: totalOnlineRappi,
                    datafono: totalDatafono
                },
                detalles: {
                    pagosEfectivo: pedidosEfectivo,
                    pagosOnlineRappi: pedidosRappi,
                    pagosDatafono: pedidosDatafono
                },
                _debug: {
                    paginasConsultadas: pag - 1,
                    totalPayments: payments.length
                }
            });
        }

        if (accion === 'debug_payments') {
            // Consultar con payments Y paymentMethods incluidos
            const url = `${FUDO_API}/sales?page[size]=10&page[number]=1&include=payments,payments.paymentMethod&sort=-createdAt`;
            
            const pedidosRes = await fetch(url, {
                headers: { 'Authorization': `Bearer ${tokenData.token}` }
            });
            const pedidosData = await pedidosRes.json();
            
            const payments = (pedidosData.included || []).filter(i => i.type === 'Payment');
            const paymentMethods = (pedidosData.included || []).filter(i => i.type === 'PaymentMethod');
            
            return res.json({
                success: true,
                mensaje: 'Debug de estructura de payments',
                totalPayments: payments.length,
                totalPaymentMethods: paymentMethods.length,
                // Mostrar estructura COMPLETA de payments para encontrar campo de estado
                paymentsCompletos: payments.slice(0, 10).map(p => ({
                    id: p.id,
                    type: p.type,
                    attributes: p.attributes, // TODOS los atributos
                    relationships: p.relationships
                })),
                paymentMethods: paymentMethods,
                primerPedido: pedidosData.data?.[0] || null
            });
        }

        // 🔍 DEBUG: Ver detalle de pagos por datáfono para verificar diferencias
        if (accion === 'debug_datafono') {
            let pedidosConPagos = [];
            let pagosIncluidos = [];
            
            let pag = 1;
            let seguir = true;
            
            while (pag <= 30 && seguir) {
                const url = `${FUDO_API}/sales?page[size]=500&page[number]=${pag}&include=payments,payments.paymentMethod&sort=-createdAt`;
                
                const pedidosRes = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${tokenData.token}` }
                });
                const pedidosData = await pedidosRes.json();
                
                if (pedidosData.data && pedidosData.data.length > 0) {
                    pedidosConPagos = pedidosConPagos.concat(pedidosData.data);
                    
                    if (pedidosData.included) {
                        pagosIncluidos = pagosIncluidos.concat(pedidosData.included);
                    }
                    
                    const ultimaFecha = fechaUTCaColombia(pedidosData.data[pedidosData.data.length - 1]?.attributes?.createdAt);
                    if (ultimaFecha && ultimaFecha < fechaFiltro) seguir = false;
                } else {
                    seguir = false;
                }
                
                pag++;
            }

            const payments = pagosIncluidos.filter(i => i.type === 'Payment');
            const ID_DATAFONO = '4';

            // Filtrar solo pedidos de la fecha y CERRADOS
            const pedidosFecha = pedidosConPagos.filter(p => {
                const fp = fechaUTCaColombia(p.attributes?.createdAt);
                const esFecha = fp === fechaFiltro;
                const esCerrado = p.attributes?.saleState === 'CLOSED';
                return esFecha && esCerrado;
            });

            const pagosDatafono = [];
            let totalDatafono = 0;

            for (const pedido of pedidosFecha) {
                const paymentsRef = pedido.relationships?.payments?.data || [];
                
                for (const ref of paymentsRef) {
                    const payment = payments.find(p => p.id === ref.id);
                    if (!payment) continue;
                    
                    // 🚫 IMPORTANTE: Ignorar pagos cancelados (cuando cambian método de pago)
                    if (payment.attributes?.canceled === true) continue;
                    
                    const paymentMethodId = payment.relationships?.paymentMethod?.data?.id;
                    const monto = payment.attributes?.amount || 0;
                    
                    if (paymentMethodId === ID_DATAFONO) {
                        totalDatafono += monto;
                        pagosDatafono.push({
                            pedidoId: pedido.id,
                            fechaUTC: pedido.attributes?.createdAt,
                            fechaColombia: fechaUTCaColombia(pedido.attributes?.createdAt),
                            horaColombia: horaUTCaColombia(pedido.attributes?.createdAt),
                            estado: pedido.attributes?.saleState,
                            cliente: pedido.attributes?.customerName || 'Sin nombre',
                            totalPedido: pedido.attributes?.total || 0,
                            montoDatafono: monto,
                            paymentId: payment.id
                        });
                    }
                }
            }

            // Ordenar por hora
            pagosDatafono.sort((a, b) => a.horaColombia.localeCompare(b.horaColombia));

            return res.json({
                success: true,
                mensaje: 'Detalle de pagos con Datáfono',
                fechaBuscada: fechaFiltro,
                sede,
                totalPedidosCerrados: pedidosFecha.length,
                resumen: {
                    cantidadPagosDatafono: pagosDatafono.length,
                    totalDatafono: totalDatafono
                },
                pagosDatafono: pagosDatafono,
                _debug: {
                    paginasConsultadas: pag - 1,
                    idMetodoDatafono: ID_DATAFONO
                }
            });
        }

        // 🔍 DEBUG: Ver todos los pedidos de domicilio y por qué algunos no se incluyen
        if (accion === 'debug_domicilios') {
            // Estados válidos para domicilios (excluye Rappi)
            const ESTADOS_DOMICILIO_VALIDOS = ['CLOSED', 'IN_PROGRESS', 'IN-COURSE', 'DELIVERY-SENT'];
            
            // Todos los pedidos tipo DELIVERY de la fecha
            const pedidosFecha = todosLosPedidos.filter(p => {
                const fp = fechaUTCaColombia(p.attributes?.createdAt);
                return fp === fechaFiltro;
            });

            const analisis = [];
            
            for (const pedido of pedidosFecha) {
                const estado = pedido.attributes?.saleState;
                const saleType = pedido.attributes?.saleType;
                const esRappi = esDeRappi(pedido);
                const esEstadoValido = ESTADOS_DOMICILIO_VALIDOS.includes(estado);
                
                // Buscar producto de domicilio
                let valorDomicilio = 0;
                let tipoDomicilio = '';
                let origenDomicilio = '';
                let productId = null;
                let productosEncontrados = [];
                
                const itemsRef = pedido.relationships?.items?.data || [];
                for (const ref of itemsRef) {
                    const item = items.find(i => i.id === ref.id);
                    if (!item) continue;
                    
                    const pid = item.relationships?.product?.data?.id;
                    productosEncontrados.push(pid);
                    
                    if (pid && PRODUCTOS_DOMICILIO[pid]) {
                        valorDomicilio = item.attributes?.price || PRODUCTOS_DOMICILIO[pid].precio;
                        tipoDomicilio = PRODUCTOS_DOMICILIO[pid].nombre;
                        origenDomicilio = 'producto';
                        productId = pid;
                    }
                }
                
                // Buscar costo de envío
                let shippingValue = 0;
                const shippingRef = pedido.relationships?.shippingCosts?.data || [];
                for (const ref of shippingRef) {
                    const shipping = shippingCosts.find(s => s.id === ref.id);
                    if (shipping) {
                        shippingValue = shipping.attributes?.amount || shipping.attributes?.price || 0;
                        if (!valorDomicilio) {
                            valorDomicilio = shippingValue;
                            tipoDomicilio = 'Costo de envío';
                            origenDomicilio = 'costo_envio';
                        }
                    }
                }
                
                // Determinar si se incluye y por qué no
                let seIncluye = true;
                let razonExclusion = '';
                
                if (!esEstadoValido) {
                    seIncluye = false;
                    razonExclusion = `Estado no válido: ${estado}`;
                } else if (esRappi) {
                    seIncluye = false;
                    razonExclusion = 'Es pedido de Rappi';
                } else if (valorDomicilio === 0 && !origenDomicilio) {
                    seIncluye = false;
                    razonExclusion = 'Sin producto domicilio ni costo envío';
                }
                
                analisis.push({
                    pedidoId: pedido.id,
                    hora: horaUTCaColombia(pedido.attributes?.createdAt),
                    estado: estado,
                    saleType: saleType,
                    customerName: pedido.attributes?.customerName || 'Sin nombre',
                    total: pedido.attributes?.total || 0,
                    esRappi: esRappi,
                    valorDomicilio: valorDomicilio,
                    tipoDomicilio: tipoDomicilio,
                    origenDomicilio: origenDomicilio,
                    shippingValue: shippingValue,
                    productIds: productosEncontrados,
                    seIncluye: seIncluye,
                    razonExclusion: razonExclusion
                });
            }
            
            // Ordenar por hora
            analisis.sort((a, b) => a.hora.localeCompare(b.hora));
            
            const incluidos = analisis.filter(a => a.seIncluye);
            const excluidos = analisis.filter(a => !a.seIncluye);
            
            return res.json({
                success: true,
                mensaje: 'Análisis de domicilios',
                fechaBuscada: fechaFiltro,
                sede,
                resumen: {
                    totalPedidosFecha: analisis.length,
                    incluidos: incluidos.length,
                    excluidos: excluidos.length
                },
                productosReconocidos: Object.keys(PRODUCTOS_DOMICILIO),
                pedidosIncluidos: incluidos,
                pedidosExcluidos: excluidos,
                _debug: {
                    paginasConsultadas: pagina - 1,
                    totalItems: items.length,
                    totalShippingCosts: shippingCosts.length
                }
            });
        }

        // 🔍 DEBUG: Verificar conversión de fechas UTC a Colombia
        if (accion === 'debug_fechas') {
            const url = `${FUDO_API}/sales?page[size]=20&page[number]=1&sort=-createdAt`;
            
            const pedidosRes = await fetch(url, {
                headers: { 'Authorization': `Bearer ${tokenData.token}` }
            });
            const pedidosData = await pedidosRes.json();
            
            const pedidosConFechas = (pedidosData.data || []).map(p => {
                const fechaUTC = p.attributes?.createdAt || '';
                const fechaColombia = fechaUTCaColombia(fechaUTC);
                const horaColombia = horaUTCaColombia(fechaUTC);
                return {
                    pedidoId: p.id,
                    fechaUTC_original: fechaUTC,
                    fechaColombia_convertida: fechaColombia,
                    horaColombia: horaColombia,
                    coincideConFiltro: fechaColombia === fechaFiltro,
                    saleState: p.attributes?.saleState,
                    customerName: p.attributes?.customerName
                };
            });
            
            // Hora actual del servidor
            const ahoraUTC = new Date().toISOString();
            const ahoraColombia = fechaUTCaColombia(ahoraUTC);
            const horaColombiaNow = horaUTCaColombia(ahoraUTC);
            
            return res.json({
                success: true,
                mensaje: 'Debug de conversión de fechas UTC → Colombia',
                fechaBuscada: fechaFiltro,
                horaServidorUTC: ahoraUTC,
                fechaServidorColombia: ahoraColombia,
                horaServidorColombia: horaColombiaNow,
                offsetUsado: '-5 horas (UTC-5)',
                pedidos: pedidosConFechas,
                resumen: {
                    totalPedidos: pedidosConFechas.length,
                    coincidentes: pedidosConFechas.filter(p => p.coincideConFiltro).length,
                    noCoincidentes: pedidosConFechas.filter(p => !p.coincideConFiltro).length
                }
            });
        }

        // 🔍 EXPLORAR: Buscar endpoints de resumen/reportes en FUDO
        if (accion === 'explorar_endpoints') {
            const endpointsAProbar = [
                '/reports',
                '/reports/sales',
                '/reports/daily',
                '/sales/summary',
                '/sales-summary',
                '/daily-summary',
                '/cash-registers',
                '/cash-register',
                '/closures',
                '/shifts',
                '/payment-methods',
                '/payment-summary',
                '/totals',
                '/statistics',
                '/dashboard'
            ];
            
            const resultados = [];
            
            for (const endpoint of endpointsAProbar) {
                try {
                    const url = `${FUDO_API}${endpoint}?page[size]=1`;
                    const respuesta = await fetch(url, {
                        headers: { 'Authorization': `Bearer ${tokenData.token}` }
                    });
                    const status = respuesta.status;
                    let data = null;
                    try {
                        data = await respuesta.json();
                    } catch (e) {
                        data = { error: 'No es JSON' };
                    }
                    
                    resultados.push({
                        endpoint,
                        status,
                        existe: status === 200,
                        tieneData: !!(data?.data),
                        campos: data?.data?.[0] ? Object.keys(data.data[0]) : [],
                        atributos: data?.data?.[0]?.attributes ? Object.keys(data.data[0].attributes) : [],
                        muestra: data?.data?.[0] || data?.errors?.[0] || null
                    });
                } catch (e) {
                    resultados.push({
                        endpoint,
                        status: 'error',
                        error: e.message
                    });
                }
            }
            
            return res.json({
                success: true,
                mensaje: 'Exploración de endpoints FUDO',
                endpointsEncontrados: resultados.filter(r => r.existe).map(r => r.endpoint),
                detalles: resultados
            });
        }

        // 🔍 EXPLORAR: Ver estructura de un pedido cerrado con todos sus pagos
        if (accion === 'explorar_pagos') {
            // Obtener algunos pedidos cerrados con sus pagos
            const url = `${FUDO_API}/sales?page[size]=20&page[number]=1&include=payments,payments.paymentMethod&sort=-createdAt`;
            
            const respuesta = await fetch(url, {
                headers: { 'Authorization': `Bearer ${tokenData.token}` }
            });
            const data = await respuesta.json();
            
            const payments = (data.included || []).filter(i => i.type === 'Payment');
            const paymentMethods = (data.included || []).filter(i => i.type === 'PaymentMethod');
            
            // Agrupar pagos por método
            const pagosPorMetodo = {};
            for (const pm of paymentMethods) {
                pagosPorMetodo[pm.id] = {
                    id: pm.id,
                    nombre: pm.attributes?.name || 'Sin nombre',
                    atributos: pm.attributes,
                    totalPagos: 0,
                    sumaMonto: 0
                };
            }
            
            for (const pago of payments) {
                const metodoId = pago.relationships?.paymentMethod?.data?.id;
                if (metodoId && pagosPorMetodo[metodoId]) {
                    pagosPorMetodo[metodoId].totalPagos++;
                    pagosPorMetodo[metodoId].sumaMonto += pago.attributes?.amount || 0;
                }
            }
            
            // Buscar pedidos Rappi
            const pedidosRappi = (data.data || []).filter(p => {
                const nombre = (p.attributes?.customerName || '').toLowerCase();
                const comment = (p.attributes?.comment || '').toLowerCase();
                return nombre.includes('rappi') || comment.includes('rappi');
            });
            
            return res.json({
                success: true,
                mensaje: 'Exploración de métodos de pago',
                totalPedidos: (data.data || []).length,
                totalPayments: payments.length,
                metodosEncontrados: Object.values(pagosPorMetodo),
                pedidosRappiEncontrados: pedidosRappi.length,
                muestraRappi: pedidosRappi.slice(0, 3).map(p => ({
                    id: p.id,
                    customerName: p.attributes?.customerName,
                    total: p.attributes?.total,
                    comment: p.attributes?.comment
                })),
                // Mostrar todos los IDs de métodos de pago únicos
                idsMetodosPago: [...new Set(payments.map(p => p.relationships?.paymentMethod?.data?.id))],
                nombresMetodosPago: paymentMethods.map(pm => ({ id: pm.id, nombre: pm.attributes?.name }))
            });
        }

        // 🔍 DEBUG: Explorar pedidos cancelados, eliminados y productos eliminados
        if (accion === 'debug_cancelados') {
            let todosPedidos = [];
            let todosIncluded = [];
            
            let pag = 1;
            let seguir = true;
            
            // Traer pedidos con items incluidos
            while (pag <= 10 && seguir) {
                const url = `${FUDO_API}/sales?page[size]=500&page[number]=${pag}&include=items,payments,voidedItems&sort=-createdAt`;
                
                const pedidosRes = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${tokenData.token}` }
                });
                const pedidosData = await pedidosRes.json();
                
                if (pedidosData.data && pedidosData.data.length > 0) {
                    todosPedidos = todosPedidos.concat(pedidosData.data);
                    
                    if (pedidosData.included) {
                        todosIncluded = todosIncluded.concat(pedidosData.included);
                    }
                    
                    const ultimaFecha = fechaUTCaColombia(pedidosData.data[pedidosData.data.length - 1]?.attributes?.createdAt);
                    if (ultimaFecha && ultimaFecha < fechaFiltro) seguir = false;
                } else {
                    seguir = false;
                }
                
                pag++;
            }

            // Filtrar pedidos de la fecha
            const pedidosFecha = todosPedidos.filter(p => {
                const fp = fechaUTCaColombia(p.attributes?.createdAt);
                return fp === fechaFiltro;
            });

            // Buscar todos los estados únicos
            const estadosUnicos = [...new Set(pedidosFecha.map(p => p.attributes?.saleState))];
            
            // Buscar pedidos con estado diferente a CLOSED
            const pedidosNoCerrados = pedidosFecha.filter(p => p.attributes?.saleState !== 'CLOSED');
            
            // Buscar pedidos que tengan campos de cancelación/eliminación
            const pedidosConCancelacion = pedidosFecha.filter(p => 
                p.attributes?.canceled || 
                p.attributes?.cancelled ||
                p.attributes?.voided ||
                p.attributes?.deleted ||
                p.attributes?.removed
            );

            // Items y VoidedItems
            const items = todosIncluded.filter(i => i.type === 'Item');
            const voidedItems = todosIncluded.filter(i => i.type === 'VoidedItem');
            const payments = todosIncluded.filter(i => i.type === 'Payment');
            
            // Pagos cancelados
            const pagosCancelados = payments.filter(p => p.attributes?.canceled === true);

            // Estructura de un pedido para ver todos los campos disponibles
            const muestraPedido = pedidosFecha[0] || null;
            const muestraItem = items[0] || null;
            const muestraVoidedItem = voidedItems[0] || null;

            // Buscar relaciones de voidedItems en pedidos
            const pedidosConVoidedItems = pedidosFecha.filter(p => 
                p.relationships?.voidedItems?.data?.length > 0
            );

            return res.json({
                success: true,
                mensaje: 'Exploración de pedidos cancelados y productos eliminados',
                fechaBuscada: fechaFiltro,
                sede,
                resumen: {
                    totalPedidosFecha: pedidosFecha.length,
                    estadosEncontrados: estadosUnicos,
                    pedidosNoCerrados: pedidosNoCerrados.length,
                    pedidosConCamposCancelacion: pedidosConCancelacion.length,
                    pedidosConVoidedItems: pedidosConVoidedItems.length,
                    totalItems: items.length,
                    totalVoidedItems: voidedItems.length,
                    pagosCancelados: pagosCancelados.length
                },
                // Muestra de estructura completa de un pedido
                estructuraPedido: muestraPedido ? {
                    id: muestraPedido.id,
                    type: muestraPedido.type,
                    todosLosAtributos: muestraPedido.attributes,
                    todasLasRelaciones: Object.keys(muestraPedido.relationships || {})
                } : null,
                // Muestra de estructura de un Item
                estructuraItem: muestraItem ? {
                    id: muestraItem.id,
                    type: muestraItem.type,
                    todosLosAtributos: muestraItem.attributes,
                    todasLasRelaciones: Object.keys(muestraItem.relationships || {})
                } : null,
                // VoidedItems encontrados
                voidedItemsEncontrados: voidedItems.slice(0, 10).map(v => ({
                    id: v.id,
                    type: v.type,
                    atributos: v.attributes,
                    relaciones: v.relationships
                })),
                // Pedidos no cerrados (posibles cancelados)
                pedidosNoCerradosDetalle: pedidosNoCerrados.slice(0, 10).map(p => ({
                    id: p.id,
                    estado: p.attributes?.saleState,
                    fecha: fechaUTCaColombia(p.attributes?.createdAt),
                    hora: horaUTCaColombia(p.attributes?.createdAt),
                    total: p.attributes?.total,
                    cliente: p.attributes?.customerName,
                    todosAtributos: p.attributes
                })),
                // Pagos cancelados detalle
                pagosCanceladosDetalle: pagosCancelados.slice(0, 10).map(p => ({
                    id: p.id,
                    atributos: p.attributes
                })),
                // Pedidos con voidedItems
                pedidosConVoidedItemsDetalle: pedidosConVoidedItems.slice(0, 5).map(p => ({
                    pedidoId: p.id,
                    estado: p.attributes?.saleState,
                    total: p.attributes?.total,
                    voidedItemsIds: p.relationships?.voidedItems?.data?.map(v => v.id)
                })),
                _debug: {
                    paginasConsultadas: pag - 1,
                    tiposEnIncluded: [...new Set(todosIncluded.map(i => i.type))]
                }
            });
        }

        return res.status(400).json({ success: false, error: 'Acción no válida' });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
