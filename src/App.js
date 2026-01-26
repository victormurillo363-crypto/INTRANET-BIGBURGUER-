import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './config';

// ============================================
// INTRANET DE EMPLEADOS - APLICACIÓN PRINCIPAL
// v1.3 - Horarios conectados
// ============================================
// Esta aplicación se conecta a la misma base de datos Supabase
// del sistema principal. Los usuarios ingresan con su número
// de documento (cédula) y la misma clave del sistema principal.

// Configuración de Supabase desde archivo config.js
const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
function App() {
  const [usuario, setUsuario] = useState(null);
  const [empleado, setEmpleado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [seccionActiva, setSeccionActiva] = useState('inicio');
  const [menuAbierto, setMenuAbierto] = useState(false);
  
  // Estados para login
  const [documento, setDocumento] = useState('');
  const [clave, setClave] = useState('');
  const [errorLogin, setErrorLogin] = useState('');
  
  // Estados para datos
  const [nominas, setNominas] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [configEmpresa, setConfigEmpresa] = useState(null);

  // Verificar si hay sesión guardada al cargar
  useEffect(() => {
    const sesionGuardada = localStorage.getItem('intranet_usuario');
    if (sesionGuardada) {
      try {
        const datosUsuario = JSON.parse(sesionGuardada);
        setUsuario(datosUsuario);
        cargarDatosEmpleado(datosUsuario);
      } catch (e) {
        localStorage.removeItem('intranet_usuario');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarDatosEmpleado = async (usuarioData) => {
    setCargando(true);
    try {
      // Buscar empleado por documento en la tabla empleados
      const { data: emp, error } = await supabase
        .from('empleados')
        .select('*')
        .eq('documento', usuarioData.usuario)
        .maybeSingle();
      
      if (emp && !error) {
        setEmpleado(emp);
        
        // Guardar el ID del empleado para buscar nóminas
        const empleadoId = emp.id || emp.documento;
        console.log('👤 Empleado encontrado, ID:', empleadoId, 'Documento:', emp.documento);
        
        // Cargar configuración de empresa
        if (emp.empresa_id || usuarioData.empresa_id) {
          const empresaId = emp.empresa_id || usuarioData.empresa_id;
          
          // Cargar config de empresa para la intranet
          const { data: configData } = await supabase
            .from('config_empresa_intranet')
            .select('*')
            .eq('empresa_id', empresaId)
            .maybeSingle();
          if (configData) setConfigEmpresa(configData);
          
          // Cargar empresa del sistema principal si existe
          const { data: empresaData } = await supabase
            .from('empresas')
            .select('*')
            .eq('id', empresaId)
            .maybeSingle();
          if (empresaData) setEmpresa(empresaData);
        }
        
        // Cargar datos adicionales usando ID para nóminas y horarios, documento para el resto
        await Promise.all([
          cargarNominas(empleadoId, emp.documento),
          cargarHorarios(emp.id), // Usar ID del empleado para horarios
          cargarSolicitudes(emp.documento)
        ]);
      } else {
        // Si no encuentra en empleados, usar datos del usuario
        setEmpleado({
          nombre: usuarioData.nombre,
          documento: usuarioData.usuario,
          cargo: 'Colaborador',
          sede: '',
          empresa_id: usuarioData.empresa_id
        });
        
        // Cargar datos usando el documento del usuario
        await Promise.all([
          cargarNominas(usuarioData.usuario, usuarioData.usuario),
          cargarHorarios(usuarioData.usuario),
          cargarSolicitudes(usuarioData.usuario)
        ]);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
    setCargando(false);
  };

  const cargarNominas = async (empleadoId, documento) => {
    try {
      console.log('🔍 Buscando nóminas para empleadoId:', empleadoId, 'documento:', documento);
      
      // PRIMERO: Ver cuántas nóminas hay en total en la tabla
      const { data: todasNominas, count, error: errorTotal } = await supabase
        .from('nominas')
        .select('id, empleadoid, periodo, totalneto', { count: 'exact' })
        .limit(10);
      
      console.log('📊 TOTAL nóminas en tabla:', count, 'Primeras 10:', todasNominas, errorTotal);
      
      // Mostrar los empleadoid para debug
      if (todasNominas && todasNominas.length > 0) {
        console.log('👥 Empleadoids en la tabla:', todasNominas.map(n => n.empleadoid));
      }
      
      // Intentar buscar primero por empleadoid (ID del empleado)
      let { data, error } = await supabase
        .from('nominas')
        .select('*')
        .eq('empleadoid', empleadoId)
        .order('periodo', { ascending: false })
        .limit(12);
      
      console.log('📋 Resultado búsqueda por empleadoid (ID):', data?.length || 0, error);
      
      // Si no encuentra por ID, intentar por documento
      if ((!data || data.length === 0) && !error && documento) {
        console.log('🔄 Intentando búsqueda por documento...');
        const { data: dataDoc } = await supabase
          .from('nominas')
          .select('*')
          .eq('empleadoid', documento)
          .order('periodo', { ascending: false })
          .limit(12);
        
        console.log('📋 Resultado búsqueda por documento:', dataDoc?.length || 0);
        if (dataDoc && dataDoc.length > 0) {
          data = dataDoc;
        }
      }
      
      // Si aún no encuentra, buscar con ilike por si hay prefijos/sufijos
      if ((!data || data.length === 0) && !error) {
        console.log('🔄 Intentando búsqueda con contains...');
        const { data: dataAlt } = await supabase
          .from('nominas')
          .select('*')
          .or(`empleadoid.ilike.%${empleadoId}%,empleadoid.ilike.%${documento}%`)
          .order('periodo', { ascending: false })
          .limit(12);
        
        console.log('📋 Resultado búsqueda ilike:', dataAlt?.length || 0);
        if (dataAlt && dataAlt.length > 0) {
          data = dataAlt;
        }
      }
      
      if (data) {
        console.log('✅ Nóminas encontradas:', data.length);
        setNominas(data);
      }
    } catch (e) {
      console.log('❌ Error cargando nóminas:', e);
    }
  };

  const cargarHorarios = async (empleadoId) => {
    try {
      console.log('📅 Buscando horarios para empleado ID:', empleadoId);
      
      // Calcular fechas: mes actual y mes anterior
      const hoy = new Date();
      const primerDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const ultimoDiaMesActual = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      
      const fechaInicio = primerDiaMesAnterior.toISOString().split('T')[0];
      const fechaFin = ultimoDiaMesActual.toISOString().split('T')[0];
      
      console.log('📆 Buscando horarios desde', fechaInicio, 'hasta', fechaFin);
      
      // Buscar horarios que incluyan el rango de fechas
      const { data: horariosData, error } = await supabase
        .from('horarios')
        .select('*')
        .gte('semana_fin', fechaInicio)
        .lte('semana_inicio', fechaFin)
        .order('semana_inicio', { ascending: false });
      
      if (error) {
        console.error('Error cargando horarios:', error);
        return;
      }
      
      console.log('📅 Horarios encontrados:', horariosData?.length || 0);
      
      // Procesar los horarios para extraer solo los del empleado
      const horariosEmpleado = [];
      
      if (horariosData) {
        for (const semana of horariosData) {
          const celdas = semana.celdas || {};
          const horarioEmpleado = celdas[empleadoId];
          
          if (horarioEmpleado) {
            // horarioEmpleado tiene formato: { "0": {turno lunes}, "1": {turno martes}, etc }
            const fechaInicioSemana = new Date(semana.semana_inicio + 'T00:00:00');
            
            for (const [diaIndex, turno] of Object.entries(horarioEmpleado)) {
              const diaNum = parseInt(diaIndex);
              const fechaDia = new Date(fechaInicioSemana);
              fechaDia.setDate(fechaDia.getDate() + diaNum);
              const fechaStr = fechaDia.toISOString().split('T')[0];
              
              // Solo incluir si está dentro del rango
              if (fechaStr >= fechaInicio && fechaStr <= fechaFin) {
                // Determinar si es descanso
                const esDescanso = turno.tipo === 'DESCANSO' || (!turno.e1 && !turno.s1);
                
                if (esDescanso) {
                  horariosEmpleado.push({
                    fecha: fechaStr,
                    es_descanso: true,
                    sede: null
                  });
                } else {
                  // Turno normal o partido
                  let horaInicio = turno.e1 || '';
                  let horaFin = turno.s1 || turno.s2 || '';
                  let sede = turno.sede1 || turno.sede || '';
                  
                  // Si es turno partido, mostrar ambos rangos
                  if (turno.tipo === 'PARTIDO' && turno.e2 && turno.s2) {
                    horariosEmpleado.push({
                      fecha: fechaStr,
                      hora_inicio: turno.e1,
                      hora_fin: turno.s1,
                      sede: turno.sede1 || '',
                      es_descanso: false,
                      turno_partido: true,
                      segundo_turno: {
                        hora_inicio: turno.e2,
                        hora_fin: turno.s2,
                        sede: turno.sede2 || turno.sede1 || ''
                      }
                    });
                  } else {
                    horariosEmpleado.push({
                      fecha: fechaStr,
                      hora_inicio: horaInicio,
                      hora_fin: horaFin,
                      sede: sede,
                      es_descanso: false
                    });
                  }
                }
              }
            }
          }
        }
      }
      
      // Ordenar por fecha descendente (más recientes primero)
      horariosEmpleado.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      
      console.log('👤 Horarios del empleado:', horariosEmpleado.length);
      setHorarios(horariosEmpleado);
      
    } catch (e) {
      console.error('Error en cargarHorarios:', e);
    }
  };

  const cargarSolicitudes = async (doc) => {
    try {
      const { data } = await supabase
        .from('solicitudes_empleados')
        .select('*')
        .eq('documento', doc)
        .order('fecha_creacion', { ascending: false })
        .limit(20);
      if (data) setSolicitudes(data);
    } catch (e) {
      console.log('Tabla solicitudes_empleados no disponible');
    }
  };

  // ============================================
  // FUNCIÓN DE LOGIN - Usa tabla "usuarios" del sistema principal
  // ============================================
  const iniciarSesion = async (e) => {
    e.preventDefault();
    setErrorLogin('');
    setCargando(true);
    
    try {
      // Buscar usuario en la tabla "usuarios" del sistema principal
      const { data: usuarioData, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('usuario', documento.trim())
        .eq('clave', clave)
        .eq('activo', true)
        .maybeSingle();
      
      if (error) {
        console.error('Error en consulta:', error);
        setErrorLogin('Error al conectar con el servidor');
        setCargando(false);
        return;
      }
      
      if (!usuarioData) {
        setErrorLogin('Documento o contraseña incorrectos');
        setCargando(false);
        return;
      }
      
      // Usuario encontrado - guardar sesión
      const datosUsuario = {
        id: usuarioData.id,
        nombre: usuarioData.nombre,
        usuario: usuarioData.usuario,
        email: usuarioData.email,
        perfil: usuarioData.perfil,
        empresa_id: usuarioData.empresa_id
      };
      
      localStorage.setItem('intranet_usuario', JSON.stringify(datosUsuario));
      setUsuario(datosUsuario);
      await cargarDatosEmpleado(datosUsuario);
      
    } catch (error) {
      console.error('Error en login:', error);
      setErrorLogin('Error al iniciar sesión');
    }
    setCargando(false);
  };

  const cerrarSesion = () => {
    localStorage.removeItem('intranet_usuario');
    setUsuario(null);
    setEmpleado(null);
    setNominas([]);
    setHorarios([]);
    setSolicitudes([]);
    setSeccionActiva('inicio');
  };

  // ============================================
  // PANTALLA DE LOGIN
  // ============================================
  if (!usuario) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #b71c1c 0%, #c62828 50%, #d32f2f 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: 20,
          padding: 40,
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <img 
              src="/logo.jpg" 
              alt="Big Burguer" 
              style={{ 
                width: 120, 
                height: 120, 
                borderRadius: '50%', 
                objectFit: 'cover',
                marginBottom: 16,
                border: '4px solid #c62828',
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
              }} 
            />
            <h1 style={{ color: '#b71c1c', margin: 0, fontSize: 24 }}>
              Portal del Empleado
            </h1>
            <p style={{ color: '#666', marginTop: 8 }}>
              Ingresa con tus credenciales del sistema
            </p>
          </div>
          
          <form onSubmit={iniciarSesion}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#333', fontWeight: 500 }}>
                Número de Documento
              </label>
              <input
                type="text"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="Ej: 1234567890"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e0e0e0',
                  borderRadius: 10,
                  fontSize: 16,
                  outline: 'none',
                  transition: 'border 0.3s',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#333', fontWeight: 500 }}>
                Contraseña
              </label>
              <input
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e0e0e0',
                  borderRadius: 10,
                  fontSize: 16,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            {errorLogin && (
              <div style={{
                padding: 12,
                backgroundColor: '#ffebee',
                color: '#c62828',
                borderRadius: 8,
                marginBottom: 16,
                textAlign: 'center'
              }}>
                {errorLogin}
              </div>
            )}
            
            <button
              type="submit"
              disabled={cargando}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#c62828',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 'bold',
                cursor: cargando ? 'wait' : 'pointer',
                opacity: cargando ? 0.7 : 1
              }}
            >
              {cargando ? '⏳ Ingresando...' : '🍔 Ingresar'}
            </button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: 20, color: '#999', fontSize: 12 }}>
            ¿Olvidaste tu contraseña? Contacta a Recursos Humanos
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // MENÚ LATERAL
  // ============================================
  const menuItems = [
    { id: 'inicio', icono: '🏠', nombre: 'Inicio' },
    { id: 'desprendible', icono: '💰', nombre: 'Desprendible de Pago' },
    { id: 'carta-laboral', icono: '📄', nombre: 'Carta Laboral' },
    { id: 'contrato', icono: '📋', nombre: 'Contrato de Trabajo' },
    { id: 'horarios', icono: '🕐', nombre: 'Mis Horarios' },
    { id: 'solicitudes', icono: '📝', nombre: 'Radicar Solicitud' },
    { id: 'reglamento', icono: '📖', nombre: 'Reglamento Interno' },
    { id: 'formatos', icono: '📁', nombre: 'Formatos' },
  ];

  // ============================================
  // COMPONENTES DE SECCIONES
  // ============================================
  
  // INICIO
  const SeccionInicio = () => (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #b71c1c, #c62828)',
        color: 'white',
        padding: 30,
        borderRadius: 16,
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 20
      }}>
        <img 
          src="/logo.jpg" 
          alt="Big Burguer" 
          style={{ 
            width: 70, 
            height: 70, 
            borderRadius: '50%', 
            objectFit: 'cover',
            border: '3px solid white',
            flexShrink: 0
          }} 
        />
        <div>
          <h2 style={{ margin: 0 }}>¡Bienvenido, {empleado?.nombre || usuario?.nombre || 'Empleado'}!</h2>
          <p style={{ margin: '10px 0 0', opacity: 0.9 }}>
            {empleado?.cargo || 'Colaborador'} | {empleado?.sede || configEmpresa?.nombre_empresa || empresa?.nombre || 'Empresa'}
          </p>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {menuItems.filter(m => m.id !== 'inicio').map(item => (
          <button
            key={item.id}
            onClick={() => setSeccionActiva(item.id)}
            style={{
              padding: 24,
              backgroundColor: 'white',
              border: '2px solid #e0e0e0',
              borderRadius: 16,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.3s'
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>{item.icono}</div>
            <div style={{ fontWeight: 'bold', color: '#c62828' }}>{item.nombre}</div>
          </button>
        ))}
      </div>
    </div>
  );

  // DESPRENDIBLE DE PAGO - Conectado a la tabla nominas del sistema principal
  const SeccionDesprendible = () => {
    const [nominaSeleccionada, setNominaSeleccionada] = useState(null);
    
    const formatearMoneda = (valor) => {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
      }).format(valor || 0);
    };

    const formatearFechaCorta = (fecha) => {
      if (!fecha) return '';
      return new Date(fecha).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short'
      });
    };

    // Función para calcular el rango de la quincena desde una fecha
    const getRangoQuincena = (fechaISO) => {
      if (!fechaISO) return { inicio: '', fin: '' };
      
      const date = new Date(fechaISO);
      const yyyy = date.getFullYear();
      const mm = date.getMonth();
      const dd = date.getDate();
      const half = dd <= 15 ? 1 : 2;
      
      // Calcular los días de la quincena
      const lastDay = new Date(yyyy, mm + 1, 0).getDate();
      const start = half === 1 ? 1 : 16;
      const end = half === 1 ? 15 : lastDay;
      
      return {
        inicio: new Date(yyyy, mm, start),
        fin: new Date(yyyy, mm, end),
        quincena: half === 1 ? 'Primera' : 'Segunda',
        mes: date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
      };
    };

    const imprimirDesprendible = () => {
      window.print();
    };

    // Parsear horas_totales (puede venir como string JSON o objeto)
    const getHorasTotales = (nomina) => {
      if (!nomina) return null;
      let horas = nomina.horas_totales || nomina.detalle_horas_completo;
      if (typeof horas === 'string') {
        try {
          horas = JSON.parse(horas);
        } catch {
          return null;
        }
      }
      return horas;
    };

    const horasTotales = nominaSeleccionada ? getHorasTotales(nominaSeleccionada) : null;
    const rangoQuincena = nominaSeleccionada ? getRangoQuincena(nominaSeleccionada.periodo) : null;

    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 20 }}>💰 Desprendible de Pago</h2>
        
        {!nominaSeleccionada ? (
          <div>
            <p style={{ color: '#666', marginBottom: 16 }}>
              Selecciona un período para ver tu desprendible:
            </p>
            
            {nominas.length === 0 ? (
              <div style={{
                padding: 40,
                backgroundColor: '#f5f5f5',
                borderRadius: 12,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                <p style={{ color: '#666' }}>No hay desprendibles disponibles</p>
                <p style={{ color: '#999', fontSize: 12 }}>Los desprendibles aparecerán aquí cuando se procese la nómina en el sistema.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {nominas.map(nomina => {
                  const rango = getRangoQuincena(nomina.periodo);
                  return (
                  <button
                    key={nomina.id}
                    onClick={() => setNominaSeleccionada(nomina)}
                    style={{
                      padding: 16,
                      backgroundColor: 'white',
                      border: '2px solid #e0e0e0',
                      borderRadius: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#c62828' }}>
                        {rango.quincena} Quincena - {rango.mes}
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                        Del {formatearFechaCorta(rango.inicio)} al {formatearFechaCorta(rango.fin)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#4caf50', fontSize: 18 }}>
                      {formatearMoneda(nomina.totalneto || nomina.netoapagar)}
                    </div>
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            <button
              onClick={() => setNominaSeleccionada(null)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f5f5f5',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                marginBottom: 16
              }}
              className="no-print"
            >
              ← Volver
            </button>
            
            {/* DESPRENDIBLE - Diseño compacto para una sola hoja */}
            <div id="desprendible-print" style={{
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: '16px 20px',
              fontSize: 12,
              maxWidth: 700,
              margin: '0 auto'
            }}>
              {/* Encabezado con Logo y Datos de Sede */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderBottom: '2px solid #c62828', 
                paddingBottom: 12,
                marginBottom: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img 
                    src="/logo.jpg" 
                    alt="Big Burguer" 
                    style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }} 
                  />
                  <div>
                    <h3 style={{ margin: 0, color: '#c62828', fontSize: 16 }}>BIG BURGUER</h3>
                    <p style={{ margin: 0, fontSize: 11, color: '#666' }}>
                      Sede: {empleado?.sede || 'Principal'}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h4 style={{ margin: 0, fontSize: 14 }}>COMPROBANTE DE PAGO</h4>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#c62828', fontWeight: 'bold' }}>
                    {rangoQuincena?.quincena} Quincena - {rangoQuincena?.mes}
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: '#666' }}>
                    Del {formatearFechaCorta(rangoQuincena?.inicio)} al {formatearFechaCorta(rangoQuincena?.fin)}
                  </p>
                </div>
              </div>
              
              {/* Datos del empleado - Documento real */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '4px 16px',
                marginBottom: 12,
                padding: 10,
                backgroundColor: '#f8f8f8',
                borderRadius: 6,
                fontSize: 11
              }}>
                <div><strong>Nombre:</strong> {empleado?.nombre || usuario?.nombre}</div>
                <div><strong>Documento:</strong> {empleado?.documento || usuario?.usuario}</div>
                <div><strong>Cargo:</strong> {empleado?.cargo || 'Colaborador'}</div>
                <div><strong>Sede:</strong> {empleado?.sede || ''}</div>
              </div>

              {/* RESUMEN DE HORAS TRABAJADAS */}
              {horasTotales && (
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ color: '#1565c0', borderBottom: '1px solid #1565c0', paddingBottom: 4, margin: '0 0 8px', fontSize: 12 }}>
                    ⏰ HORAS TRABAJADAS
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 11 }}>
                    {(horasTotales.hNorm > 0 || horasTotales.horasNormales > 0) && (
                      <div style={{ padding: 6, backgroundColor: '#e3f2fd', borderRadius: 4, textAlign: 'center' }}>
                        <strong>Normales</strong><br/>{horasTotales.hNorm || horasTotales.horasNormales || 0}h
                      </div>
                    )}
                    {(horasTotales.hNoct > 0 || horasTotales.horasNocturnas > 0) && (
                      <div style={{ padding: 6, backgroundColor: '#e8eaf6', borderRadius: 4, textAlign: 'center' }}>
                        <strong>Nocturnas</strong><br/>{horasTotales.hNoct || horasTotales.horasNocturnas || 0}h
                      </div>
                    )}
                    {(horasTotales.hFest > 0 || horasTotales.horasFestivas > 0) && (
                      <div style={{ padding: 6, backgroundColor: '#fce4ec', borderRadius: 4, textAlign: 'center' }}>
                        <strong>Festivas</strong><br/>{horasTotales.hFest || horasTotales.horasFestivas || 0}h
                      </div>
                    )}
                    {(horasTotales.hExDia > 0 || horasTotales.horasExtrasDia > 0) && (
                      <div style={{ padding: 6, backgroundColor: '#fff3e0', borderRadius: 4, textAlign: 'center' }}>
                        <strong>Extra Diurna</strong><br/>{horasTotales.hExDia || horasTotales.horasExtrasDia || 0}h
                      </div>
                    )}
                    {(horasTotales.hExNoc > 0 || horasTotales.horasExtrasNoc > 0) && (
                      <div style={{ padding: 6, backgroundColor: '#ede7f6', borderRadius: 4, textAlign: 'center' }}>
                        <strong>Extra Nocturna</strong><br/>{horasTotales.hExNoc || horasTotales.horasExtrasNoc || 0}h
                      </div>
                    )}
                    {(horasTotales.hExFest > 0 || horasTotales.horasExtrasFest > 0) && (
                      <div style={{ padding: 6, backgroundColor: '#ffebee', borderRadius: 4, textAlign: 'center' }}>
                        <strong>Extra Festiva</strong><br/>{horasTotales.hExFest || horasTotales.horasExtrasFest || 0}h
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tabla de dos columnas: Devengados y Deducciones lado a lado */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                {/* Devengados */}
                <div>
                  <h4 style={{ color: '#4caf50', borderBottom: '1px solid #4caf50', paddingBottom: 4, margin: '0 0 6px', fontSize: 12 }}>
                    💵 DEVENGADOS
                  </h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>Salario Base</td>
                        <td style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatearMoneda(nominaSeleccionada.salariobase || nominaSeleccionada.bruto)}</td>
                      </tr>
                      {(nominaSeleccionada.auxtransporte || nominaSeleccionada.auxtransp) > 0 && (
                        <tr>
                          <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>Aux. Transporte</td>
                          <td style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatearMoneda(nominaSeleccionada.auxtransporte || nominaSeleccionada.auxtransp)}</td>
                        </tr>
                      )}
                      {(nominaSeleccionada.valorextras || nominaSeleccionada.hexvalor) > 0 && (
                        <tr>
                          <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>Horas Extras</td>
                          <td style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatearMoneda(nominaSeleccionada.valorextras || nominaSeleccionada.hexvalor)}</td>
                        </tr>
                      )}
                      {nominaSeleccionada.bonificacion > 0 && (
                        <tr>
                          <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>Bonificación</td>
                          <td style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatearMoneda(nominaSeleccionada.bonificacion)}</td>
                        </tr>
                      )}
                      <tr style={{ backgroundColor: '#e8f5e9', fontWeight: 'bold' }}>
                        <td style={{ padding: 6 }}>TOTAL</td>
                        <td style={{ padding: 6, textAlign: 'right' }}>{formatearMoneda(nominaSeleccionada.totaldevengado)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Deducciones */}
                <div>
                  <h4 style={{ color: '#f44336', borderBottom: '1px solid #f44336', paddingBottom: 4, margin: '0 0 6px', fontSize: 12 }}>
                    📉 DEDUCCIONES
                  </h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <tbody>
                      {(nominaSeleccionada.descuentosalud || nominaSeleccionada.descsalud) > 0 && (
                        <tr>
                          <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>Salud (4%)</td>
                          <td style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatearMoneda(nominaSeleccionada.descuentosalud || nominaSeleccionada.descsalud)}</td>
                        </tr>
                      )}
                      {(nominaSeleccionada.descuentopension || nominaSeleccionada.descpension) > 0 && (
                        <tr>
                          <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>Pensión (4%)</td>
                          <td style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatearMoneda(nominaSeleccionada.descuentopension || nominaSeleccionada.descpension)}</td>
                        </tr>
                      )}
                      {(nominaSeleccionada.descuentoprestamos || nominaSeleccionada.descprestamos) > 0 && (
                        <tr>
                          <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>Préstamos</td>
                          <td style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatearMoneda(nominaSeleccionada.descuentoprestamos || nominaSeleccionada.descprestamos)}</td>
                        </tr>
                      )}
                      {(nominaSeleccionada.descuentocomida || nominaSeleccionada.desccomida) > 0 && (
                        <tr>
                          <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>Comida</td>
                          <td style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatearMoneda(nominaSeleccionada.descuentocomida || nominaSeleccionada.desccomida)}</td>
                        </tr>
                      )}
                      {(nominaSeleccionada.otros_descuentos || nominaSeleccionada.descotros) > 0 && (
                        <tr>
                          <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>Otros</td>
                          <td style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatearMoneda(nominaSeleccionada.otros_descuentos || nominaSeleccionada.descotros)}</td>
                        </tr>
                      )}
                      <tr style={{ backgroundColor: '#ffebee', fontWeight: 'bold' }}>
                        <td style={{ padding: 6 }}>TOTAL</td>
                        <td style={{ padding: 6, textAlign: 'right' }}>{formatearMoneda(nominaSeleccionada.totaldescuentos)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Neto a pagar - Destacado */}
              <div style={{
                padding: 12,
                backgroundColor: '#c62828',
                color: 'white',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: 14, fontWeight: 'bold' }}>💰 NETO A PAGAR</span>
                <span style={{ fontSize: 20, fontWeight: 'bold' }}>{formatearMoneda(nominaSeleccionada.totalneto || nominaSeleccionada.netoapagar)}</span>
              </div>

              {/* Pie de página */}
              <div style={{ marginTop: 12, textAlign: 'center', fontSize: 9, color: '#999', borderTop: '1px solid #eee', paddingTop: 8 }}>
                <p style={{ margin: 0 }}>Portal del Empleado - Big Burguer | Impreso: {new Date().toLocaleDateString('es-CO')}</p>
              </div>
            </div>
            
            <div style={{ marginTop: 16, textAlign: 'center' }} className="no-print">
              <button
                onClick={imprimirDesprendible}
                style={{
                  padding: '12px 28px',
                  backgroundColor: '#c62828',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 'bold'
                }}
              >
                🖨️ Imprimir Desprendible
              </button>
            </div>
          </div>
        )}
        
        {/* Estilos para impresión */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #desprendible-print, #desprendible-print * { visibility: visible; }
            #desprendible-print { 
              position: absolute; 
              left: 0; 
              top: 0; 
              width: 100%;
              padding: 20px;
              border: none !important;
            }
            .no-print { display: none !important; }
            @page { margin: 1cm; }
          }
        `}</style>
      </div>
    );
  };

  // CARTA LABORAL - Automática con datos de sede
  const SeccionCartaLaboral = () => {
    const [datosSede, setDatosSede] = useState(null);
    const [cargandoSede, setCargandoSede] = useState(true);
    
    const sedeEmpleado = empleado?.sede;

    // Cargar datos de la sede del empleado al montar
    useEffect(() => {
      const cargarDatosSede = async () => {
        try {
          // Buscar la sede del empleado
          if (sedeEmpleado) {
            const { data } = await supabase
              .from('sedes')
              .select('*')
              .ilike('nombre', `%${sedeEmpleado}%`)
              .limit(1)
              .maybeSingle();
            
            if (data) {
              setDatosSede({
                nombre: data.nombre || '',
                nit: data.nit || '',
                razonSocial: data.razonsocial || data.razonSocial || 'BIG BURGUER S.A.S',
                representanteLegal: data.representantelegal || data.representanteLegal || '',
                generoRepresentante: data.generorepresentante || data.generoRepresentante || 'Masculino',
                direccion: data.direccion || '',
                telefono: data.telefono || ''
              });
            }
          }
        } catch (e) {
          console.log('Error cargando sede:', e);
        }
        setCargandoSede(false);
      };
      cargarDatosSede();
    }, [sedeEmpleado]);

    const formatearMoneda = (valor) => {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
      }).format(valor || 0);
    };

    // Función para convertir número a letras
    const numeroALetras = (num) => {
      if (!num || num === 0) return 'CERO';
      const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
      const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
      const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
      const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
      
      const n = Math.floor(num);
      if (n === 100) return 'CIEN';
      if (n === 1000) return 'MIL';
      if (n === 1000000) return 'UN MILLÓN';
      
      const convertirCentena = (c) => {
        if (c === 0) return '';
        if (c === 100) return 'CIEN';
        const cent = Math.floor(c / 100);
        const dec = c % 100;
        let texto = centenas[cent];
        if (dec > 0) {
          if (dec < 10) texto += ' ' + unidades[dec];
          else if (dec < 20) texto += ' ' + especiales[dec - 10];
          else if (dec === 20) texto += ' VEINTE';
          else if (dec < 30) texto += ' VEINTI' + unidades[dec - 20];
          else {
            const d = Math.floor(dec / 10);
            const u = dec % 10;
            texto += ' ' + decenas[d] + (u > 0 ? ' Y ' + unidades[u] : '');
          }
        }
        return texto.trim();
      };

      if (n < 1000) return convertirCentena(n);
      if (n < 1000000) {
        const miles = Math.floor(n / 1000);
        const resto = n % 1000;
        const milesTexto = miles === 1 ? 'MIL' : convertirCentena(miles) + ' MIL';
        return resto > 0 ? milesTexto + ' ' + convertirCentena(resto) : milesTexto;
      }
      if (n < 1000000000) {
        const millones = Math.floor(n / 1000000);
        const resto = n % 1000000;
        const millonesTexto = millones === 1 ? 'UN MILLÓN' : convertirCentena(millones) + ' MILLONES';
        if (resto === 0) return millonesTexto;
        if (resto < 1000) return millonesTexto + ' ' + convertirCentena(resto);
        const miles = Math.floor(resto / 1000);
        const restoFinal = resto % 1000;
        const milesTexto = miles === 1 ? 'MIL' : (miles > 0 ? convertirCentena(miles) + ' MIL' : '');
        return millonesTexto + ' ' + milesTexto + (restoFinal > 0 ? ' ' + convertirCentena(restoFinal) : '');
      }
      return new Intl.NumberFormat('es-CO').format(num);
    };

    const imprimirCarta = () => {
      const ventanaImpresion = window.open('', '_blank');
      const fechaActual = new Date();
      const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
      const fechaTexto = `${fechaActual.getDate()} de ${meses[fechaActual.getMonth()]} de ${fechaActual.getFullYear()}`;
      
      // Nombre: combinar nombres y apellidos o usar campo nombre
      const nombreEmpleado = empleado?.nombres && empleado?.apellidos 
        ? `${empleado.nombres} ${empleado.apellidos}` 
        : (empleado?.nombre || usuario?.nombre || '');
      const documento = empleado?.documento || usuario?.usuario || '';
      const cargo = empleado?.cargo || 'Colaborador';
      // Campo correcto: fechaingreso (minúsculas, sin guión)
      const fechaIngreso = empleado?.fechaingreso || empleado?.fecha_ingreso || empleado?.fechaIngreso || '';
      // Campo correcto: tipocontrato (minúsculas, sin guión)
      const tipoContrato = empleado?.tipocontrato || empleado?.tipo_contrato || empleado?.tipoContrato || 'Término Indefinido';
      // Campo correcto: salariobase (minúsculas, sin guión)
      const salarioBase = empleado?.salariobase || empleado?.salario_basico || empleado?.salarioBase || empleado?.salario || 0;
      // Auxilio de transporte legal vigente 2026 Colombia
      const AUXILIO_TRANSPORTE = 249095;
      // Total: salario básico + auxilio de transporte
      const salarioTotal = salarioBase + AUXILIO_TRANSPORTE;
      
      console.log('📄 Carta Laboral - Salario:', salarioBase, '+ Aux:', AUXILIO_TRANSPORTE, '= Total:', salarioTotal);
      
      const razonSocial = datosSede?.razonSocial || 'BIG BURGUER S.A.S';
      const nitSede = datosSede?.nit || '';
      const representante = datosSede?.representanteLegal || 'REPRESENTANTE LEGAL';
      const genero = datosSede?.generoRepresentante || 'Masculino';
      const direccionSede = datosSede?.direccion || '';
      const telefonoSede = datosSede?.telefono || '';
      const sede = empleado?.sede || '';

      // URL del logo usando la URL base de la aplicación (funciona en desarrollo y producción)
      const LOGO_URL = window.location.origin + "/logo-bigburguer.jpg";

      ventanaImpresion.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Certificación Laboral</title>
            <meta charset="UTF-8">
            <style>
              @page { size: letter; margin: 2.5cm 2.5cm 3cm 2.5cm; }
              body { 
                font-family: 'Times New Roman', Times, serif; 
                font-size: 12pt;
                line-height: 1.8;
                color: #000;
                max-width: 21cm;
                margin: 0 auto;
                padding: 2cm;
                position: relative;
              }
              .logo-header {
                position: absolute;
                top: 0;
                right: 0;
                width: 80px;
              }
              .logo-header img {
                width: 100%;
                border-radius: 8px;
              }
              .encabezado {
                text-align: center;
                margin-bottom: 30px;
                padding-top: 90px;
              }
              .empresa { font-size: 14pt; font-weight: bold; margin-bottom: 5px; }
              .sede-info { font-size: 10pt; color: #666; }
              .titulo {
                font-size: 13pt;
                font-weight: bold;
                text-align: center;
                margin: 30px 0;
                text-decoration: underline;
              }
              .fecha { text-align: left; margin: 30px 0 20px 0; }
              .contenido { text-align: justify; margin: 20px 0; }
              .firma {
                margin-top: 60px;
                text-align: left;
              }
              .linea-firma {
                border-top: 1px solid #000;
                width: 250px;
                margin: 0 0 10px 0;
              }
              .nombre-firma { font-weight: bold; margin: 0; }
              .cargo-firma { margin: 0; font-size: 11pt; }
              @media print {
                body { padding: 0; }
                .logo-header { position: fixed; top: 0; right: 0; width: 70px; }
              }
            </style>
          </head>
          <body>
            <div class="logo-header">
              <img src="${LOGO_URL}" alt="Big Burguer Logo" />
            </div>
            
            <div class="encabezado">
              <div class="empresa">${razonSocial}</div>
              <div class="sede-info">Sede: ${sede}</div>
            </div>

            <div class="fecha">Pereira, ${fechaTexto}</div>

            <div class="titulo">CERTIFICACIÓN LABORAL</div>

            <div class="contenido">
              <p>${genero === "Femenino" ? "La suscrita" : "El suscrito"} <strong>${representante}</strong>, en calidad de Representante Legal de <strong>${razonSocial}</strong>, identificad${genero === "Femenino" ? "a" : "o"} con NIT <strong>${nitSede}</strong>,</p>
              
              <p style="text-align: center; margin: 25px 0;"><strong>CERTIFICA QUE:</strong></p>
              
              <p>El (la) Señor(a) <strong>${nombreEmpleado.toUpperCase()}</strong>, identificado(a) con <strong>Cédula de Ciudadanía ${documento}</strong>, labora en nuestra empresa${fechaIngreso ? ` desde el <strong>${new Date(fechaIngreso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>` : ''}, con un contrato <strong>${tipoContrato}</strong>, desempeñando el cargo de <strong>${cargo.toUpperCase()}</strong>${salarioBase > 0 ? `, devengando un salario básico mensual de <strong>${formatearMoneda(salarioBase)}</strong> más auxilio de transporte de <strong>${formatearMoneda(AUXILIO_TRANSPORTE)}</strong>, para un total devengado de <strong>${formatearMoneda(salarioTotal)}</strong> (${numeroALetras(salarioTotal)} PESOS M/CTE)` : ''}.</p>
              
              <p>La presente certificación se expide a solicitud del interesado para los fines que estime conveniente.</p>
            </div>

            <div class="firma">
              <div class="linea-firma"></div>
              <div class="nombre-firma">${representante}</div>
              <div class="cargo-firma">Representante Legal</div>
              <div class="cargo-firma">NIT ${nitSede}</div>
              ${direccionSede ? `<div class="cargo-firma">Dirección: ${direccionSede}</div>` : ''}
              ${telefonoSede ? `<div class="cargo-firma">Teléfono: ${telefonoSede}</div>` : ''}
            </div>
          </body>
        </html>
      `);
      ventanaImpresion.document.close();
      
      setTimeout(() => {
        if (ventanaImpresion && !ventanaImpresion.closed) {
          ventanaImpresion.focus();
          ventanaImpresion.print();
        }
      }, 500);
    };

    if (cargandoSede) {
      return (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{
            width: 50, height: 50,
            border: '4px solid #e0e0e0',
            borderTop: '4px solid #c62828',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
          <p style={{ marginTop: 16, color: '#666' }}>Cargando datos...</p>
        </div>
      );
    }

    // Campo correcto: salariobase (minúsculas, sin guión)
    const salarioEmpleado = empleado?.salariobase || empleado?.salario_basico || empleado?.salarioBase || empleado?.salario || 0;
    // Auxilio de transporte legal vigente 2026 Colombia
    const AUXILIO_TRANSPORTE = 249095;
    const salarioTotal = salarioEmpleado + AUXILIO_TRANSPORTE;
    
    // Nombre: combinar nombres y apellidos
    const nombreCompleto = empleado?.nombres && empleado?.apellidos 
      ? `${empleado.nombres} ${empleado.apellidos}` 
      : (empleado?.nombre || usuario?.nombre || '');
    
    // Campos correctos según estructura tabla
    const fechaIngresoEmpleado = empleado?.fechaingreso || empleado?.fecha_ingreso || '';
    const tipoContratoEmpleado = empleado?.tipocontrato || empleado?.tipo_contrato || 'Término Indefinido';

    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 20 }}>📄 Certificación Laboral</h2>
        
        {/* Vista previa de la carta */}
        <div id="carta-print" style={{
          backgroundColor: 'white',
          border: '1px solid #ddd',
          borderRadius: 12,
          padding: '24px 32px',
          maxWidth: 700,
          margin: '0 auto',
          fontSize: 13
        }}>
          {/* Encabezado con logo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 20 }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, color: '#c62828' }}>{datosSede?.razonSocial || 'BIG BURGUER S.A.S'}</h3>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: '#666' }}>Sede: {empleado?.sede || ''}</p>
            </div>
            <img src="/logo.jpg" alt="Logo" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          </div>
          
          <div style={{ borderBottom: '2px solid #c62828', marginBottom: 16 }} />
          
          {/* Fecha */}
          <p style={{ margin: '16px 0' }}>
            Pereira, {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          
          {/* Título */}
          <h4 style={{ textAlign: 'center', margin: '24px 0', textDecoration: 'underline' }}>
            CERTIFICACIÓN LABORAL
          </h4>
          
          {/* Contenido */}
          <div style={{ lineHeight: 1.8, textAlign: 'justify' }}>
            <p>
              {datosSede?.generoRepresentante === "Femenino" ? "La suscrita" : "El suscrito"}{' '}
              <strong>{datosSede?.representanteLegal || 'REPRESENTANTE LEGAL'}</strong>, en calidad de 
              Representante Legal de <strong>{datosSede?.razonSocial || 'BIG BURGUER S.A.S'}</strong>, 
              identificad{datosSede?.generoRepresentante === "Femenino" ? "a" : "o"} con NIT{' '}
              <strong>{datosSede?.nit || ''}</strong>,
            </p>
            
            <p style={{ textAlign: 'center', margin: '20px 0', fontWeight: 'bold' }}>CERTIFICA QUE:</p>
            
            <p>
              El (la) Señor(a) <strong>{nombreCompleto.toUpperCase()}</strong>, 
              identificado(a) con <strong>Cédula de Ciudadanía {empleado?.documento || usuario?.usuario}</strong>, 
              labora en nuestra empresa
              {fechaIngresoEmpleado && (
                <> desde el <strong>{new Date(fechaIngresoEmpleado).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></>
              )}, con un contrato <strong>{tipoContratoEmpleado}</strong>, 
              desempeñando el cargo de <strong>{(empleado?.cargo || 'COLABORADOR').toUpperCase()}</strong>
              {salarioEmpleado > 0 && (
                <>, devengando un salario básico mensual de <strong>{formatearMoneda(salarioEmpleado)}</strong> más auxilio de transporte de <strong>{formatearMoneda(AUXILIO_TRANSPORTE)}</strong>, para un total devengado de <strong>{formatearMoneda(salarioTotal)}</strong></>
              )}.
            </p>
            
            <p style={{ marginTop: 16 }}>
              La presente certificación se expide a solicitud del interesado para los fines que estime conveniente.
            </p>
          </div>
          
          {/* Firma */}
          <div style={{ marginTop: 50 }}>
            <div style={{ borderTop: '1px solid #333', width: 220, paddingTop: 8 }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{datosSede?.representanteLegal || 'REPRESENTANTE LEGAL'}</p>
              <p style={{ margin: '2px 0', fontSize: 11 }}>Representante Legal</p>
              <p style={{ margin: '2px 0', fontSize: 11 }}>NIT {datosSede?.nit || ''}</p>
              {datosSede?.direccion && <p style={{ margin: '2px 0', fontSize: 11 }}>Dir: {datosSede.direccion}</p>}
              {datosSede?.telefono && <p style={{ margin: '2px 0', fontSize: 11 }}>Tel: {datosSede.telefono}</p>}
            </div>
          </div>
        </div>
        
        {/* Botón imprimir */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button
            onClick={imprimirCarta}
            style={{
              padding: '14px 32px',
              backgroundColor: '#c62828',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 'bold'
            }}
          >
            🖨️ Imprimir Certificación
          </button>
          <p style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
            La certificación se generará con los datos actuales y podrás imprimirla o guardarla como PDF.
          </p>
        </div>
      </div>
    );
  };

  // CONTRATO DE TRABAJO
  const SeccionContrato = () => {
    const [contrato, setContrato] = useState(null);
    const [cargandoContrato, setCargandoContrato] = useState(true);
    
    // Cargar contrato desde la tabla contratos
    useEffect(() => {
      const cargarContrato = async () => {
        try {
          const empleadoId = empleado?.id;
          if (!empleadoId) {
            setCargandoContrato(false);
            return;
          }
          
          const { data, error } = await supabase
            .from('contratos')
            .select('*')
            .eq('empleadoid', empleadoId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (data && !error) {
            setContrato(data);
          }
        } catch (e) {
          console.error('Error cargando contrato:', e);
        }
        setCargandoContrato(false);
      };
      
      cargarContrato();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empleado?.id]);
    
    // Función para generar e imprimir el contrato como PDF - IGUAL AL SISTEMA ORIGINAL
    const imprimirContrato = () => {
      if (!contrato?.datos) return;
      
      const datos = contrato.datos;
      const win = window.open("", "_blank", "width=900,height=700");
      if (!win) return;

      // Variables de género
      const esEmpleadoMujer = datos.generoTrabajador === "Femenino";
      const elLaTrabajador = esEmpleadoMujer ? "LA" : "EL";
      const trabajadorNombre = esEmpleadoMujer ? "TRABAJADORA" : "TRABAJADOR";
      const labelNombreTrabajador = esEmpleadoMujer ? "NOMBRE DE LA TRABAJADORA" : "NOMBRE DEL TRABAJADOR";
      const ellaEl = esEmpleadoMujer ? "ella" : "él";
      
      // URL del logo usando la URL base de la aplicación (funciona en desarrollo y producción)
      const LOGO_URL = window.location.origin + "/logo-bigburguer.jpg";

      win.document.write(`
        <html>
          <head>
            <title>${datos.tipoContrato === "Fijo" || datos.tipoContrato === "Término Fijo"
              ? "Contrato Individual de Trabajo a Término Fijo"
              : "Contrato Individual de Trabajo a Término Indefinido"} - ${datos.nombreTrabajador || ''}</title>
            <style>
              @page {
                size: letter;
                margin: 1.8cm 2cm 1.8cm 2cm;
              }
              body {
                font-family: 'Times New Roman', Times, serif;
                font-size: 11pt;
                line-height: 1.4;
                color: #000;
                text-align: justify;
                word-wrap: break-word;
                overflow-wrap: break-word;
                hyphens: auto;
              }
              .header-container { position: relative; margin-bottom: 10px; min-height: 80px; }
              .logo-header { position: absolute; top: 0; right: 0; width: 80px; height: 80px; }
              .logo-header img { width: 100%; height: 100%; object-fit: contain; border-radius: 8px; }
              h1 { text-align: center; font-size: 12pt; font-weight: bold; margin: 10px 90px 15px 0; text-transform: uppercase; letter-spacing: 0.5px; padding-top: 20px; }
              .tabla-datos { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9.5pt; table-layout: fixed; }
              .tabla-datos td { border: 1px solid #333; padding: 4px 6px; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
              .tabla-datos .label { font-weight: bold; width: 40%; background-color: #f5f5f5; }
              .tabla-datos .valor { width: 60%; }
              .intro-text { margin: 10px 0; font-size: 10.5pt; }
              .clausula { margin: 8px 0; text-align: justify; font-size: 10.5pt; }
              .clausula-titulo { font-weight: bold; text-transform: uppercase; }
              .paragrafo { margin: 6px 0 6px 15px; font-style: italic; }
              .firma-container { margin-top: 80px; display: flex; justify-content: space-between; page-break-inside: avoid; }
              .firma-box { width: 45%; text-align: center; }
              .espacio-firma { height: 80px; }
              .linea-firma { border-top: 1px solid #000; margin-bottom: 5px; width: 100%; }
              .nombre-firma { font-weight: bold; font-size: 10pt; }
              .cedula-firma { font-size: 9pt; }
              @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style>
          </head>
          <body>
            <div class="header-container">
              <div class="logo-header"><img id="logoImg" src="${LOGO_URL}" alt="BigBurguer Logo" /></div>
              <h1>CONTRATO INDIVIDUAL DE TRABAJO A TÉRMINO ${datos.tipoContrato === "Fijo" || datos.tipoContrato === "Término Fijo" ? "FIJO" : "INDEFINIDO"}</h1>
            </div>

            <table class="tabla-datos">
              <tr><td class="label">NOMBRE DEL EMPLEADOR</td><td class="valor">${datos.nombreEmpleador || ''}</td></tr>
              <tr><td class="label">NIT</td><td class="valor">${datos.nitEmpleador || ''}</td></tr>
              <tr><td class="label">DIRECCIÓN DEL EMPLEADOR</td><td class="valor">${datos.direccionEmpleador || ''}</td></tr>
              <tr><td class="label">TELÉFONO</td><td class="valor">${datos.telefonoEmpleador || ''}</td></tr>
              <tr><td class="label">REPRESENTANTE LEGAL</td><td class="valor">${datos.representanteLegal || ''}</td></tr>
              <tr><td class="label">${datos.tipoDocRepresentante ? datos.tipoDocRepresentante.toUpperCase() : "CÉDULA DE CIUDADANÍA"}</td><td class="valor">${datos.cedulaRepresentante || ''}</td></tr>
              <tr><td colspan="2" style="height:8px;border:none;"></td></tr>
              <tr><td class="label">${labelNombreTrabajador}</td><td class="valor">${datos.nombreTrabajador || ''}</td></tr>
              <tr><td class="label">${datos.tipoDocTrabajador ? datos.tipoDocTrabajador.toUpperCase() : "CÉDULA DE CIUDADANÍA"}</td><td class="valor">${datos.cedulaTrabajador || ''}</td></tr>
              <tr><td class="label">LUGAR Y FECHA NACIMIENTO</td><td class="valor">${datos.lugarFechaNacimiento || ''}</td></tr>
              <tr><td class="label">DIRECCIÓN</td><td class="valor">${datos.direccionTrabajador || ''}</td></tr>
              <tr><td class="label">TELÉFONO</td><td class="valor">${datos.telefonoTrabajador || ''}</td></tr>
              <tr><td class="label">CARGO</td><td class="valor">${datos.cargo || ''}</td></tr>
              <tr><td class="label">TIPO DE SALARIO</td><td class="valor">${datos.tipoSalario || ''}</td></tr>
              <tr><td class="label">REMUNERACIÓN SALARIAL MENSUAL</td><td class="valor">${datos.remuneracion || ''} (${datos.remuneracionLetras || ''} PESOS M/CTE)</td></tr>
              <tr><td class="label">PERÍODO DE PAGO</td><td class="valor">${datos.periodoPago || ''}</td></tr>
              <tr><td class="label">FECHA INICIACIÓN DE LABORES</td><td class="valor">${datos.fechaInicio || ''}</td></tr>
              <tr><td class="label">FECHA DE TERMINACIÓN DE LABORES</td><td class="valor">${datos.fechaTerminacion || ''}</td></tr>
              <tr><td class="label">LUGAR DE TRABAJO</td><td class="valor">${datos.lugarTrabajo || ''}</td></tr>
              <tr><td class="label">LUGAR DE CONTRATACIÓN</td><td class="valor">${datos.lugarContratacion || ''}</td></tr>
            </table>

            <p class="intro-text">Entre el EMPLEADOR y ${elLaTrabajador} ${trabajadorNombre}, de las condiciones ya dichas, identificados como aparece al pie de sus firmas, se ha celebrado el presente contrato individual de trabajo a término ${datos.tipoContrato === "Fijo" || datos.tipoContrato === "Término Fijo" ? "fijo" : "indefinido"}, regido además por las siguientes <strong>CLÁUSULAS:</strong></p>
            
            <div class="clausula"><span class="clausula-titulo">PRIMERA: OBJETO.</span> EL EMPLEADOR contrata los servicios personales de ${elLaTrabajador} ${trabajadorNombre} en el cargo reseñado y éste se obliga: a) a poner al servicio del EMPLEADOR toda su capacidad normal de trabajo en el desempeño de las funciones propias del oficio mencionado y en las labores descritas en el literal f de la presente cláusula y complementarias del mismo, de conformidad con las órdenes e instrucciones que le imparta EL EMPLEADOR directamente o través de sus representantes. Las funciones serán detalladas en Anexo al presente Contrato; b) a prestar sus servicios en forma exclusiva a EL EMPLEADOR, es decir, a no prestar directa ni indirectamente servicios laborales a otros empleadores, ni trabajar por cuenta propia en el mismo oficio, durante la vigencia de este contrato; y c) a guardar absoluta reserva y confidencialidad sobre los hechos, documentos físicos y/o electrónicos, informaciones y en general, sobre todos los asuntos y materias que lleguen a su conocimiento por causa o por ocasión de su contrato de trabajo y aun después dos (2) años de liquidado el mismo. En caso de incumplimiento de la presente obligación, ${elLaTrabajador} ${trabajadorNombre} responderá legalmente por los daños y/o perjuicios que se causen a la empresa, de conformidad con las normas vigentes en la materia. d) a reportar cualquier orden, solicitud, o novedad que reciba de su jefe inmediato o de cualquier compañero o colaborador, tendiente a realizar o encubrir actos fraudulentos o ilícitos que afecten de cualquier forma a EL EMPLEADOR. e) Dar cumplimiento a las políticas que estipule el Empleador, los cuales constan en los anexos que forman parte integral de este contrato. f) ${elLaTrabajador} ${trabajadorNombre} desempeñará las funciones tales como: Presentar el menú, conocer los ingredientes y las preparaciones, sugerir platos, presentar las recomendaciones del día y las bebidas disponibles, ser enlace entre la cocina y el cliente, debe anotar pedidos y entregarlos al comando de la cocina, cerciorarse que los platos hayan sido preparados de forma correcta, en caso de que el comensal haya hecho una petición especial, mantener comunicación continua con los clientes, prestar atención a las reacciones de los clientes y canalizar quejas o sugerencias que busquen mejorar el servicio, mantener las mesas limpias y desinfectadas antes y después de su uso por parte del cliente, y demás indicaciones que se le asignen o se le requieran, demás instrucciones dadas por el EMPLEADOR.</div>

            <div class="clausula"><span class="clausula-titulo">SEGUNDA: REMUNERACIÓN.</span> ${elLaTrabajador} ${trabajadorNombre} devengará una remuneración de UN (1) SALARIO MÍNIMO LEGAL MENSUAL VIGENTE, equivalente actualmente a la suma de ${datos.remuneracionLetras || ''} PESOS M/CTE (${datos.remuneracion || ''}).<div class="paragrafo"><strong>PARÁGRAFO PRIMERO: SALARIO ORDINARIO.</strong> Dentro del salario ordinario se encuentra incluida la remuneración de los descansos dominicales y festivos de que tratan los Capítulos I, II y III del Título VII del C.S.T. De igual manera se aclara y se conviene que en los casos en que ${elLaTrabajador} ${trabajadorNombre} devengue comisiones o cualquiera otra modalidad de salario variable, el 82.5% de dichos ingresos constituye remuneración de la labor realizada, y el 17.5% restante estará destinado a remunerar el descanso en los días dominicales y festivos de que tratan los Capítulos I y II del Título VIII del C.S.T.</div><div class="paragrafo"><strong>PARÁGRAFO SEGUNDO: SALARIO INTEGRAL.</strong> En la eventualidad en que ${elLaTrabajador} ${trabajadorNombre} devengue salario integral, se entiende de conformidad con el numeral 2 del artículo 132 del C.S.T, subrogado por el artículo 18 de la ley 50/90, que dentro del salario integral convenido se encuentra incorporado el factor prestacional de ${elLaTrabajador} ${trabajadorNombre}, el cual no será inferior al 30% del salario antes mencionado.</div><div class="paragrafo"><strong>PARÁGRAFO TERCERO:</strong> Las partes acuerdan que en los casos en que se le reconozcan a ${elLaTrabajador} ${trabajadorNombre} beneficios diferentes al salario por concepto de alimentación, comunicaciones, habitación o vivienda, transporte, vestuario, auxilios en dinero o en especie o bonificaciones ocasionales, ésos no se considerarán como factor constitutivo de salario y no se tendrán en cuenta como factor prestacional para la liquidación de acreencias laborales, ni para el pago de aportes parafiscales y cotizaciones a la seguridad social, de conformidad con los Arts. 15 y 16 de la ley 50 de 1990, en concordancia el Art. 17 de la ley 344 de 1996.</div></div>

            <div class="clausula"><span class="clausula-titulo">TERCERA: DURACIÓN DEL CONTRATO.</span> ${datos.tipoContrato === "Fijo" || datos.tipoContrato === "Término Fijo" ? "La duración del presente contrato será por el término establecido en la parte inicial del presente documento, contado a partir de la fecha de iniciación de labores. No obstante, si antes de la fecha de vencimiento del término estipulado, ninguna de las partes avisare por escrito a la otra su determinación de no prorrogar el contrato, con una antelación no inferior a treinta (30) días, éste se entenderá renovado por un período igual al inicialmente pactado." : "La duración del presente contrato será de manera indefinida, periodo entre la fecha de iniciación del contrato establecida en la parte inicial del presente documento y terminará según las razones dispuestas por la ley."}</div>

            <div class="clausula"><span class="clausula-titulo">CUARTA: TRABAJO NOCTURNO, SUPLEMENTARIO, DOMINICAL Y/O FESTIVO.</span> Todo trabajo nocturno, suplementario o en horas extras, y todo trabajo en día domingo o festivo en los que legalmente debe concederse descanso, se remunerará conforme los dispone expresamente la ley, salvo acuerdo en contrario contenido en convención, pacto colectivo o laudo arbitral. Para el reconocimiento y pago del trabajo suplementario, nocturno, dominical o festivo, EL EMPLEADOR o sus representantes deberán haberlo autorizado previamente y por escrito.</div>

            <div class="clausula"><span class="clausula-titulo">QUINTA: JORNADA DE TRABAJO.</span> ${elLaTrabajador} ${trabajadorNombre} se obliga a laborar la jornada máxima legal, salvo acuerdo especial, cumpliendo con los turnos y horarios que señale EL EMPLEADOR, quien podrá cambiarlos o ajustarlos cuando lo estime conveniente sin que ello se considere una desmejora en las condiciones laborales ${esEmpleadoMujer ? "de LA TRABAJADORA" : "del TRABAJADOR"}.</div>

            <div class="clausula"><span class="clausula-titulo">SEXTA: PERIODO DE PRUEBA.</span> Los 60 días iniciales del contrato se considera como periodo de prueba sin que exceda los límites permitidos a partir de la fecha de inicio y por consiguiente, cualquiera de las partes podrá terminar el contrato unilateralmente, en cualquier momento durante dicho periodo.</div>

            <div class="clausula"><span class="clausula-titulo">SÉPTIMA: TERMINACIÓN UNILATERAL.</span> Son justas causas para dar terminado unilateralmente este contrato, por cualquiera de las partes, las enumeradas en el Art. 62 del C.S.T., modificado por el Art. 7ª del Decreto 2351 de 1965 y además, por parte de EL EMPLEADOR, las faltas que para el efecto se califiquen como graves en reglamentos, manuales, instructivos y demás documentos que contengan reglamentaciones, órdenes, instrucciones o prohibiciones de carácter general o particular.<div class="paragrafo"><strong>PARÁGRAFO:</strong> Al finalizar el contrato de trabajo por cualquier concepto, ${elLaTrabajador} ${trabajadorNombre} autoriza descontar de su liquidación final de prestaciones sociales el valor correspondiente a los faltantes y/o deterioro anormal de elementos puestos bajo su responsabilidad.</div></div>

            <div class="clausula"><span class="clausula-titulo">OCTAVA: PROPIEDAD INTELECTUAL.</span> Las partes acuerdan que todas las invenciones, descubrimientos y trabajos originales concebidos o hechos por ${elLaTrabajador} ${trabajadorNombre} en vigencia del presente contrato pertenecerán a EL EMPLEADOR, por lo cual ${elLaTrabajador} ${trabajadorNombre} se obliga a informar a EL EMPLEADOR, de forma inmediata, sobre la existencia de dichas invenciones y/o trabajos originales.</div>

            <div class="clausula"><span class="clausula-titulo">NOVENA: MODIFICACIÓN DE LAS CONDICIONES LABORALES.</span> ${elLaTrabajador} ${trabajadorNombre} acepta desde ahora expresamente todas las modificaciones de sus condiciones laborales determinadas por EL EMPLEADOR en ejercicio de su poder subordinante, tales como el horario de trabajo, el lugar de prestación del servicio y el cargo u oficio y/o funciones, siempre que tales modificaciones no afecten su honor, dignidad o sus derechos mínimos, ni impliquen desmejoras sustanciales o graves perjuicios para ${ellaEl}.</div>

            <div class="clausula"><span class="clausula-titulo">DÉCIMA: DIRECCIÓN ${esEmpleadoMujer ? "DE LA TRABAJADORA" : "DEL TRABAJADOR"}.</span> ${elLaTrabajador} ${trabajadorNombre} se compromete a informar por escrito y de manera inmediata a EL EMPLEADOR cualquier cambio en su dirección de residencia, teniéndose en todo caso como suya, la última dirección registrada en su hoja de vida.</div>

            <div class="clausula"><span class="clausula-titulo">DÉCIMA PRIMERA: EFECTOS.</span> El presente contrato reemplaza en su integridad y deja sin efecto cualquiera otro contrato, verbal o escrito, celebrado entre las partes con anterioridad, pudiendo las partes convenir por escrito modificaciones al mismo, las que formarán parte integral de este contrato.</div>

            <div class="clausula"><span class="clausula-titulo">DÉCIMA SEGUNDA: USO DE INTERNET.</span> ${elLaTrabajador} ${trabajadorNombre}, en razón de sus funciones, tendrá acceso a Internet. ${elLaTrabajador} ${trabajadorNombre} se compromete a realizar un uso adecuado del Internet desde su computador o dispositivo móvil o cualquier otro dispositivo de la empresa con conexión a Internet. Se abstiene de usarlo para el ingreso a páginas que no sean del desarrollo de sus funciones.</div>

            <div class="clausula"><span class="clausula-titulo">DÉCIMA TERCERA: HABEAS DATA.</span> Los datos consignados en el presente Contrato serán tratados de acuerdo a lo establecido en la Ley 1581 de 2012, en el Decreto 1377 de 2013 y cualquier otra normatividad en lo que respecta a la protección de la información.</div>

            <div class="clausula"><span class="clausula-titulo">DÉCIMA CUARTA: AUTORIZACIÓN DESCUENTOS.</span> ${elLaTrabajador} ${trabajadorNombre} autoriza desde ahora al EMPLEADOR para que, de sus salarios, prestaciones sociales e indemnizaciones, le descuente, durante la vigencia del contrato o al momento de la terminación del mismo por cualquier causa, las sumas de dinero que por cualquier motivo le llegare a adeudar.</div>

            <div class="clausula"><span class="clausula-titulo">DÉCIMA QUINTA: OBLIGACIONES ESPECIALES DE CONFIDENCIALIDAD ${esEmpleadoMujer ? "DE LA TRABAJADORA" : "DEL TRABAJADOR"}.</span> ${elLaTrabajador} ${trabajadorNombre} se obliga a:<br/>a. Guardar absoluta confidencialidad respecto a: procedimientos, métodos, características, lista de clientes, fórmulas de productos y similares, al igual que claves de seguridad, suministros, software, base de datos de cualquier índole, valores de bienes y servicios, información técnica, financiera, económica o comercial del contratante o sus clientes.<br/>b. No ejercer actos de competencia desleal frente a ${datos.nombreEmpleador || ''}.<br/>c. Adoptar todas las precauciones necesarias y apropiadas para guardar la confidencialidad de la información.<br/>d. Devolver inmediatamente a la terminación de su contrato: la lista de clientes, claves, bases de datos, equipos, información técnica, y demás que tenga del empleador.<div class="paragrafo"><strong>PARÁGRAFO:</strong> El incumplimiento u omisión de cualquiera de las obligaciones aquí acordadas no solo es causal de terminación de los vínculos laborales existentes entre las partes, sino que podría conllevar a iniciar acciones judiciales en contra ${esEmpleadoMujer ? "de la trabajadora" : "del trabajador"} por los perjuicios materiales e inmateriales que cause.</div></div>

            <p style="margin-top: 25px;">Para constancia se firma en dos ejemplares del mismo tenor y valor, ante testigos en la ciudad y fecha que se indican a continuación:</p>
            <p style="margin: 15px 0;"><strong>CIUDAD:</strong> ${datos.ciudad || ''} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>FECHA:</strong> ${datos.fechaFirma || ''}</p>
            
            <div class="firma-container">
              <div class="firma-box"><div class="espacio-firma"></div><div class="linea-firma"></div><div class="nombre-firma">EMPLEADOR</div><div class="nombre-firma">${datos.representanteLegal || ''}</div><div class="cedula-firma">${datos.tipoDocRepresentante || "Cédula de Ciudadanía"} ${datos.cedulaRepresentante || ''}</div><div class="cedula-firma">Representante Legal</div></div>
              <div class="firma-box"><div class="espacio-firma"></div><div class="linea-firma"></div><div class="nombre-firma">${trabajadorNombre}</div><div class="nombre-firma">${datos.nombreTrabajador || ''}</div><div class="cedula-firma">${datos.tipoDocTrabajador || "Cédula de Ciudadanía"} ${datos.cedulaTrabajador || ''}</div></div>
            </div>

            <script>
              // Esperar a que la imagen cargue antes de imprimir
              var img = document.getElementById('logoImg');
              if (img.complete) {
                setTimeout(function() { window.print(); }, 300);
              } else {
                img.onload = function() { setTimeout(function() { window.print(); }, 300); };
                img.onerror = function() { setTimeout(function() { window.print(); }, 300); };
              }
            </script>
          </body>
        </html>
      `);
      win.document.close();
    };
    
    if (cargandoContrato) {
      return (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40 }}>⏳</div>
          <p>Cargando contrato...</p>
        </div>
      );
    }
    
    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 20 }}>📋 Contrato de Trabajo</h2>
        
        {contrato ? (
          <div>
            {/* Vista previa del contrato */}
            <div style={{
              padding: 24,
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: 12,
              marginBottom: 20
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, color: '#c62828' }}>Contrato de Trabajo</h3>
                  <p style={{ margin: '4px 0', color: '#666', fontSize: 13 }}>
                    {contrato.datos?.tipoContrato || contrato.tipocontrato || 'Término Indefinido'}
                  </p>
                </div>
                <div style={{
                  padding: '6px 12px',
                  backgroundColor: '#e8f5e9',
                  color: '#2e7d32',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 'bold'
                }}>
                  ✓ Vigente
                </div>
              </div>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: 16,
                padding: 16,
                backgroundColor: '#fafafa',
                borderRadius: 8,
                marginBottom: 20
              }}>
                <div>
                  <span style={{ color: '#666', fontSize: 11 }}>Empleado</span>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{contrato.datos?.nombreTrabajador || contrato.empleadonombre}</p>
                </div>
                <div>
                  <span style={{ color: '#666', fontSize: 11 }}>Documento</span>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{contrato.datos?.cedulaTrabajador || ''}</p>
                </div>
                <div>
                  <span style={{ color: '#666', fontSize: 11 }}>Cargo</span>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{contrato.datos?.cargo || empleado?.cargo || ''}</p>
                </div>
                <div>
                  <span style={{ color: '#666', fontSize: 11 }}>Fecha inicio</span>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{contrato.datos?.fechaInicio || ''}</p>
                </div>
                <div>
                  <span style={{ color: '#666', fontSize: 11 }}>Salario</span>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14, color: '#2e7d32' }}>{contrato.datos?.remuneracion || ''}</p>
                </div>
                <div>
                  <span style={{ color: '#666', fontSize: 11 }}>Sede</span>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{contrato.sedename || ''}</p>
                </div>
              </div>
              
              {/* Botón para imprimir/descargar */}
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={imprimirContrato}
                  style={{
                    padding: '14px 30px',
                    backgroundColor: '#c62828',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  📄 Ver / Imprimir Contrato (PDF)
                </button>
                <p style={{ color: '#666', fontSize: 12, marginTop: 10 }}>
                  Se abrirá una ventana con tu contrato listo para imprimir o guardar como PDF
                </p>
              </div>
            </div>
            
            {/* Fecha de generación */}
            <p style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
              Contrato generado el {new Date(contrato.fechageneracion || contrato.created_at).toLocaleDateString('es-CO', {
                day: 'numeric', month: 'long', year: 'numeric'
              })}
            </p>
          </div>
        ) : (
          <div style={{
            padding: 40,
            backgroundColor: '#fff3e0',
            borderRadius: 12,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>📭</div>
            <h3 style={{ color: '#e65100' }}>Contrato no disponible</h3>
            <p style={{ color: '#666' }}>
              Tu contrato aún no ha sido generado en el sistema.<br />
              Por favor, contacta al área de Recursos Humanos.
            </p>
          </div>
        )}
      </div>
    );
  };

  // MIS HORARIOS - Vista tipo Calendario
  const SeccionHorarios = () => {
    const [eventos, setEventos] = useState({});
    const diasSemanaCorto = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    // Festivos de Colombia 2026 (Ley 51 de 1983)
    const festivosColombia2026 = {
      '2026-01-01': 'Año Nuevo',
      '2026-01-12': 'Día de los Reyes Magos',
      '2026-03-23': 'Día de San José',
      '2026-04-02': 'Jueves Santo',
      '2026-04-03': 'Viernes Santo',
      '2026-05-01': 'Día del Trabajo',
      '2026-05-18': 'Ascensión del Señor',
      '2026-06-08': 'Corpus Christi',
      '2026-06-15': 'Sagrado Corazón',
      '2026-06-29': 'San Pedro y San Pablo',
      '2026-07-20': 'Día de la Independencia',
      '2026-08-07': 'Batalla de Boyacá',
      '2026-08-17': 'Asunción de la Virgen',
      '2026-10-12': 'Día de la Raza',
      '2026-11-02': 'Todos los Santos',
      '2026-11-16': 'Independencia de Cartagena',
      '2026-12-08': 'Inmaculada Concepción',
      '2026-12-25': 'Navidad',
      // 2025
      '2025-12-08': 'Inmaculada Concepción',
      '2025-12-25': 'Navidad',
    };
    
    // Cargar eventos desde horarios
    useEffect(() => {
      const cargarEventos = async () => {
        try {
          const hoy = new Date();
          const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
          const fechaInicio = mesAnterior.toISOString().split('T')[0];
          
          const { data } = await supabase
            .from('horarios')
            .select('eventos, eventos_por_dia, semana_inicio, semana_fin')
            .gte('semana_fin', fechaInicio)
            .order('semana_inicio', { ascending: false });
          
          if (data) {
            const todosEventos = {};
            data.forEach(semana => {
              // Eventos generales
              if (semana.eventos && typeof semana.eventos === 'object') {
                Object.entries(semana.eventos).forEach(([fecha, evento]) => {
                  todosEventos[fecha] = evento;
                });
              }
              // Eventos por día
              if (semana.eventos_por_dia && typeof semana.eventos_por_dia === 'object') {
                Object.entries(semana.eventos_por_dia).forEach(([fecha, evento]) => {
                  todosEventos[fecha] = evento;
                });
              }
            });
            setEventos(todosEventos);
          }
        } catch (e) {
          console.log('Error cargando eventos:', e);
        }
      };
      cargarEventos();
    }, []);
    
    // Función para convertir hora 24h a formato AM/PM
    const formatearHora = (hora) => {
      if (!hora) return '';
      const [h, m] = hora.split(':');
      const hora24 = parseInt(h);
      const minutos = m || '00';
      const periodo = hora24 >= 12 ? 'PM' : 'AM';
      const hora12 = hora24 === 0 ? 12 : hora24 > 12 ? hora24 - 12 : hora24;
      return `${hora12}:${minutos}${periodo}`;
    };
    
    // Crear mapa de horarios por fecha para acceso rápido
    const horariosPorFecha = {};
    horarios.forEach(h => {
      horariosPorFecha[h.fecha] = h;
    });
    
    // Generar semanas para el mes actual y anterior
    const generarSemanasDelMes = (year, month) => {
      const semanas = [];
      const primerDia = new Date(year, month, 1);
      const ultimoDia = new Date(year, month + 1, 0);
      
      // Empezar desde el domingo de la semana del primer día
      const inicioSemana = new Date(primerDia);
      inicioSemana.setDate(primerDia.getDate() - primerDia.getDay());
      
      let semanaActual = [];
      const fechaIterador = new Date(inicioSemana);
      
      while (fechaIterador <= ultimoDia || semanaActual.length > 0) {
        semanaActual.push(new Date(fechaIterador));
        
        if (semanaActual.length === 7) {
          semanas.push(semanaActual);
          semanaActual = [];
          if (fechaIterador > ultimoDia) break;
        }
        
        fechaIterador.setDate(fechaIterador.getDate() + 1);
      }
      
      return semanas;
    };
    
    const hoy = new Date();
    const mesActual = { year: hoy.getFullYear(), month: hoy.getMonth() };
    const mesAnterior = hoy.getMonth() === 0 
      ? { year: hoy.getFullYear() - 1, month: 11 }
      : { year: hoy.getFullYear(), month: hoy.getMonth() - 1 };
    
    const semanasActual = generarSemanasDelMes(mesActual.year, mesActual.month);
    const semanasAnterior = generarSemanasDelMes(mesAnterior.year, mesAnterior.month);
    
    const renderizarCalendario = (semanas, year, month) => {
      const hoyStr = hoy.toISOString().split('T')[0];
      
      return (
        <div style={{ marginBottom: 30 }}>
          <h3 style={{ 
            color: '#c62828', 
            fontSize: 20,
            marginBottom: 15,
            textAlign: 'center',
            backgroundColor: '#ffebee',
            padding: '12px 0',
            borderRadius: 8
          }}>
            📆 {meses[month]} {year}
          </h3>
          
          {/* Encabezados de días */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            gap: 2,
            marginBottom: 2
          }}>
            {diasSemanaCorto.map((dia, idx) => (
              <div key={dia} style={{
                padding: '10px 4px',
                backgroundColor: idx === 0 ? '#ffcdd2' : '#c62828',
                color: idx === 0 ? '#c62828' : 'white',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: 14
              }}>
                {dia}
              </div>
            ))}
          </div>
          
          {/* Semanas */}
          {semanas.map((semana, semanaIdx) => (
            <div key={semanaIdx} style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(7, 1fr)', 
              gap: 2,
              marginBottom: 2
            }}>
              {semana.map((fecha, diaIdx) => {
                const fechaStr = fecha.toISOString().split('T')[0];
                const esDelMes = fecha.getMonth() === month;
                const esHoy = fechaStr === hoyStr;
                const horario = horariosPorFecha[fechaStr];
                const esPasado = fechaStr < hoyStr;
                const esDomingo = diaIdx === 0;
                const festivo = festivosColombia2026[fechaStr];
                const evento = eventos[fechaStr];
                const esFestivo = !!festivo;
                
                // Determinar color de fondo
                let bgColor = 'white';
                if (!esDelMes) bgColor = '#f5f5f5';
                else if (esHoy) bgColor = '#fff3e0';
                else if (esFestivo) bgColor = '#fff9c4'; // Amarillo para festivos
                else if (esDomingo) bgColor = '#ffebee'; // Rojo claro para domingos
                
                return (
                  <div key={diaIdx} style={{
                    minHeight: 100,
                    padding: 6,
                    backgroundColor: bgColor,
                    border: esHoy ? '3px solid #ff9800' : esFestivo ? '2px solid #f9a825' : esDomingo ? '2px solid #ef9a9a' : '1px solid #e0e0e0',
                    opacity: !esDelMes ? 0.4 : esPasado ? 0.7 : 1,
                    position: 'relative'
                  }}>
                    {/* Número del día */}
                    <div style={{
                      fontWeight: '900',
                      fontSize: 22,
                      color: esHoy ? '#ff9800' : esFestivo ? '#f9a825' : esDomingo ? '#d32f2f' : '#555',
                      marginBottom: 4,
                      textShadow: '0 1px 1px rgba(0,0,0,0.1)'
                    }}>
                      {fecha.getDate()}
                      {esHoy && <span style={{ fontSize: 11, marginLeft: 4, fontWeight: 'bold' }}>HOY</span>}
                    </div>
                    
                    {/* Indicador de festivo */}
                    {esFestivo && esDelMes && (
                      <div style={{
                        fontSize: 8,
                        color: '#f57f17',
                        fontWeight: 'bold',
                        marginBottom: 3,
                        lineHeight: 1.1
                      }}>
                        🎉 {festivo}
                      </div>
                    )}
                    
                    {/* Evento programado */}
                    {evento && esDelMes && (
                      <div style={{
                        fontSize: 9,
                        backgroundColor: evento.color || '#9c27b0',
                        color: 'white',
                        padding: '2px 4px',
                        borderRadius: 3,
                        marginBottom: 3,
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>
                        {evento.nombre || evento.titulo || evento}
                      </div>
                    )}
                    
                    {/* Contenido del horario */}
                    {horario && esDelMes && (
                      <div style={{ fontSize: 12 }}>
                        {horario.es_descanso ? (
                          <div style={{
                            backgroundColor: '#c8e6c9',
                            color: '#1b5e20',
                            padding: '6px 6px',
                            borderRadius: 4,
                            textAlign: 'center',
                            fontWeight: '800',
                            fontSize: 12
                          }}>
                            🌴 Descanso
                          </div>
                        ) : horario.turno_partido ? (
                          <div>
                            <div style={{
                              backgroundColor: '#ffcdd2',
                              color: '#b71c1c',
                              padding: '4px 5px',
                              borderRadius: 3,
                              marginBottom: 3,
                              fontWeight: '800',
                              fontSize: 11,
                              textAlign: 'center',
                              textShadow: '0 0 1px rgba(0,0,0,0.2)'
                            }}>
                              {formatearHora(horario.hora_inicio)}-{formatearHora(horario.hora_fin)}
                            </div>
                            <div style={{
                              backgroundColor: '#bbdefb',
                              color: '#0d47a1',
                              padding: '4px 5px',
                              borderRadius: 3,
                              fontWeight: '800',
                              fontSize: 11,
                              textAlign: 'center',
                              textShadow: '0 0 1px rgba(0,0,0,0.2)'
                            }}>
                              {formatearHora(horario.segundo_turno.hora_inicio)}-{formatearHora(horario.segundo_turno.hora_fin)}
                            </div>
                            <div style={{ 
                              fontSize: 9, 
                              color: '#e65100', 
                              textAlign: 'center',
                              marginTop: 3,
                              fontWeight: 'bold'
                            }}>
                              ⚡ Partido
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            backgroundColor: '#ffcdd2',
                            color: '#b71c1c',
                            padding: '5px 6px',
                            borderRadius: 4,
                            textAlign: 'center',
                            fontWeight: '800',
                            fontSize: 12,
                            textShadow: '0 0 1px rgba(0,0,0,0.2)'
                          }}>
                            {formatearHora(horario.hora_inicio)}
                            <br/>
                            {formatearHora(horario.hora_fin)}
                            {horario.sede && (
                              <div style={{ fontSize: 10, color: '#333', marginTop: 3, fontWeight: '600' }}>
                                {horario.sede}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );
    };
    
    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 10 }}>🕐 Mis Horarios</h2>
        
        <p style={{ color: '#666', marginBottom: 20, fontSize: 14 }}>
          📅 Calendario de horarios - Mes actual y mes anterior
        </p>
        
        {horarios.length === 0 ? (
          <div style={{
            padding: 40,
            backgroundColor: '#f5f5f5',
            borderRadius: 12,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>📅</div>
            <h3>No hay horarios programados</h3>
            <p style={{ color: '#666' }}>
              Aún no tienes horarios asignados.<br />
              Los horarios aparecerán aquí cuando sean programados por tu supervisor.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {/* Leyenda */}
            <div style={{ 
              display: 'flex', 
              gap: 15, 
              marginBottom: 20,
              flexWrap: 'wrap',
              padding: '12px 15px',
              backgroundColor: '#fafafa',
              borderRadius: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#ffcdd2', border: '2px solid #ef9a9a', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11, fontWeight: '500' }}>Domingo</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#fff9c4', border: '2px solid #f9a825', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11, fontWeight: '500' }}>🎉 Festivo</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#ffebee', border: '1px solid #c62828', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11 }}>Turno</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#c8e6c9', border: '1px solid #2e7d32', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11 }}>Descanso</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#fff3e0', border: '3px solid #ff9800', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11 }}>Hoy</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#9c27b0', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11 }}>Evento</span>
              </div>
            </div>
            
            {/* Mes Actual */}
            {renderizarCalendario(semanasActual, mesActual.year, mesActual.month)}
            
            {/* Mes Anterior */}
            {renderizarCalendario(semanasAnterior, mesAnterior.year, mesAnterior.month)}
          </div>
        )}
      </div>
    );
  };

  // RADICAR SOLICITUD
  const SeccionSolicitudes = () => {
    const [pestanaActiva, setPestanaActiva] = useState('radicar'); // 'radicar' | 'estado'
    const [tipoSolicitud, setTipoSolicitud] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [archivosAdjuntos, setArchivosAdjuntos] = useState([]);
    const [subiendoArchivo, setSubiendoArchivo] = useState(false);
    const [cargandoSolicitudes, setCargandoSolicitudes] = useState(false);

    // Cargar solicitudes cuando se cambia a la pestaña estado
    useEffect(() => {
      if (pestanaActiva === 'estado') {
        const cargarMisSolicitudes = async () => {
          setCargandoSolicitudes(true);
          const doc = empleado?.documento || usuario?.usuario;
          if (doc) {
            await cargarSolicitudes(doc);
          }
          setCargandoSolicitudes(false);
        };
        cargarMisSolicitudes();
      }
    }, [pestanaActiva]);

    const tiposSolicitud = [
      { id: 'permiso', nombre: 'Permiso', icono: '🙋' },
      { id: 'vacaciones', nombre: 'Vacaciones', icono: '🏖️' },
      { id: 'licencia', nombre: 'Licencia', icono: '📋' },
      { id: 'cambio_horario', nombre: 'Cambio de Horario', icono: '🕐' },
      { id: 'certificado', nombre: 'Certificado Laboral', icono: '📄' },
      { id: 'otro', nombre: 'Otra Solicitud', icono: '📝' },
    ];

    // Subir archivo a Supabase Storage
    const subirArchivo = async (archivo) => {
      setSubiendoArchivo(true);
      try {
        const nombreArchivo = `solicitudes/${Date.now()}_${archivo.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error } = await supabase.storage
          .from('empleados-docs')
          .upload(nombreArchivo, archivo);
        
        if (error) throw error;
        
        const { data: urlData } = supabase.storage
          .from('empleados-docs')
          .getPublicUrl(nombreArchivo);
        
        setArchivosAdjuntos(prev => [...prev, {
          nombre: archivo.name,
          url: urlData.publicUrl,
          tipo: archivo.type,
          tamaño: archivo.size
        }]);
      } catch (error) {
        console.error('Error subiendo archivo:', error);
        alert('❌ Error al subir el archivo');
      }
      setSubiendoArchivo(false);
    };

    const eliminarArchivo = (index) => {
      setArchivosAdjuntos(prev => prev.filter((_, i) => i !== index));
    };

    const enviarSolicitud = async (e) => {
      e.preventDefault();
      setEnviando(true);
      
      try {
        const { data, error } = await supabase
          .from('solicitudes_empleados')
          .insert({
            usuario_id: usuario.id,
            documento: empleado?.documento || usuario.usuario,
            empleado_nombre: empleado?.nombre || usuario.nombre,
            tipo: tipoSolicitud,
            descripcion,
            fecha_inicio: fechaInicio || null,
            fecha_fin: fechaFin || null,
            estado: 'recibido',
            fecha_creacion: new Date().toISOString(),
            empresa_id: empleado?.empresa_id || usuario.empresa_id,
            archivos_adjuntos: JSON.stringify(archivosAdjuntos)
          })
          .select('id')
          .single();
        
        if (!error) {
          alert('✅ Solicitud radicada correctamente. Número de radicado: ' + data.id.substring(0, 8).toUpperCase());
          setPestanaActiva('estado');
          setTipoSolicitud('');
          setDescripcion('');
          setFechaInicio('');
          setFechaFin('');
          setArchivosAdjuntos([]);
          await cargarSolicitudes(empleado?.documento || usuario.usuario);
        } else {
          console.error('Error:', error);
          alert('❌ Error al enviar la solicitud');
        }
      } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al enviar la solicitud');
      }
      setEnviando(false);
    };

    const getEstadoColor = (estado) => {
      switch (estado) {
        case 'aprobado': 
        case 'aprobada': return { bg: '#e8f5e9', color: '#2e7d32', texto: '✅ APROBADO', icono: '✅' };
        case 'negado':
        case 'rechazada': return { bg: '#ffebee', color: '#c62828', texto: '❌ NEGADO', icono: '❌' };
        case 'en_proceso': return { bg: '#e3f2fd', color: '#1565c0', texto: '🔄 EN PROCESO', icono: '🔄' };
        case 'recibido': return { bg: '#fff3e0', color: '#e65100', texto: '📥 RECIBIDO', icono: '📥' };
        default: return { bg: '#f5f5f5', color: '#666', texto: '⏳ PENDIENTE', icono: '⏳' };
      }
    };

    return (
      <div>
        {/* Header con pestañas */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ color: '#c62828', margin: '0 0 16px 0' }}>📝 Solicitudes</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setPestanaActiva('radicar')}
              style={{
                padding: '12px 24px',
                backgroundColor: pestanaActiva === 'radicar' ? '#c62828' : '#f5f5f5',
                color: pestanaActiva === 'radicar' ? 'white' : '#333',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14
              }}
            >
              📤 Radicar Solicitud
            </button>
            <button
              onClick={() => setPestanaActiva('estado')}
              style={{
                padding: '12px 24px',
                backgroundColor: pestanaActiva === 'estado' ? '#c62828' : '#f5f5f5',
                color: pestanaActiva === 'estado' ? 'white' : '#333',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
                position: 'relative'
              }}
            >
              📋 Estado Solicitudes
              {solicitudes.filter(s => s.estado === 'recibido' || s.estado === 'en_proceso').length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  backgroundColor: '#ff9800',
                  color: 'white',
                  borderRadius: '50%',
                  width: 20,
                  height: 20,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {solicitudes.filter(s => s.estado === 'recibido' || s.estado === 'en_proceso').length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Contenedor con borde superior que conecta con las pestañas */}
        <div style={{ 
          backgroundColor: 'white', 
          border: '1px solid #e0e0e0', 
          borderRadius: '0 12px 12px 12px',
          padding: 24
        }}>
          {/* Pestaña Radicar Solicitud */}
          {pestanaActiva === 'radicar' && (
            <div>
              <h3 style={{ color: '#c62828', marginBottom: 20, marginTop: 0 }}>Nueva Solicitud</h3>
              
              <form onSubmit={enviarSolicitud}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                    Tipo de solicitud *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {tiposSolicitud.map(tipo => (
                      <button
                        key={tipo.id}
                        type="button"
                        onClick={() => setTipoSolicitud(tipo.id)}
                        style={{
                          padding: 16,
                          backgroundColor: tipoSolicitud === tipo.id ? '#ffebee' : '#f5f5f5',
                          border: tipoSolicitud === tipo.id ? '2px solid #d32f2f' : '1px solid #e0e0e0',
                          borderRadius: 8,
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: 24 }}>{tipo.icono}</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>{tipo.nombre}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {(tipoSolicitud === 'permiso' || tipoSolicitud === 'vacaciones' || tipoSolicitud === 'licencia') && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                        Fecha inicio
                      </label>
                      <input
                        type="date"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        style={{
                          width: '100%',
                          padding: 12,
                          border: '1px solid #ddd',
                          borderRadius: 8,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                        Fecha fin
                      </label>
                      <input
                        type="date"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        style={{
                          width: '100%',
                          padding: 12,
                          border: '1px solid #ddd',
                          borderRadius: 8,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                )}
                
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                    Descripción / Motivo *
                  </label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    required
                    rows={4}
                    placeholder="Describe el motivo de tu solicitud..."
                    style={{
                      width: '100%',
                      padding: 12,
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Sección de archivos adjuntos */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                    📎 Archivos Adjuntos (opcional)
                  </label>
                  <div style={{
                    border: '2px dashed #ddd',
                    borderRadius: 8,
                    padding: 20,
                    textAlign: 'center',
                    backgroundColor: '#fafafa'
                  }}>
                    <input
                      type="file"
                      id="archivo-solicitud"
                      multiple
                      onChange={async (e) => {
                        const files = Array.from(e.target.files);
                        for (const file of files) {
                          await subirArchivo(file);
                        }
                        e.target.value = '';
                      }}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="archivo-solicitud"
                      style={{
                        display: 'inline-block',
                        padding: '10px 20px',
                        backgroundColor: '#f5f5f5',
                        border: '1px solid #ddd',
                        borderRadius: 8,
                        cursor: 'pointer'
                      }}
                    >
                      {subiendoArchivo ? '⏳ Subiendo...' : '📁 Seleccionar archivos'}
                    </label>
                    <p style={{ margin: '10px 0 0', fontSize: 12, color: '#999' }}>
                      PDF, imágenes, documentos (máx. 5MB por archivo)
                    </p>
                  </div>
                  
                  {/* Lista de archivos adjuntos */}
                  {archivosAdjuntos.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      {archivosAdjuntos.map((archivo, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          backgroundColor: '#e8f5e9',
                          borderRadius: 6,
                          marginBottom: 6
                        }}>
                          <span style={{ fontSize: 13 }}>
                            📄 {archivo.nombre}
                          </span>
                          <button
                            type="button"
                            onClick={() => eliminarArchivo(idx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#c62828',
                              cursor: 'pointer',
                              fontSize: 16
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <button
                  type="submit"
                  disabled={!tipoSolicitud || !descripcion || enviando}
                  style={{
                    padding: '14px 32px',
                    backgroundColor: '#c62828',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 16,
                    opacity: (!tipoSolicitud || !descripcion || enviando) ? 0.5 : 1
                  }}
                >
                  {enviando ? '⏳ Enviando...' : '📤 Enviar Solicitud'}
                </button>
              </form>
            </div>
          )}

          {/* Pestaña Estado de Solicitudes */}
          {pestanaActiva === 'estado' && (
            <div>
              {cargandoSolicitudes ? (
                <div style={{
                  padding: 40,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
                  <p>Cargando solicitudes...</p>
                </div>
              ) : solicitudes.length === 0 ? (
                <div style={{
                  padding: 40,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 12,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 60, marginBottom: 16 }}>📭</div>
                  <h3>No tienes solicitudes</h3>
                  <p style={{ color: '#666' }}>
                    Aún no has radicado ninguna solicitud.
                  </p>
                  <button
                    onClick={() => setPestanaActiva('radicar')}
                    style={{
                      marginTop: 16,
                      padding: '12px 24px',
                      backgroundColor: '#c62828',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer'
                    }}
                  >
                    📤 Radicar mi primera solicitud
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {solicitudes.map(sol => {
                    const estadoStyle = getEstadoColor(sol.estado);
                    const tiposSolicitudMap = {
                      permiso: { nombre: 'Permiso', icono: '🙋' },
                      vacaciones: { nombre: 'Vacaciones', icono: '🏖️' },
                      licencia: { nombre: 'Licencia', icono: '📋' },
                      cambio_horario: { nombre: 'Cambio de Horario', icono: '🕐' },
                      certificado: { nombre: 'Certificado Laboral', icono: '📄' },
                      otro: { nombre: 'Otra Solicitud', icono: '📝' }
                    };
                    const tipo = tiposSolicitudMap[sol.tipo] || { nombre: sol.tipo, icono: '📝' };
                    
                    return (
                      <div
                        key={sol.id}
                        style={{
                          padding: 16,
                          backgroundColor: '#fafafa',
                          border: '1px solid #e0e0e0',
                          borderRadius: 12
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 20 }}>{tipo.icono}</span>
                              <span style={{ fontWeight: 'bold', color: '#c62828' }}>
                                {tipo.nombre}
                              </span>
                            </div>
                            <p style={{ margin: '8px 0', color: '#666', fontSize: 14 }}>
                              {sol.descripcion}
                            </p>
                            <div style={{ fontSize: 12, color: '#999' }}>
                              📅 Radicada: {new Date(sol.fecha_creacion).toLocaleDateString('es-CO')}
                              {sol.fecha_inicio && ` | Del ${sol.fecha_inicio} al ${sol.fecha_fin}`}
                            </div>
                          </div>
                          <span style={{
                            padding: '6px 12px',
                            backgroundColor: estadoStyle.bg,
                            color: estadoStyle.color,
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            {estadoStyle.icono} {sol.estado?.toUpperCase()}
                          </span>
                        </div>
                        
                        {/* Archivos adjuntos de la solicitud */}
                        {sol.archivos_adjuntos && sol.archivos_adjuntos.length > 0 && (
                          <div style={{ marginTop: 12, padding: 10, backgroundColor: '#e3f2fd', borderRadius: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>📎 Archivos adjuntos:</div>
                            {sol.archivos_adjuntos.map((arch, idx) => (
                              <a
                                key={idx}
                                href={arch.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-block',
                                  margin: '2px 4px',
                                  padding: '4px 8px',
                                  backgroundColor: 'white',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  color: '#1976d2',
                                  textDecoration: 'none'
                                }}
                              >
                                📄 {arch.nombre}
                              </a>
                            ))}
                          </div>
                        )}

                        {sol.respuesta && (
                          <div style={{
                            marginTop: 12,
                            padding: 12,
                            backgroundColor: sol.estado === 'aprobado' ? '#e8f5e9' : sol.estado === 'negado' ? '#ffebee' : '#fff3e0',
                            borderRadius: 8,
                            fontSize: 13
                          }}>
                            <strong>💬 Respuesta de RRHH:</strong> {sol.respuesta}
                            {sol.fecha_respuesta && (
                              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                                Respondido: {new Date(sol.fecha_respuesta).toLocaleDateString('es-CO')}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Archivos adjuntos de la respuesta */}
                        {sol.archivos_respuesta && sol.archivos_respuesta.length > 0 && (
                          <div style={{ marginTop: 8, padding: 10, backgroundColor: '#fff8e1', borderRadius: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>📎 Archivos de respuesta:</div>
                            {sol.archivos_respuesta.map((arch, idx) => (
                              <a
                                key={idx}
                                href={arch.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-block',
                                  margin: '2px 4px',
                                  padding: '4px 8px',
                                  backgroundColor: 'white',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  color: '#f57c00',
                                  textDecoration: 'none'
                                }}
                              >
                                📄 {arch.nombre}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // REGLAMENTO INTERNO
  const SeccionReglamento = () => {
    const reglamentoUrl = configEmpresa?.reglamento_url;
    
    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 20 }}>📖 Reglamento Interno de Trabajo</h2>
        
        {reglamentoUrl ? (
          <div style={{
            padding: 24,
            backgroundColor: '#f5f5f5',
            borderRadius: 12,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>📖</div>
            <h3>Reglamento Interno de Trabajo</h3>
            <p style={{ color: '#666', marginBottom: 20 }}>
              Descarga el reglamento interno de trabajo de la empresa.
            </p>
            <a
              href={reglamentoUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                backgroundColor: '#c62828',
                color: 'white',
                textDecoration: 'none',
                borderRadius: 8
              }}
            >
              📥 Descargar Reglamento
            </a>
          </div>
        ) : (
          <div style={{
            padding: 40,
            backgroundColor: '#fff3e0',
            borderRadius: 12,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>📭</div>
            <h3 style={{ color: '#e65100' }}>Reglamento no disponible</h3>
            <p style={{ color: '#666' }}>
              El reglamento interno aún no ha sido cargado al sistema.<br />
              Por favor, contacta al área de Recursos Humanos.
            </p>
          </div>
        )}
        
        {/* Información básica */}
        <div style={{
          marginTop: 24,
          padding: 20,
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: 12
        }}>
          <h4 style={{ color: '#c62828', marginBottom: 16 }}>ℹ️ Información Importante</h4>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
            <li>Todos los empleados deben conocer y cumplir el reglamento interno.</li>
            <li>El incumplimiento del reglamento puede generar sanciones disciplinarias.</li>
            <li>Cualquier duda sobre el reglamento debe consultarse con Recursos Humanos.</li>
          </ul>
        </div>
      </div>
    );
  };

  // FORMATOS
  const SeccionFormatos = () => {
    const [formatosDisponibles, setFormatosDisponibles] = useState([]);
    
    useEffect(() => {
      cargarFormatos();
    }, []);
    
    const cargarFormatos = async () => {
      try {
        const { data } = await supabase
          .from('formatos_intranet')
          .select('*')
          .eq('activo', true)
          .order('nombre');
        if (data) setFormatosDisponibles(data);
      } catch (e) {
        // Si no existe la tabla, mostrar formatos de ejemplo
        setFormatosDisponibles([
          { id: 'formato_permiso', nombre: 'Formato Solicitud de Permiso', icono: '📝' },
          { id: 'formato_vacaciones', nombre: 'Formato Solicitud de Vacaciones', icono: '🏖️' },
          { id: 'formato_licencia', nombre: 'Formato Solicitud de Licencia', icono: '📋' },
          { id: 'formato_incapacidad', nombre: 'Formato Reporte de Incapacidad', icono: '🏥' },
          { id: 'formato_horas_extra', nombre: 'Formato Autorización Horas Extra', icono: '⏰' },
        ]);
      }
    };

    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 20 }}>📁 Formatos</h2>
        
        <p style={{ color: '#666', marginBottom: 20 }}>
          Descarga los formatos que necesites para tus trámites internos.
        </p>
        
        {formatosDisponibles.length === 0 ? (
          <div style={{
            padding: 40,
            backgroundColor: '#f5f5f5',
            borderRadius: 12,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>📭</div>
            <h3>No hay formatos disponibles</h3>
            <p style={{ color: '#666' }}>
              Los formatos aparecerán aquí cuando sean cargados por Recursos Humanos.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {formatosDisponibles.map(formato => (
              <div
                key={formato.id}
                style={{
                  padding: 16,
                  backgroundColor: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 32 }}>{formato.icono || '📄'}</span>
                  <div>
                    <span style={{ fontWeight: 'bold', color: '#c62828' }}>{formato.nombre}</span>
                    {formato.descripcion && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>{formato.descripcion}</p>
                    )}
                  </div>
                </div>
                {formato.url ? (
                  <a
                    href={formato.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ffebee',
                      color: '#d32f2f',
                      border: 'none',
                      borderRadius: 8,
                      textDecoration: 'none'
                    }}
                  >
                    📥 Descargar
                  </a>
                ) : (
                  <span style={{ color: '#999', fontSize: 12 }}>No disponible</span>
                )}
              </div>
            ))}
          </div>
        )}
        
        <div style={{
          marginTop: 24,
          padding: 16,
          backgroundColor: '#e8f5e9',
          borderRadius: 12
        }}>
          <p style={{ margin: 0, color: '#2e7d32' }}>
            💡 <strong>Tip:</strong> Los formatos descargados pueden ser llenados digitalmente o impresos para diligenciar a mano.
          </p>
        </div>
      </div>
    );
  };

  // Renderizar sección activa
  const renderSeccion = () => {
    switch (seccionActiva) {
      case 'inicio': return <SeccionInicio />;
      case 'desprendible': return <SeccionDesprendible />;
      case 'carta-laboral': return <SeccionCartaLaboral />;
      case 'contrato': return <SeccionContrato />;
      case 'horarios': return <SeccionHorarios />;
      case 'solicitudes': return <SeccionSolicitudes />;
      case 'reglamento': return <SeccionReglamento />;
      case 'formatos': return <SeccionFormatos />;
      default: return <SeccionInicio />;
    }
  };

  // ============================================
  // RENDER PRINCIPAL
  // ============================================
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#c62828',
        color: 'white',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => setMenuAbierto(!menuAbierto)}
            style={{
              padding: 8,
              backgroundColor: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: 24,
              display: 'none'
            }}
            className="menu-toggle"
          >
            ☰
          </button>
          <img 
            src="/logo.jpg" 
            alt="Big Burguer" 
            style={{ 
              width: 40, 
              height: 40, 
              borderRadius: '50%', 
              objectFit: 'cover',
              border: '2px solid white'
            }} 
          />
          <h1 style={{ margin: 0, fontSize: 18 }}>
            Portal del Empleado
          </h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 14 }}>{empleado?.nombre || usuario?.nombre}</span>
          <button
            onClick={cerrarSesion}
            style={{
              padding: '6px 12px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: 6,
              color: 'white',
              cursor: 'pointer'
            }}
          >
            🚪 Salir
          </button>
        </div>
      </header>
      
      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <aside style={{
          width: 260,
          backgroundColor: 'white',
          minHeight: 'calc(100vh - 56px)',
          borderRight: '1px solid #e0e0e0',
          padding: '20px 0'
        }}>
          <nav>
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => setSeccionActiva(item.id)}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  backgroundColor: seccionActiva === item.id ? '#ffebee' : 'transparent',
                  border: 'none',
                  borderLeft: seccionActiva === item.id ? '4px solid #c62828' : '4px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  color: seccionActiva === item.id ? '#c62828' : '#333',
                  fontWeight: seccionActiva === item.id ? 'bold' : 'normal'
                }}
              >
                <span style={{ fontSize: 20 }}>{item.icono}</span>
                <span>{item.nombre}</span>
              </button>
            ))}
          </nav>
          
          {/* Info empresa */}
          <div style={{
            margin: '20px 16px',
            padding: 16,
            backgroundColor: '#f5f5f5',
            borderRadius: 12,
            fontSize: 12
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
              {configEmpresa?.nombre_empresa || empresa?.nombre || 'Empresa'}
            </div>
            <div style={{ color: '#666' }}>{empleado?.sede || ''}</div>
          </div>
        </aside>
        
        {/* Contenido principal */}
        <main style={{
          flex: 1,
          padding: 24,
          maxWidth: 900
        }}>
          {cargando ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{
                width: 50,
                height: 50,
                border: '4px solid #e0e0e0',
                borderTop: '4px solid #c62828',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }} />
              <p style={{ marginTop: 16, color: '#666' }}>Cargando...</p>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            renderSeccion()
          )}
        </main>
      </div>
      
      {/* Estilos para impresión */}
      <style>{`
        @media print {
          header, aside, button { display: none !important; }
          main { padding: 0 !important; max-width: 100% !important; }
          #desprendible-print, #carta-print { 
            border: none !important; 
            box-shadow: none !important;
          }
        }
        
        @media (max-width: 768px) {
          aside { display: none; }
          .menu-toggle { display: block !important; }
        }
      `}</style>
    </div>
  );
}

export default App;
