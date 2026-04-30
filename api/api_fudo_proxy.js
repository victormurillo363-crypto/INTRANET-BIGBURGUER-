<?php
/**
 * PROXY PARA API DE FUDO
 * Archivo: api_fudo_proxy.php
 * Ubicación: https://intranetbigburguer.com/api/fudo-proxy.php
 * 
 * Este archivo actúa como intermediario entre tu aplicación React y la API de FUDO
 * para evitar problemas de CORS.
 */

// Permitir CORS desde tu dominio
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Manejar preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// URLs de la API de FUDO
define('FUDO_AUTH_URL', 'https://auth.fu.do/api');
define('FUDO_API_URL', 'https://api.fu.do/v1alpha1');

// Credenciales por sede (puedes agregar más)
$credenciales_por_sede = [
    'CORALES' => [
        'apiKey' => 'MUA0MzI4OA==',
        'apiSecret' => 'm77IGbUCfx1ndxSUTrmiIj5RrRc2Snlu'
    ],
    // Agregar más sedes aquí cuando tengas las credenciales
    // 'VILLA DEL PRADO' => [
    //     'apiKey' => 'xxx',
    //     'apiSecret' => 'xxx'
    // ],
    // 'AV SUR' => [
    //     'apiKey' => 'xxx',
    //     'apiSecret' => 'xxx'
    // ],
];

// Cache de tokens en memoria (en producción podrías usar Redis/Memcached)
$tokens_cache = [];

/**
 * Función para hacer peticiones HTTP
 */
function hacerPeticion($url, $method = 'GET', $headers = [], $body = null) {
    $ch = curl_init();
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($body) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
    }
    
    if (!empty($headers)) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    
    curl_close($ch);
    
    return [
        'success' => $httpCode >= 200 && $httpCode < 300,
        'httpCode' => $httpCode,
        'response' => $response,
        'error' => $error
    ];
}

/**
 * Obtener token de FUDO
 */
function obtenerToken($apiKey, $apiSecret) {
    $body = json_encode([
        'apiKey' => $apiKey,
        'apiSecret' => $apiSecret
    ]);
    
    $headers = [
        'Content-Type: application/json',
        'Accept: application/json'
    ];
    
    $resultado = hacerPeticion(FUDO_AUTH_URL, 'POST', $headers, $body);
    
    if ($resultado['success']) {
        $data = json_decode($resultado['response'], true);
        if (isset($data['token'])) {
            return [
                'success' => true,
                'token' => $data['token'],
                'exp' => $data['exp'] ?? null
            ];
        }
    }
    
    return [
        'success' => false,
        'error' => $resultado['error'] ?: 'Error obteniendo token',
        'httpCode' => $resultado['httpCode'],
        'response' => $resultado['response']
    ];
}

/**
 * Consultar pedidos de FUDO
 */
function consultarPedidos($token, $fecha = null, $pagina = 1, $limite = 500) {
    $url = FUDO_API_URL . "/sales?page[size]={$limite}&page[number]={$pagina}";
    
    // Intentar agregar filtro de fecha si está disponible
    if ($fecha) {
        $url .= "&filter[date]={$fecha}";
    }
    
    $headers = [
        'Authorization: Bearer ' . $token,
        'Accept: application/json'
    ];
    
    $resultado = hacerPeticion($url, 'GET', $headers);
    
    if ($resultado['success']) {
        $data = json_decode($resultado['response'], true);
        return [
            'success' => true,
            'data' => $data
        ];
    }
    
    return [
        'success' => false,
        'error' => $resultado['error'] ?: 'Error consultando pedidos',
        'httpCode' => $resultado['httpCode']
    ];
}

/**
 * Filtrar solo pedidos de domicilio
 */
