// API Route para enviar SMS via Twilio
// Se despliega automáticamente en Vercel como /api/enviar-sms

export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Credenciales de Twilio desde variables de entorno
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error('Faltan credenciales de Twilio en variables de entorno');
    return res.status(500).json({ error: 'Configuración de Twilio incompleta' });
  }

  const { telefono, mensaje } = req.body;

  if (!telefono || !mensaje) {
    return res.status(400).json({ error: 'Faltan parámetros: telefono y mensaje son requeridos' });
  }

  // Formatear número de teléfono (asegurar formato E.164)
  let numeroFormateado = telefono.toString().replace(/\D/g, '');
  
  // Si es número colombiano sin código de país, agregarlo
  if (numeroFormateado.length === 10 && numeroFormateado.startsWith('3')) {
    numeroFormateado = '57' + numeroFormateado;
  }
  
  // Asegurar que tenga el +
  if (!numeroFormateado.startsWith('+')) {
    numeroFormateado = '+' + numeroFormateado;
  }

  try {
    // Usar API de Twilio directamente con fetch (sin SDK)
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    // Usar Account SID + Auth Token para autenticación
    const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: numeroFormateado,
        From: TWILIO_PHONE_NUMBER,
        Body: mensaje,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error de Twilio:', data);
      return res.status(response.status).json({ 
        error: 'Error al enviar SMS', 
        detalle: data.message || data.error_message || 'Error desconocido'
      });
    }

    return res.status(200).json({ 
      ok: true, 
      sid: data.sid,
      mensaje: 'SMS enviado correctamente'
    });

  } catch (error) {
    console.error('Error enviando SMS:', error);
    return res.status(500).json({ 
      error: 'Error interno al enviar SMS',
      detalle: error.message
    });
  }
}
