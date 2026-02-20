
// API Route para enviar SMS via Onurix
// Se despliega automáticamente en Vercel como /api/enviar-sms

export default async function handler(req, res) {
  // Configurar CORS para permitir peticiones desde el panel de administración
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Credenciales de Onurix desde variables de entorno
  const ONURIX_CLIENT = process.env.ONURIX_CLIENT;
  const ONURIX_KEY = process.env.ONURIX_KEY;

  if (!ONURIX_CLIENT || !ONURIX_KEY) {
    console.error('Faltan credenciales de Onurix en variables de entorno');
    return res.status(500).json({ error: 'Configuración de Onurix incompleta' });
  }

  const { telefono, mensaje } = req.body;

  if (!telefono || !mensaje) {
    return res.status(400).json({ error: 'Faltan parámetros: telefono y mensaje son requeridos' });
  }

  // Formatear número de teléfono para Onurix (sin + pero con código de país)
  let numeroFormateado = telefono.toString().replace(/\D/g, '');
  
  // Si es número colombiano sin código de país, agregarlo
  if (numeroFormateado.length === 10 && numeroFormateado.startsWith('3')) {
    numeroFormateado = '57' + numeroFormateado;
  }
  
  // Onurix NO usa el + al inicio, solo los dígitos con código de país
  if (numeroFormateado.startsWith('+')) {
    numeroFormateado = numeroFormateado.substring(1);
  }

  try {
    // Usar API de Onurix
    const url = `https://www.onurix.com/api/v1/sms/send?client=${ONURIX_CLIENT}&key=${ONURIX_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: numeroFormateado,
        sms: mensaje
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('Error de Onurix:', data);
      return res.status(response.status || 400).json({ 
        error: 'Error al enviar SMS', 
        detalle: data.message || data.error || 'Error desconocido'
      });
    }

    return res.status(200).json({ 
      ok: true, 
      sid: data.id || data.messageId || 'enviado',
      mensaje: 'SMS enviado correctamente',
      detalle: data
    });

  } catch (error) {
    console.error('Error enviando SMS:', error);
    return res.status(500).json({ 
      error: 'Error interno al enviar SMS',
      detalle: error.message
    });
  }
}