function filtrarDomicilios($pedidos) {
    if (!is_array($pedidos)) {
        return [];
    }
    
    $domicilios = [];
    
    foreach ($pedidos as $pedido) {
        // Buscar en diferentes campos posibles el nombre/tipo del pedido
        $nombre = strtolower($pedido['name'] ?? $pedido['nombre'] ?? $pedido['orderName'] ?? $pedido['order_name'] ?? '');
        $tipo = strtolower($pedido['type'] ?? $pedido['tipo'] ?? $pedido['orderType'] ?? $pedido['order_type'] ?? '');
        
        // Verificar si es domicilio
        $esDomicilio = strpos($nombre, 'domicilio') !== false || 
                       strpos($tipo, 'delivery') !== false || 
                       strpos($tipo, 'domicilio') !== false;
        
        if ($esDomicilio) {
            $domicilios[] = [
                'id' => $pedido['id'] ?? $pedido['orderId'] ?? $pedido['order_id'] ?? null,
                'numero' => $pedido['name'] ?? $pedido['nombre'] ?? $pedido['orderName'] ?? $pedido['order_name'] ?? $pedido['number'] ?? '',
                'total' => $pedido['total'] ?? $pedido['amount'] ?? $pedido['totalAmount'] ?? $pedido['total_amount'] ?? 0,
                'estado' => $pedido['status'] ?? $pedido['estado'] ?? $pedido['state'] ?? '',
                'fecha' => $pedido['date'] ?? $pedido['fecha'] ?? $pedido['createdAt'] ?? $pedido['created_at'] ?? '',
                'hora' => $pedido['time'] ?? $pedido['hora'] ?? '',
                'formaPago' => $pedido['paymentMethod'] ?? $pedido['payment_method'] ?? $pedido['formaPago'] ?? '',
                // Guardar el pedido original por si necesitas más datos
                '_raw' => $pedido
            ];
        }
    }
    
    return $domicilios;
}

// ============================================================================
// PROCESAR PETICIÓN
// ============================================================================

// Obtener datos de la petición
$input = json_decode(file_get_contents('php://input'), true);
$accion = $input['accion'] ?? $_GET['accion'] ?? '';
$sede = $input['sede'] ?? $_GET['sede'] ?? '';
$fecha = $input['fecha'] ?? $_GET['fecha'] ?? date('Y-m-d');

// Validar sede
if (empty($sede)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Sede no especificada']);
    exit();
}

// Obtener credenciales de la sede
$sedeUpper = strtoupper($sede);
if (!isset($credenciales_por_sede[$sedeUpper])) {
    http_response_code(400);
    echo json_encode([
        'success' => false, 
        'error' => "Credenciales no configuradas para la sede: {$sede}",
        'sedesDisponibles' => array_keys($credenciales_por_sede)
    ]);
    exit();
}

$credenciales = $credenciales_por_sede[$sedeUpper];

// Ejecutar acción
switch ($accion) {
    case 'obtener_token':
        $resultado = obtenerToken($credenciales['apiKey'], $credenciales['apiSecret']);
        echo json_encode($resultado);
        break;
        
    case 'consultar_pedidos':
    case 'traer_domicilios':
        // Primero obtener token
        $tokenResult = obtenerToken($credenciales['apiKey'], $credenciales['apiSecret']);
        
        if (!$tokenResult['success']) {
            echo json_encode([
                'success' => false,
                'error' => 'Error de autenticación: ' . ($tokenResult['error'] ?? 'Token no obtenido')
            ]);
            exit();
        }
        
        // Consultar pedidos
        $pedidosResult = consultarPedidos($tokenResult['token'], $fecha);
        
        if (!$pedidosResult['success']) {
            echo json_encode([
                'success' => false,
                'error' => 'Error consultando pedidos: ' . ($pedidosResult['error'] ?? 'Error desconocido')
            ]);
            exit();
        }
        
        // Procesar respuesta
        $pedidos = $pedidosResult['data'];
        
        // Si la respuesta viene envuelta en 'data'
        if (isset($pedidos['data']) && is_array($pedidos['data'])) {
            $pedidos = $pedidos['data'];
        }
        
        if ($accion === 'traer_domicilios') {
            // Filtrar solo domicilios
            $domicilios = filtrarDomicilios($pedidos);
            echo json_encode([
                'success' => true,
                'fecha' => $fecha,
                'sede' => $sede,
                'totalPedidos' => count($pedidos),
                'totalDomicilios' => count($domicilios),
                'domicilios' => $domicilios
            ]);
        } else {
            // Devolver todos los pedidos
            echo json_encode([
                'success' => true,
                'fecha' => $fecha,
                'sede' => $sede,
                'total' => count($pedidos),
                'pedidos' => $pedidos
            ]);
        }
        break;
        
    case 'test':
        // Prueba simple de conexión
        $tokenResult = obtenerToken($credenciales['apiKey'], $credenciales['apiSecret']);
        echo json_encode([
            'success' => $tokenResult['success'],
            'mensaje' => $tokenResult['success'] ? 'Conexión exitosa con FUDO' : 'Error de conexión',
            'sede' => $sede,
            'tokenObtenido' => $tokenResult['success'],
            'error' => $tokenResult['error'] ?? null
        ]);
        break;
        
    default:
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Acción no válida',
            'accionesDisponibles' => ['test', 'obtener_token', 'consultar_pedidos', 'traer_domicilios']
        ]);
}
?>
