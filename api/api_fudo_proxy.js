if (accion === 'traer_transferencias') {
    // Necesitamos consultar con payments incluidos
    let pedidosConPagos = [];
    let pagosIncluidos = [];
    
    let pag = 1;
    let seguir = true;
    
    while (pag <= 30 && seguir) {
        const url = `${FUDO_API}/sales?page[size]=500&page[number]=${pag}&include=payments&sort=-createdAt`;
        
        const pedidosRes = await fetch(url, {
            headers: { 'Authorization': `Bearer ${tokenData.token}` }
        });
        const pedidosData = await pedidosRes.json();
        
        if (pedidosData.data && pedidosData.data.length > 0) {
            pedidosConPagos = pedidosConPagos.concat(pedidosData.data);
            
            if (pedidosData.included) {
                pagosIncluidos = pagosIncluidos.concat(pedidosData.included);
            }
            
            const ultimaFecha = pedidosData.data[pedidosData.data.length - 1]?.attributes?.createdAt?.split('T')[0] || '';
            if (ultimaFecha && ultimaFecha < fechaFiltro) seguir = false;
        } else {
            seguir = false;
        }
        
        pag++;
    }

    // Filtrar solo payments
    const payments = pagosIncluidos.filter(i => i.type === 'Payment');

    // Filtrar pedidos por fecha y CLOSED, EXCLUYENDO RAPPI
    const pedidosFecha = pedidosConPagos.filter(p => {
        const fp = p.attributes?.createdAt?.split('T')[0] || '';
        const esFecha = fp === fechaFiltro;
        const esCerrado = p.attributes?.saleState === 'CLOSED';
        const noEsRappi = !esDeRappi(p);
        return esFecha && esCerrado && noEsRappi;
    });

    const transferencias = [];
    
    // Mapeo de métodos de pago a bancos
    const METODOS_TRANSFERENCIA = {
        'BANCOLOMBIA': 'Bancolombia',
        'DAVIVIENDA': 'Davivienda', 
        'DAVIPLATA': 'Daviplata',
        'NEQUI': 'Nequi',
        'TRANSFERENCIA': 'Transferencia',
        'TRANSFER': 'Transferencia',
        'BANK_TRANSFER': 'Transferencia'
    };
    
    for (const pedido of pedidosFecha) {
        const paymentsRef = pedido.relationships?.payments?.data || [];
        
        for (const ref of paymentsRef) {
            const payment = payments.find(p => p.id === ref.id);
            if (!payment) continue;
            
            const metodo = (payment.attributes?.paymentMethod || payment.attributes?.method || '').toUpperCase();
            const nombre = payment.attributes?.name || payment.attributes?.paymentMethodName || metodo;
            
            // Verificar si es una transferencia (no efectivo, no datáfono)
            const esEfectivo = metodo.includes('CASH') || metodo.includes('EFECTIVO');
            const esDatafono = metodo.includes('CARD') || metodo.includes('TARJETA') || metodo.includes('DATAFONO') || metodo.includes('POS');
            
            if (!esEfectivo && !esDatafono) {
                // Es transferencia o pago digital
                let banco = 'Otro';
                
                // Detectar banco por nombre del método
                for (const [clave, valor] of Object.entries(METODOS_TRANSFERENCIA)) {
                    if (metodo.includes(clave) || nombre.toUpperCase().includes(clave)) {
                        banco = valor;
                        break;
                    }
                }
                
                transferencias.push({
                    pedidoId: pedido.id,
                    fecha: pedido.attributes?.createdAt?.split('T')[0] || '',
                    hora: pedido.attributes?.createdAt?.split('T')[1]?.substring(0,5) || '',
                    banco: banco,
                    metodoOriginal: nombre || metodo,
                    valor: payment.attributes?.amount || payment.attributes?.total || 0,
                    valorPedido: pedido.attributes?.total || 0,
                    customerName: pedido.attributes?.customerName || ''
                });
            }
        }
    }

    // Contar excluidos por Rappi
    const pedidosRappi = pedidosConPagos.filter(p => {
        const fp = p.attributes?.createdAt?.split('T')[0] || '';
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
            metodosEncontrados: [...new Set(payments.map(p => p.attributes?.paymentMethod || p.attributes?.method || 'sin_metodo'))]
        }
    });
}
