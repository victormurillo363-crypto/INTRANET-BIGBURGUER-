
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
  
  // Estados para cambio de contraseña obligatorio (primer inicio de sesión)
  const [mostrarCambioPassword, setMostrarCambioPassword] = useState(false);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [errorCambioPassword, setErrorCambioPassword] = useState('');
  const [usuarioTemporal, setUsuarioTemporal] = useState(null);
  
  // Estados para datos
  const [nominas, setNominas] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [configEmpresa, setConfigEmpresa] = useState(null);
  const [pestanaSolicitudes, setPestanaSolicitudes] = useState('radicar'); // 'radicar' | 'estado'
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(false);
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const [avisos, setAvisos] = useState([]);
  const [avisoSeleccionado, setAvisoSeleccionado] = useState(null);
  
  // Estado para eventos programados del empleado (CONGELADOR, CAMPANA, etc.)
  const [eventosEmpleado, setEventosEmpleado] = useState({});
  
  // Estado para ausencias del empleado (incapacidades, vacaciones, permisos)
  const [ausencias, setAusencias] = useState([]);
  
  // Estado para bloqueos de módulos por empleado
  const [bloqueosModulos, setBloqueosModulos] = useState([]);
  
  // Estados para cumpleaños de empleados
  const [mostrarCumpleanos, setMostrarCumpleanos] = useState(false);
  const [empleadosCumple, setEmpleadosCumple] = useState([]);

  // ============================================
  // TIMEOUT DE INACTIVIDAD - 10 MINUTOS
  // ============================================
  useEffect(() => {
    if (!usuario) return;
    
    const TIEMPO_INACTIVIDAD = 10 * 60 * 1000; // 10 minutos en milisegundos
    let timeoutId = null;
    
    const cerrarPorInactividad = () => {
      console.log('Sesion cerrada por inactividad');
      setSesionExpirada(true);
      localStorage.removeItem('intranet_usuario');
      localStorage.removeItem('intranet_heartbeat');
      setUsuario(null);
      setEmpleado(null);
      setNominas([]);
      setHorarios([]);
      setSolicitudes([]);
      setSeccionActiva('inicio');
      // Limpiar campos de login
      setDocumento('');
      setClave('');
    };
    
    const reiniciarTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(cerrarPorInactividad, TIEMPO_INACTIVIDAD);
    };
    
    // Eventos que reinician el timer
    const eventos = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    eventos.forEach(evento => window.addEventListener(evento, reiniciarTimer));
    
    // Iniciar timer
    reiniciarTimer();
    
    // Limpiar al desmontar
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      eventos.forEach(evento => window.removeEventListener(evento, reiniciarTimer));
    };
  }, [usuario]);

  // ============================================
  // CERRAR SESION AL CERRAR PESTAÑA O NAVEGADOR
  // (pero mantener sesión al recargar F5)
  // ============================================
  useEffect(() => {
    // Usar sessionStorage para marcar si la pestaña está activa
    // sessionStorage se limpia al cerrar pestaña pero persiste en recarga
    const SESION_ACTIVA_KEY = 'intranet_sesion_activa';
    
    // Si hay usuario guardado pero NO hay marca de sesión activa, 
    // significa que la pestaña se cerró anteriormente
    const sesionGuardada = localStorage.getItem('intranet_usuario');
    const sesionActiva = sessionStorage.getItem(SESION_ACTIVA_KEY);
    
    if (sesionGuardada && !sesionActiva) {
      // La pestaña fue cerrada, limpiar sesión
      console.log('Sesion cerrada: pestaña fue cerrada (no hay marca de sesion activa)');
      localStorage.removeItem('intranet_usuario');
      localStorage.removeItem('intranet_heartbeat');
    }
    
    // Marcar que la sesión está activa (esto persiste en recarga pero no al cerrar pestaña)
    sessionStorage.setItem(SESION_ACTIVA_KEY, 'true');
    
    // Mantener heartbeat para el timeout de inactividad
    const actualizarHeartbeat = () => {
      if (localStorage.getItem('intranet_usuario')) {
        localStorage.setItem('intranet_heartbeat', Date.now().toString());
      }
    };
    
    actualizarHeartbeat();
    const intervalId = setInterval(actualizarHeartbeat, 1000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Verificar si hay sesion guardada al cargar (usando localStorage)
  useEffect(() => {
    // Esperar para que el heartbeat check limpie sesiones inválidas primero
    const timer = setTimeout(async () => {
      const sesionGuardada = localStorage.getItem('intranet_usuario');
      if (sesionGuardada) {
        try {
          const datosUsuario = JSON.parse(sesionGuardada);
          
          console.log('🔐 Verificando estado del empleado al restaurar sesión:', datosUsuario.usuario);
          
          // Verificar si el empleado sigue activo antes de restaurar sesión
          const { data: empleadoData, error: empError } = await supabase
            .from('empleados')
            .select('activo, estado')
            .eq('documento', datosUsuario.usuario)
            .maybeSingle();
          
          console.log('🔐 Resultado verificación activo:', empleadoData, 'Error:', empError);
          
          // Bloquear si el empleado existe y está inactivo
          if (empleadoData) {
            const estaInactivo = empleadoData.activo === false || 
                                empleadoData.estado === 'inactivo' || 
                                empleadoData.estado === 'Inactivo' ||
                                empleadoData.estado === 'INACTIVO';
            
            if (estaInactivo) {
              // Empleado inactivo - cerrar sesión
              console.log('🚫 Empleado inactivo, cerrando sesión guardada');
              localStorage.removeItem('intranet_usuario');
              localStorage.removeItem('intranet_heartbeat');
              alert('Tu cuenta de empleado ha sido desactivada. Contacta al administrador.');
              return; // No restaurar sesión
            }
          }
          
          // Empleado activo - restaurar sesión normal
          setUsuario(datosUsuario);
          cargarDatosEmpleado(datosUsuario);
          // Actualizar heartbeat inmediatamente al restaurar sesión
          localStorage.setItem('intranet_heartbeat', Date.now().toString());
        } catch (e) {
          localStorage.removeItem('intranet_usuario');
          localStorage.removeItem('intranet_heartbeat');
        }
      }
    }, 150);
    return () => clearTimeout(timer);
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
        // ============================================
        // VERIFICAR SI EL EMPLEADO ESTÁ ACTIVO
        // ============================================
        const estaInactivo = emp.activo === false || 
                            emp.estado === 'inactivo' || 
                            emp.estado === 'Inactivo' ||
                            emp.estado === 'INACTIVO';
        
        if (estaInactivo) {
          console.log('🚫 Empleado inactivo detectado en cargarDatosEmpleado, cerrando sesión');
          localStorage.removeItem('intranet_usuario');
          localStorage.removeItem('intranet_heartbeat');
          setUsuario(null);
          setEmpleado(null);
          setCargando(false);
          alert('Tu cuenta de empleado está inactiva. Contacta al administrador.');
          return;
        }
        
        setEmpleado(emp);
        
        // Cargar bloqueos de módulos para este empleado
        await cargarBloqueosModulos(emp.documento);
        
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
          
          // Cargar avisos de la intranet
          await cargarAvisos(empresaId);
          
          // Cargar empleados de la empresa para cumpleaños
          await cargarEmpleadosCumple(empresaId);
        }
        
        // Cargar datos adicionales usando ID para nóminas y horarios, documento para el resto
        await Promise.all([
          cargarNominas(empleadoId, emp.documento),
          cargarHorarios(emp.id), // Usar ID del empleado para horarios
          cargarAusencias(emp.id), // Cargar ausencias (incapacidades, vacaciones)
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
        
        // Cargar avisos si hay empresa_id
        if (usuarioData.empresa_id) {
          await cargarAvisos(usuarioData.empresa_id);
        }
        
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

  // Cargar bloqueos de módulos para el empleado actual (incluyendo bloqueos para TODOS)
  const cargarBloqueosModulos = async (documento) => {
    try {
      console.log('🔍 Cargando bloqueos para documento:', documento);
      // Cargar bloqueos específicos del empleado Y bloqueos para TODOS
      const { data, error } = await supabase
        .from('bloqueos_modulos_empleado')
        .select('*')
        .in('documento_empleado', [documento, 'TODOS'])
        .eq('activo', true);
      
      console.log('🔒 Bloqueos de módulos cargados:', { data, error, documento });
      
      if (error) {
        console.error('❌ Error cargando bloqueos:', error);
        return;
      }
      
      if (data && data.length > 0) {
        console.log('✅ Bloqueos encontrados:', data.length, data);
        setBloqueosModulos(data);
      } else {
        console.log('ℹ️ No hay bloqueos para este empleado');
        setBloqueosModulos([]);
      }
    } catch (error) {
      console.error('❌ Error en cargarBloqueosModulos:', error);
    }
  };

  // Verificar si un módulo está bloqueado para el empleado actual
  const moduloBloqueado = (moduloId) => {
    // Mapear IDs del menú a IDs de bloqueo
    const mapeoModulos = {
      'desprendible': 'desprendible',
      'prestamos': 'prestamos',
      'carta-laboral': 'carta_laboral',
      'contrato': 'contrato',
      'horarios': 'horarios',
      'solicitudes': 'solicitudes',
      'actualizacion-datos': 'actualizar_datos',
      'reglamento': 'reglamento',
      'formatos': 'formatos'
    };
    
    const idBloqueo = mapeoModulos[moduloId] || moduloId;
    
    // Buscar bloqueo específico para el empleado O bloqueo para TODOS
    const bloqueo = bloqueosModulos.find(b => {
      // Verificar que el módulo coincida y sea para este empleado o TODOS
      if (b.modulo !== idBloqueo) return false;
      if (b.documento_empleado !== empleado?.documento && b.documento_empleado !== 'TODOS') return false;
      if (!b.activo) return false;
      
      // Verificar vigencia por fechas
      const hoy = new Date();
      const diaHoy = hoy.getDate();
      const fechaHoyStr = hoy.toISOString().split('T')[0];
      
      // Si es bloqueo recurrente mensual
      if (b.es_recurrente && b.dia_inicio && b.dia_fin) {
        return diaHoy >= b.dia_inicio && diaHoy <= b.dia_fin;
      }
      
      // Si es bloqueo por fechas específicas
      if (b.fecha_inicio && b.fecha_fin && b.fecha_inicio !== '2000-01-01') {
        return fechaHoyStr >= b.fecha_inicio && fechaHoyStr <= b.fecha_fin;
      }
      
      // Si no tiene fechas configuradas, es bloqueo permanente
      return true;
    });
    
    return bloqueo;
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
        // DEBUG: Mostrar todos los campos de la primera nómina para identificar el campo correcto
        if (data.length > 0) {
          console.log('📊 Campos de la primera nómina:', Object.keys(data[0]));
          console.log('📊 Datos completos de nóminas:', data.map(n => ({
            id: n.id,
            periodo: n.periodo,
            quincena: n.quincena,
            num_quincena: n.num_quincena,
            tipo_quincena: n.tipo_quincena,
            mes: n.mes,
            anio: n.anio,
            fecha_inicio: n.fecha_inicio,
            fecha_fin: n.fecha_fin,
            created_at: n.created_at
          })));
        }
        setNominas(data);
      }
    } catch (e) {
      console.log('❌ Error cargando nóminas:', e);
    }
  };

  const cargarHorarios = async (empleadoId) => {
    try {
      console.log('📅 Buscando horarios para empleado ID:', empleadoId);
      
      // Calcular fechas: mes anterior, mes actual y mes siguiente
      const hoy = new Date();
      const primerDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const ultimoDiaMesSiguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0); // Incluir mes siguiente
      
      const fechaInicio = primerDiaMesAnterior.toISOString().split('T')[0];
      const fechaFin = ultimoDiaMesSiguiente.toISOString().split('T')[0];
      
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
      const horariosEmpleadoArr = [];
      
      // ============================================
      // EXTRAER EVENTOS PROGRAMADOS PARA EL EMPLEADO
      // ============================================
      const todosEventos = {};
      
      if (horariosData) {
        for (const semana of horariosData) {
          const celdas = semana.celdas || {};
          const horarioEmpleado = celdas[empleadoId];
          
          // CARGAR EVENTOS DEL EMPLEADO
          // Estructura eventos_por_dia: { [empleadoId]: { [fecha]: {eventoId, nombre, color} } }
          const eventosPorDia = semana.eventos_por_dia || {};
          const eventosDelEmpleado = eventosPorDia[empleadoId];
          
          if (eventosDelEmpleado && typeof eventosDelEmpleado === 'object') {
            console.log('🔔 Eventos encontrados para empleado en semana', semana.semana_inicio, ':', Object.keys(eventosDelEmpleado));
            Object.entries(eventosDelEmpleado).forEach(([fecha, evento]) => {
              todosEventos[fecha] = evento;
            });
          }
          
          // Eventos generales (aplican a todos los empleados)
          const eventosGenerales = semana.eventos || {};
          if (eventosGenerales && typeof eventosGenerales === 'object') {
            Object.entries(eventosGenerales).forEach(([fecha, evento]) => {
              if (!todosEventos[fecha]) { // No sobrescribir eventos específicos del empleado
                todosEventos[fecha] = evento;
              }
            });
          }
          
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
                  horariosEmpleadoArr.push({
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
                    horariosEmpleadoArr.push({
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
                    horariosEmpleadoArr.push({
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
      horariosEmpleadoArr.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      
      console.log('👤 Horarios del empleado:', horariosEmpleadoArr.length);
      console.log('📆 Eventos del empleado encontrados:', Object.keys(todosEventos).length, todosEventos);
      
      setHorarios(horariosEmpleadoArr);
      setEventosEmpleado(todosEventos);
      
    } catch (e) {
      console.error('Error en cargarHorarios:', e);
    }
  };

  const cargarSolicitudes = async (doc) => {
    setCargandoSolicitudes(true);
    try {
      console.log('📋 Cargando solicitudes para documento:', doc);
      const { data, error } = await supabase
        .from('solicitudes_empleados')
        .select('*')
        .eq('documento', doc)
        .order('fecha_creacion', { ascending: false })
        .limit(20);
      
      console.log('📋 Resultado solicitudes:', data, error);
      if (data) setSolicitudes(data);
      if (error) console.error('Error cargando solicitudes:', error);
    } catch (e) {
      console.log('Tabla solicitudes_empleados no disponible:', e);
    }
    setCargandoSolicitudes(false);
  };

  // Cargar avisos y noticias de la intranet
  const cargarAvisos = async (empresaId) => {
    try {
      const { data, error } = await supabase
        .from('avisos_intranet')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .order('fecha', { ascending: false })
        .limit(20);
      
      if (data) {
        console.log('📰 Avisos cargados:', data.length);
        setAvisos(data);
      }
      if (error) {
        console.log('Tabla avisos_intranet no disponible:', error);
      }
    } catch (e) {
      console.log('Error cargando avisos:', e);
    }
  };

  // Cargar ausencias del empleado (incapacidades, vacaciones, permisos, etc.)
  const cargarAusencias = async (empleadoId) => {
    try {
      console.log('📋 Cargando ausencias para empleado ID:', empleadoId);
      
      const { data, error } = await supabase
        .from('ausencias')
        .select('id, empleadoid, tipo, fechainicio, fechafin, periodo, motivo, razon, diastotales')
        .eq('empleadoid', empleadoId)
        .order('fechainicio', { ascending: false });
      
      if (error) {
        console.log('Error cargando ausencias:', error);
        return;
      }
      
      if (data) {
        console.log('📋 Ausencias cargadas:', data.length);
        setAusencias(data);
      }
    } catch (e) {
      console.log('Tabla ausencias no disponible:', e);
    }
  };

  // Cargar empleados de la empresa para mostrar cumpleaños
  const cargarEmpleadosCumple = async (empresaId) => {
    try {
      console.log('🎂 Cargando empleados para cumpleaños, empresa ID:', empresaId);
      
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('activo', true);
      
      if (error) {
        console.log('Error cargando empleados:', error);
        return;
      }
      
      if (data) {
        console.log('🎂 Empleados cargados para cumpleaños:', data.length, data);
        // Mapear fechanacimiento a fechaNacimiento para compatibilidad con el modal
        const empleadosMapeados = data.map(emp => ({
          ...emp,
          fechaNacimiento: emp.fechanacimiento || emp.fechaNacimiento || ''
        }));
        setEmpleadosCumple(empleadosMapeados);
      }
    } catch (e) {
      console.log('Error cargando empleados cumpleaños:', e);
    }
  };

  // Función para que el empleado responda a una propuesta de RRHH
  const responderPropuesta = async (solicitudId, textoRespuesta, archivosRespuesta = [], guardarEnFicha = false) => {
    if (!textoRespuesta || !textoRespuesta.trim()) {
      alert('Por favor escribe tu respuesta');
      return;
    }
    
    try {
      // Preparar datos de actualización
      const datosActualizacion = { 
        respuesta_empleado: textoRespuesta.trim(),
        fecha_respuesta_empleado: new Date().toISOString()
        // El estado sigue en 'en_proceso' hasta que RRHH dé respuesta definitiva
      };
      
      // Si hay archivos adjuntos, agregarlos
      if (archivosRespuesta.length > 0) {
        datosActualizacion.archivos_respuesta_empleado = JSON.stringify(archivosRespuesta);
      }
      
      // Si se marca guardar en ficha, agregar flag
      if (guardarEnFicha) {
        datosActualizacion.guardar_en_ficha = true;
      }
      
      const { error } = await supabase
        .from('solicitudes_empleados')
        .update(datosActualizacion)
        .eq('id', solicitudId);
      
      if (error) throw error;
      
      alert('✅ Tu respuesta ha sido enviada. RRHH revisará y te dará una respuesta definitiva.');
      
      // Enviar SMS al admin notificando la respuesta del empleado
      try {
        const empresaId = empleado?.empresa_id || usuario?.empresa_id;
        console.log('Buscando configuracion de notificaciones SMS para empresa:', empresaId);
        
        const { data: configData } = await supabase
          .from('empresas')
          .select('telefono_solicitudes_1, nombre_receptor_1, telefono_solicitudes_2, nombre_receptor_2')
          .eq('id', empresaId)
          .single();
        
        const nombreEmpleado = empleado?.nombre || empleado?.nombres || usuario?.nombre || 'Empleado';
        const docEmpleado = empleado?.documento || usuario?.usuario || '';
        
        const mensajeSMS = `BigBurguer - Respuesta a REQUERIMIENTO
Empleado: ${nombreEmpleado}
Doc: ${docEmpleado}
Fecha: ${new Date().toLocaleDateString('es-CO')}
El empleado ha respondido a un REQUERIMIENTO. Revise el panel de administracion.`;
        
        // Enviar SMS al teléfono 1 (si está configurado)
        if (configData?.telefono_solicitudes_1) {
          console.log('Enviando SMS #1 de respuesta a REQUERIMIENTO a:', configData.telefono_solicitudes_1);
          
          fetch('/api/enviar-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              telefono: configData.telefono_solicitudes_1, 
              mensaje: mensajeSMS 
            })
          }).then(r => r.json()).then(result => {
            console.log('Resultado SMS #1 respuesta REQUERIMIENTO:', result);
            if (result.ok) console.log('SMS #1 notificacion de respuesta enviado');
            else console.warn('Error SMS #1:', result);
          }).catch(err => console.warn('SMS #1 no enviado:', err));
        }
        
        // Enviar SMS al teléfono 2 (si está configurado)
        if (configData?.telefono_solicitudes_2) {
          console.log('Enviando SMS #2 de respuesta a REQUERIMIENTO a:', configData.telefono_solicitudes_2);
          
          fetch('/api/enviar-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              telefono: configData.telefono_solicitudes_2, 
              mensaje: mensajeSMS 
            })
          }).then(r => r.json()).then(result => {
            console.log('Resultado SMS #2 respuesta REQUERIMIENTO:', result);
            if (result.ok) console.log('SMS #2 notificacion de respuesta enviado');
            else console.warn('Error SMS #2:', result);
          }).catch(err => console.warn('SMS #2 no enviado:', err));
        }
        
        if (!configData?.telefono_solicitudes_1 && !configData?.telefono_solicitudes_2) {
          console.log('📱 No hay teléfonos de notificaciones configurados para esta empresa');
        }
      } catch (smsErr) {
        console.warn('Error al enviar notificacion SMS:', smsErr);
      }
      
      // Recargar solicitudes
      const doc = empleado?.documento || usuario?.usuario;
      if (doc) await cargarSolicitudes(doc);
    } catch (error) {
      console.error('Error respondiendo propuesta:', error);
      alert('❌ Error al procesar tu respuesta');
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
      
      // ============================================
      // VERIFICAR SI EL EMPLEADO ESTÁ ACTIVO EN LA TABLA EMPLEADOS
      // ============================================
      const { data: empleadoData, error: empError } = await supabase
        .from('empleados')
        .select('activo, estado')
        .eq('documento', documento.trim())
        .maybeSingle();
      
      console.log('🔐 Verificando estado del empleado:', documento.trim());
      console.log('🔐 Resultado verificación empleado:', empleadoData, 'Error:', empError);
      
      // Bloquear acceso si el empleado está inactivo
      // Verificar tanto el campo 'activo' como el campo 'estado'
      if (empleadoData) {
        const estaInactivo = empleadoData.activo === false || 
                            empleadoData.estado === 'inactivo' || 
                            empleadoData.estado === 'Inactivo' ||
                            empleadoData.estado === 'INACTIVO';
        
        if (estaInactivo) {
          console.log('🚫 Empleado inactivo, bloqueando acceso');
          setErrorLogin('Tu cuenta de empleado está inactiva. Contacta al administrador.');
          setCargando(false);
          return;
        }
      }
      
      // Usuario encontrado - preparar datos
      const datosUsuario = {
        id: usuarioData.id,
        nombre: usuarioData.nombre,
        usuario: usuarioData.usuario,
        email: usuarioData.email,
        perfil: usuarioData.perfil,
        empresa_id: usuarioData.empresa_id
      };
      
      // Verificar si es primer inicio de sesión (campo primer_login = true o clave igual a documento)
      const esPrimerLogin = usuarioData.primer_login === true || usuarioData.clave === usuarioData.usuario;
      
      if (esPrimerLogin) {
        // Mostrar modal de cambio de contraseña obligatorio
        setUsuarioTemporal(datosUsuario);
        setMostrarCambioPassword(true);
        setCargando(false);
        return;
      }
      
      // Login normal - guardar sesión
      localStorage.setItem('intranet_usuario', JSON.stringify(datosUsuario));
      localStorage.setItem('intranet_heartbeat', Date.now().toString());
      setSesionExpirada(false);
      setUsuario(datosUsuario);
      await cargarDatosEmpleado(datosUsuario);
      
    } catch (error) {
      console.error('Error en login:', error);
      setErrorLogin('Error al iniciar sesión');
    }
    setCargando(false);
  };

  // Función para cambiar contraseña en primer inicio de sesión
  const guardarNuevaPassword = async () => {
    setErrorCambioPassword('');
    
    // Validaciones
    if (!nuevaPassword || !confirmarPassword) {
      setErrorCambioPassword('Por favor completa ambos campos');
      return;
    }
    
    if (nuevaPassword.length < 6) {
      setErrorCambioPassword('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    if (nuevaPassword !== confirmarPassword) {
      setErrorCambioPassword('Las contraseñas no coinciden');
      return;
    }
    
    if (nuevaPassword === usuarioTemporal?.usuario) {
      setErrorCambioPassword('La nueva contraseña no puede ser igual al documento');
      return;
    }
    
    setCargando(true);
    try {
      // Actualizar contraseña en la tabla usuarios
      const { error } = await supabase
        .from('usuarios')
        .update({ 
          clave: nuevaPassword,
          primer_login: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', usuarioTemporal.id);
      
      if (error) {
        console.error('Error actualizando contraseña:', error);
        setErrorCambioPassword('Error al guardar la contraseña. Intenta de nuevo.');
        setCargando(false);
        return;
      }
      
      // Contraseña actualizada exitosamente - completar login
      localStorage.setItem('intranet_usuario', JSON.stringify(usuarioTemporal));
      localStorage.setItem('intranet_heartbeat', Date.now().toString());
      setSesionExpirada(false);
      setUsuario(usuarioTemporal);
      await cargarDatosEmpleado(usuarioTemporal);
      
      // Limpiar estados del cambio de contraseña
      setMostrarCambioPassword(false);
      setUsuarioTemporal(null);
      setNuevaPassword('');
      setConfirmarPassword('');
      
      alert('✅ Contraseña actualizada exitosamente. ¡Bienvenido!');
      
    } catch (error) {
      console.error('Error en cambio de contraseña:', error);
      setErrorCambioPassword('Error al procesar el cambio de contraseña');
    }
    setCargando(false);
  };
  
  // Cancelar cambio de contraseña (vuelve al login)
  const cancelarCambioPassword = () => {
    setMostrarCambioPassword(false);
    setUsuarioTemporal(null);
    setNuevaPassword('');
    setConfirmarPassword('');
    setErrorCambioPassword('');
    setClave('');
  };

  const cerrarSesion = () => {
    localStorage.removeItem('intranet_usuario');
    localStorage.removeItem('intranet_heartbeat');
    setUsuario(null);
    setEmpleado(null);
    setNominas([]);
    setHorarios([]);
    setSolicitudes([]);
    setEventosEmpleado({});
    setSeccionActiva('inicio');
    // Limpiar campos de login
    setDocumento('');
    setClave('');
  };

  // ============================================
  // MODAL DE CAMBIO DE CONTRASEÑA (PRIMER INICIO DE SESIÓN)
  // ============================================
  if (mostrarCambioPassword) {
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
          maxWidth: 450,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: 25 }}>
            <div style={{ fontSize: 60, marginBottom: 10 }}>🔐</div>
            <h2 style={{ color: '#b71c1c', margin: 0, fontSize: 22 }}>
              Cambio de Contraseña Obligatorio
            </h2>
            <p style={{ color: '#666', marginTop: 10, fontSize: 14 }}>
              Es tu primer inicio de sesión. Por seguridad, debes crear una nueva contraseña.
            </p>
          </div>
          
          <div style={{
            padding: 15,
            backgroundColor: '#e3f2fd',
            borderRadius: 10,
            marginBottom: 20,
            border: '1px solid #90caf9'
          }}>
            <p style={{ margin: 0, color: '#1565c0', fontSize: 13 }}>
              👤 Usuario: <strong>{usuarioTemporal?.usuario}</strong><br/>
              📛 Nombre: <strong>{usuarioTemporal?.nombre}</strong>
            </p>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#333', fontWeight: 500 }}>
              Nueva Contraseña
            </label>
            <input
              type="password"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
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
          
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#333', fontWeight: 500 }}>
              Confirmar Contraseña
            </label>
            <input
              type="password"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              placeholder="Repite la contraseña"
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
          
          {errorCambioPassword && (
            <div style={{
              padding: 12,
              backgroundColor: '#ffebee',
              color: '#c62828',
              borderRadius: 8,
              marginBottom: 16,
              textAlign: 'center'
            }}>
              ⚠️ {errorCambioPassword}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={cancelarCambioPassword}
              disabled={cargando}
              style={{
                flex: 1,
                padding: '14px',
                backgroundColor: '#757575',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 'bold',
                cursor: cargando ? 'not-allowed' : 'pointer'
              }}
            >
              ← Cancelar
            </button>
            <button
              onClick={guardarNuevaPassword}
              disabled={cargando}
              style={{
                flex: 2,
                padding: '14px',
                backgroundColor: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 'bold',
                cursor: cargando ? 'wait' : 'pointer',
                opacity: cargando ? 0.7 : 1
              }}
            >
              {cargando ? '⏳ Guardando...' : '✅ Guardar Nueva Contraseña'}
            </button>
          </div>
          
          <div style={{ textAlign: 'center', marginTop: 20, color: '#999', fontSize: 11 }}>
            Esta contraseña servirá para ingresar tanto a la Intranet como al Sistema Central
          </div>
        </div>
      </div>
    );
  }

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
          
          {sesionExpirada && (
            <div style={{
              padding: 12,
              backgroundColor: '#fff3e0',
              color: '#e65100',
              borderRadius: 8,
              marginBottom: 16,
              textAlign: 'center',
              border: '1px solid #ffb74d'
            }}>
              ⏰ Tu sesion expiro por inactividad. Por favor, ingresa nuevamente.
            </div>
          )}
          
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
    { id: 'prestamos', icono: '💳', nombre: 'Préstamos/Adelantos' },
    { id: 'carta-laboral', icono: '📄', nombre: 'Carta Laboral' },
    { id: 'contrato', icono: '📋', nombre: 'Contrato de Trabajo' },
    { id: 'horarios', icono: '🕐', nombre: 'Mis Horarios' },
    { id: 'solicitudes', icono: '📝', nombre: 'Radicar Solicitud' },
    { id: 'actualizacion-datos', icono: '👤', nombre: 'Actualizar Mis Datos' },
    { id: 'reglamento', icono: '📖', nombre: 'Reglamento Interno' },
    { id: 'formatos', icono: '📁', nombre: 'Formatos' },
  ];

  // ============================================
  // COMPONENTES DE SECCIONES
  // ============================================
  
  // INICIO - Página web con avisos y noticias
  const SeccionInicio = () => {
    // Función para obtener info del tipo
    const getTipoInfo = (tipo) => {
      switch(tipo) {
        case 'noticia': return { label: '📰 NOTICIA', bg: '#e3f2fd', color: '#1976d2' };
        case 'aviso': return { label: '📢 AVISO', bg: '#FFF3E0', color: '#F57C00' };
        case 'importante': return { label: '⚠️ IMPORTANTE', bg: '#ffebee', color: '#c62828' };
        case 'evento': return { label: '🎉 EVENTO', bg: '#F3E5F5', color: '#7B1FA2' };
        default: return { label: '📢 AVISO', bg: '#e8f5e9', color: '#388e3c' };
      }
    };

    // Si hay un aviso seleccionado (solo para avisos/eventos, no noticias)
    if (avisoSeleccionado && avisoSeleccionado.tipo !== 'noticia') {
      const tipoInfo = getTipoInfo(avisoSeleccionado.tipo);
      return (
        <div>
          {/* Botón volver */}
          <button
            onClick={() => setAvisoSeleccionado(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              backgroundColor: '#f5f5f5',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              marginBottom: 20,
              color: '#666'
            }}
          >
            ← Volver a inicio
          </button>
          
          {/* Contenido del aviso/evento como página web */}
          <article style={{
            backgroundColor: 'white',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
          }}>
            {/* Imagen principal */}
            {avisoSeleccionado.imagen && (
              <img 
                src={avisoSeleccionado.imagen} 
                alt={avisoSeleccionado.titulo}
                style={{ width: '100%', maxHeight: 400, objectFit: 'cover' }}
              />
            )}
            <div style={{ padding: 32 }}>
              {/* Badge tipo */}
              <div style={{ 
                display: 'inline-block',
                backgroundColor: tipoInfo.bg,
                color: tipoInfo.color,
                padding: '6px 16px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 'bold',
                marginBottom: 16
              }}>
                {tipoInfo.label}
              </div>
              
              {/* Título */}
              <h1 style={{ margin: '0 0 16px', color: '#1a1a2e', fontSize: 28, fontWeight: 700 }}>
                {avisoSeleccionado.titulo}
              </h1>
              
              {/* Fecha */}
              <p style={{ color: '#999', fontSize: 14, marginBottom: 24 }}>
                📅 {new Date(avisoSeleccionado.fecha).toLocaleDateString('es-CO', { 
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                })}
              </p>
              
              {/* Contenido renderizado como HTML */}
              <div 
                style={{ 
                  lineHeight: 1.8, 
                  color: '#444',
                  fontSize: 16
                }}
                dangerouslySetInnerHTML={{ __html: avisoSeleccionado.contenido }}
              />
            </div>
          </article>
        </div>
      );
    }
    
    return (
      <div>
        {/* Banner de bienvenida */}
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
        
        {/* Sección de Avisos y Noticias */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ color: '#333', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            📰 Avisos y Noticias
          </h3>
          
          {avisos.length === 0 ? (
            <div style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 40,
              textAlign: 'center',
              color: '#999'
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <p>No hay avisos o noticias en este momento</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {avisos.map(aviso => {
                const tipoInfo = getTipoInfo(aviso.tipo);
                const esNoticia = aviso.tipo === 'noticia';
                
                return (
                  <article 
                    key={aviso.id}
                    onClick={() => {
                      if (esNoticia) {
                        // Si es noticia, abrir el link en nueva pestaña
                        window.open(aviso.contenido, '_blank');
                      } else {
                        // Si es aviso/evento, mostrar contenido completo
                        setAvisoSeleccionado(aviso);
                      }
                    }}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: 16,
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      display: 'flex',
                      flexDirection: aviso.imagen ? 'row' : 'column'
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                    }}
                  >
                    {aviso.imagen && (
                      <div style={{ 
                        width: 200, 
                        minHeight: 150,
                        flexShrink: 0,
                        backgroundImage: `url(${aviso.imagen})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }} />
                    )}
                    <div style={{ padding: 20, flex: 1 }}>
                      <div style={{ 
                        display: 'inline-block',
                        backgroundColor: tipoInfo.bg,
                        color: tipoInfo.color,
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 'bold',
                        marginBottom: 10
                      }}>
                        {tipoInfo.label}
                      </div>
                      <h4 style={{ margin: '0 0 8px', color: '#333', fontSize: 18 }}>
                        {aviso.titulo}
                      </h4>
                      
                      {/* Para noticias mostrar indicador de link externo */}
                      {esNoticia ? (
                        <p style={{ 
                          margin: '0 0 12px', 
                          color: '#1976d2', 
                          fontSize: 14,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          🔗 Click para ver la noticia completa
                        </p>
                      ) : (
                        <p style={{ 
                          margin: '0 0 12px', 
                          color: '#666', 
                          fontSize: 14,
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {aviso.resumen || aviso.contenido?.replace(/<[^>]*>/g, '').substring(0, 150) + '...'}
                        </p>
                      )}
                      
                      <p style={{ margin: 0, color: '#999', fontSize: 12 }}>
                        📅 {new Date(aviso.fecha).toLocaleDateString('es-CO', { 
                          day: 'numeric', month: 'short', year: 'numeric' 
                        })}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Accesos rápidos */}
        <div>
          <h3 style={{ color: '#333', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚡ Accesos Rápidos
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {/* Botón de Cumpleaños */}
            <button
              onClick={() => setMostrarCumpleanos(true)}
              style={{
                padding: 16,
                backgroundColor: 'white',
                border: '2px solid #e0e0e0',
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = '#ec4899';
                e.currentTarget.style.backgroundColor = '#fdf2f8';
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎂</div>
              <div style={{ fontWeight: '500', color: '#333', fontSize: 13 }}>Cumpleaños</div>
            </button>
            {menuItems.filter(m => m.id !== 'inicio').map(item => {
              const bloqueo = moduloBloqueado(item.id);
              const estaBloqueado = !!bloqueo;
              
              return (
              <button
                key={item.id}
                onClick={() => {
                  if (estaBloqueado) {
                    alert(`🔒 Este módulo no está disponible para tu usuario.\n\n${bloqueo.motivo ? 'Motivo: ' + bloqueo.motivo : 'Comunícate con Recursos Humanos para más información.'}`);
                  } else {
                    setSeccionActiva(item.id);
                  }
                }}
                style={{
                  padding: 16,
                  backgroundColor: estaBloqueado ? '#f5f5f5' : 'white',
                  border: '2px solid #e0e0e0',
                  borderRadius: 12,
                  cursor: estaBloqueado ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  opacity: estaBloqueado ? 0.6 : 1,
                  position: 'relative'
                }}
                onMouseOver={e => {
                  if (!estaBloqueado) {
                    e.currentTarget.style.borderColor = '#c62828';
                    e.currentTarget.style.backgroundColor = '#ffebee';
                  }
                }}
                onMouseOut={e => {
                  e.currentTarget.style.borderColor = '#e0e0e0';
                  e.currentTarget.style.backgroundColor = estaBloqueado ? '#f5f5f5' : 'white';
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>{estaBloqueado ? '🔒' : item.icono}</div>
                <div style={{ fontWeight: '500', color: estaBloqueado ? '#999' : '#333', fontSize: 13 }}>{item.nombre}</div>
                {estaBloqueado && (
                  <div style={{ fontSize: 9, color: '#999', marginTop: 4 }}>Bloqueado</div>
                )}
              </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

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
    // Si la nómina tiene el campo 'quincena' (1 o 2), se usa ese valor directamente
    const getRangoQuincena = (fechaISO, quincenaFromNomina = null) => {
      if (!fechaISO) return { inicio: '', fin: '' };
      
      // Parsear la fecha manualmente para evitar desfase de zona horaria
      // Las fechas ISO vienen como "YYYY-MM-DD" y JavaScript las interpreta en UTC
      let yyyy, mm, dd;
      if (typeof fechaISO === 'string' && fechaISO.includes('-')) {
        const partes = fechaISO.split('T')[0].split('-');
        yyyy = parseInt(partes[0], 10);
        mm = parseInt(partes[1], 10) - 1; // Los meses en JS van de 0-11
        dd = parseInt(partes[2], 10);
      } else {
        const date = new Date(fechaISO);
        yyyy = date.getFullYear();
        mm = date.getMonth();
        dd = date.getDate();
      }
      
      // Usar la quincena que viene de la nómina si existe, sino calcular por fecha
      let half;
      if (quincenaFromNomina !== null && quincenaFromNomina !== undefined) {
        // El campo quincena puede ser 1, 2, "1", "2", "Primera", "Segunda"
        if (quincenaFromNomina === 1 || quincenaFromNomina === '1' || quincenaFromNomina === 'Primera' || quincenaFromNomina === 'primera') {
          half = 1;
        } else if (quincenaFromNomina === 2 || quincenaFromNomina === '2' || quincenaFromNomina === 'Segunda' || quincenaFromNomina === 'segunda') {
          half = 2;
        } else {
          half = dd <= 15 ? 1 : 2;
        }
      } else {
        half = dd <= 15 ? 1 : 2;
      }
      
      // Calcular los días de la quincena
      const lastDay = new Date(yyyy, mm + 1, 0).getDate();
      const start = half === 1 ? 1 : 16;
      const end = half === 1 ? 15 : lastDay;
      
      // Crear fecha local para mostrar el mes correctamente
      const fechaMes = new Date(yyyy, mm, 1);
      
      return {
        inicio: new Date(yyyy, mm, start),
        fin: new Date(yyyy, mm, end),
        quincena: half === 1 ? 'Primera' : 'Segunda',
        mes: fechaMes.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
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

    // Obtener método de liquidación
    const getMetodoLiquidacion = (nomina) => {
      if (!nomina) return null;
      // Buscar en horas_totales o detalle_horas_completo
      let datos = nomina.horas_totales || nomina.detalle_horas_completo;
      if (typeof datos === 'string') {
        try {
          datos = JSON.parse(datos);
        } catch {
          return null;
        }
      }
      return datos?.metodoLiquidacion || null;
    };

    const horasTotales = nominaSeleccionada ? getHorasTotales(nominaSeleccionada) : null;
    const rangoQuincena = nominaSeleccionada ? getRangoQuincena(nominaSeleccionada.periodo, nominaSeleccionada.quincena) : null;
    const metodoLiquidacion = nominaSeleccionada ? getMetodoLiquidacion(nominaSeleccionada) : null;
    // Método 2 = sin_recargos = no mostrar horas extras
    const esMetodo2 = metodoLiquidacion === 'sin_recargos';

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
                  const rango = getRangoQuincena(nomina.periodo, nomina.quincena);
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
                    ⏰ HORAS TRABAJADAS {esMetodo2 && <span style={{ fontSize: 10, color: '#666', fontWeight: 'normal' }}>(Método sin recargos)</span>}
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
                    {/* Horas extras SOLO si NO es método 2 */}
                    {!esMetodo2 && (horasTotales.hExDia > 0 || horasTotales.horasExtrasDia > 0) && (
                      <div style={{ padding: 6, backgroundColor: '#fff3e0', borderRadius: 4, textAlign: 'center' }}>
                        <strong>Extra Diurna</strong><br/>{horasTotales.hExDia || horasTotales.horasExtrasDia || 0}h
                      </div>
                    )}
                    {!esMetodo2 && (horasTotales.hExNoc > 0 || horasTotales.horasExtrasNoc > 0) && (
                      <div style={{ padding: 6, backgroundColor: '#ede7f6', borderRadius: 4, textAlign: 'center' }}>
                        <strong>Extra Nocturna</strong><br/>{horasTotales.hExNoc || horasTotales.horasExtrasNoc || 0}h
                      </div>
                    )}
                    {!esMetodo2 && (horasTotales.hExFest > 0 || horasTotales.horasExtrasFest > 0) && (
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
                      {/* Horas Extras SOLO si NO es método 2 */}
                      {!esMetodo2 && (nominaSeleccionada.valorextras || nominaSeleccionada.hexvalor) > 0 && (
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
              // Parsear firma electrónica con validación robusta
              let firmaElectronica = null;
              if (data.firma_electronica) {
                try {
                  const parsed = typeof data.firma_electronica === 'string'
                    ? JSON.parse(data.firma_electronica)
                    : data.firma_electronica;
                  // Solo aceptar si tiene una imagen base64 válida
                  if (parsed && parsed.firma && typeof parsed.firma === 'string' && parsed.firma.startsWith('data:image')) {
                    firmaElectronica = parsed;
                  } else {
                    console.warn(`⚠️ Sede "${data.nombre}": firma_electronica sin formato válido`);
                  }
                } catch (e) {
                  console.warn('Error parseando firma_electronica:', e);
                }
              }
              
              setDatosSede({
                nombre: data.nombre || '',
                nit: data.nit || '',
                razonSocial: data.razonsocial || data.razonSocial || 'BIG BURGUER S.A.S',
                representanteLegal: data.representantelegal || data.representanteLegal || '',
                tipoDocRepresentante: data.tipodocrepresentante || data.tipoDocRepresentante || 'Cédula de Ciudadanía',
                cedulaRepresentante: data.cedularepresentante || data.cedulaRepresentante || '',
                generoRepresentante: data.generorepresentante || data.generoRepresentante || 'Masculino',
                direccion: data.direccion || '',
                telefono: data.telefono || '',
                firmaElectronica: firmaElectronica
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

    const imprimirCarta = (conFirma = true) => {
      const ventanaImpresion = window.open('', '_blank');
      const fechaActual = new Date();
      const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
      const fechaTexto = `${fechaActual.getDate()} de ${meses[fechaActual.getMonth()]} de ${fechaActual.getFullYear()}`;
      
      // Obtener firma electrónica validada
      const firmaRepresentante = (() => {
        const firma = datosSede?.firmaElectronica;
        if (!firma) return null;
        if (typeof firma === 'object' && firma.firma && firma.firma.startsWith('data:image')) {
          return firma;
        }
        return null;
      })();
      
      // Nombre: combinar nombres y apellidos o usar campo nombre
      const nombreEmpleado = empleado?.nombres && empleado?.apellidos 
        ? `${empleado.nombres} ${empleado.apellidos}` 
        : (empleado?.nombre || usuario?.nombre || '');
      const documento = empleado?.documento || usuario?.usuario || '';
      
      // DEBUG: Ver qué campos tiene el empleado para tipo de documento
      console.log('📄 CARTA LABORAL - Datos tipo documento:', {
        tipodoc: empleado?.tipodoc,
        tipoDoc: empleado?.tipoDoc,
        tipo_doc: empleado?.tipo_doc,
        tipo_documento: empleado?.tipo_documento,
        tipoDocumento: empleado?.tipoDocumento,
        empleadoCompleto: empleado
      });
      
      // Función para normalizar el tipo de documento del empleado
      const normalizarTipoDocEmpleado = (tipo) => {
        if (!tipo) return 'Cédula de Ciudadanía';
        const tipoLower = tipo.toLowerCase().trim();
        if (tipoLower.includes('ppt') || tipoLower.includes('permiso de protección') || tipoLower.includes('permiso de proteccion') || tipoLower.includes('protección temporal') || tipoLower.includes('proteccion temporal')) {
          return 'Permiso de Protección Temporal PPT';
        }
        if (tipoLower === 'cc' || tipoLower.includes('cédula de ciudadanía') || tipoLower.includes('cedula de ciudadania') || (tipoLower.includes('cedula') && tipoLower.includes('ciudadan'))) {
          return 'Cédula de Ciudadanía';
        }
        if (tipoLower === 'ce' || tipoLower.includes('cédula de extranjería') || tipoLower.includes('cedula de extranjeria') || tipoLower.includes('extranjeria') || tipoLower.includes('extranjería')) {
          return 'Cédula de Extranjería';
        }
        if (tipoLower === 'ti' || tipoLower.includes('tarjeta de identidad') || tipoLower.includes('tarjeta identidad')) {
          return 'Tarjeta de Identidad';
        }
        if (tipoLower === 'rc' || tipoLower.includes('registro civil')) {
          return 'Registro Civil';
        }
        if (tipoLower.includes('pasaporte')) {
          return 'Pasaporte';
        }
        if (tipoLower.includes('venezolana') || tipoLower.includes('cedula venezolana') || tipoLower.includes('cédula venezolana')) {
          return 'Cédula Venezolana';
        }
        return tipo; // Si no coincide, devolver el valor original
      };
      
      // Buscar el tipo de documento en diferentes variantes del campo
      const tipoDocRaw = empleado?.tipodoc || empleado?.tipoDoc || empleado?.tipo_doc || empleado?.tipo_documento || empleado?.tipoDocumento || '';
      const tipoDocEmpleado = normalizarTipoDocEmpleado(tipoDocRaw);
      console.log('📄 CARTA LABORAL - Tipo doc final:', tipoDocEmpleado, '(raw:', tipoDocRaw, ')');
      
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
      const tipoDocRepresentante = datosSede?.tipoDocRepresentante || 'Cédula de Ciudadanía';
      const cedulaRepresentante = datosSede?.cedulaRepresentante || '';

      // URL del logo usando la URL base de la aplicación (funciona en desarrollo y producción)
      const LOGO_URL = window.location.origin + "/logo-bigburguer.jpg";

      ventanaImpresion.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title></title>
            <meta charset="UTF-8">
            <style>
              @page {
                size: letter;
                margin: 2.5cm 2.5cm 3cm 2.5cm;
              }
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
                width: 120px;
                height: auto;
              }
              .logo-header img {
                width: 100%;
                height: auto;
                border-radius: 8px;
              }
              .titulo {
                font-size: 13pt;
                font-weight: bold;
                text-align: center;
                margin: 30px 0;
                text-decoration: underline;
              }
              .contenido {
                text-align: justify;
                margin: 30px 0;
              }
              .fecha {
                text-align: left;
                margin: 40px 0 20px 0;
              }
              .firma {
                margin-top: 80px;
                text-align: left;
              }
              .linea-firma {
                border-top: 1px solid #000;
                width: 250px;
                margin: 0 0 10px 0;
              }
              .nombre-firma {
                font-weight: bold;
                margin: 0;
              }
              .cargo-firma {
                margin: 0;
              }
              @media print {
                body {
                  padding: 0;
                }
                @page {
                  margin-top: 2.5cm;
                  margin-bottom: 3cm;
                }
                .logo-header {
                  position: fixed;
                  top: 0;
                  right: 0;
                  width: 110px;
                }
                .fecha {
                  text-align: left;
                }
              }
            </style>
          </head>
          <body>
            <div class="logo-header">
              <img src="${LOGO_URL}" alt="Big Burguer Logo" />
            </div>

            <div class="fecha">Pereira, ${fechaTexto}</div>

            <div class="titulo">CERTIFICACIÓN LABORAL</div>

            <div class="contenido">
              <p>${genero === "Femenino" ? "La suscrita" : "El suscrito"} <strong>${representante}</strong>, en calidad de Representante Legal de <strong>${razonSocial}</strong>, identificad${genero === "Femenino" ? "a" : "o"} con NIT <strong>${nitSede}</strong>,</p>
              
              <p style="text-align: center; margin: 30px 0;"><strong>CERTIFICA QUE:</strong></p>
              
              <p>El (la) Señor(a) <strong>${nombreEmpleado.toUpperCase()}</strong>, identificado(a) con <strong>${tipoDocEmpleado} N° ${documento}</strong>, labora en nuestra empresa${fechaIngreso ? ` desde el <strong>${new Date(fechaIngreso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>` : ''}, con un contrato <strong>${tipoContrato}</strong>, desempeñando el cargo de <strong>${cargo.toUpperCase()}</strong>${salarioBase > 0 ? `, devengando un salario básico mensual de <strong>${formatearMoneda(salarioBase)}</strong> más auxilio de transporte de <strong>${formatearMoneda(AUXILIO_TRANSPORTE)}</strong>, para un total devengado de <strong>${formatearMoneda(salarioTotal)}</strong> (${numeroALetras(salarioTotal)} PESOS M/CTE)` : ''}.</p>
              
              <p>La presente certificación se expide a solicitud del interesado para los fines que estime conveniente.</p>
            </div>

            ${conFirma && firmaRepresentante ? `
            <!-- FIRMA CON IMAGEN ELECTRÓNICA -->
            <div class="firma" style="margin-top: 40px;">
              <div style="
                padding: 10px;
                border: 1px solid #6b7280;
                border-radius: 8px;
                background: linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%);
                max-width: 280px;
                display: inline-block;
              ">
                <div style="text-align: center; margin-bottom: 6px;">
                  <span style="
                    display: inline-block;
                    background: linear-gradient(135deg, #4b5563 0%, #6b7280 100%);
                    color: white;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 7px;
                    font-weight: 700;
                  ">
                    ✓ FIRMA ELECTRÓNICA
                  </span>
                </div>
                <div style="text-align: center; padding: 6px; background: white; border-radius: 6px; border: 1px solid #d1d5db; margin-bottom: 6px;">
                  <img src="${firmaRepresentante.firma}" alt="Firma Representante" style="max-width: 150px; max-height: 50px; filter: grayscale(100%);"/>
                </div>
                <div style="text-align: center;">
                  <div style="font-weight: 700; font-size: 9px; color: #000;">${representante}</div>
                  <div style="font-size: 8px; color: #374151;">Representante Legal</div>
                  <div style="font-size: 7px; color: #374151;">${tipoDocRepresentante} ${cedulaRepresentante}</div>
                  <div style="font-size: 7px; color: #374151;">NIT ${nitSede}</div>
                </div>
              </div>
            </div>
            <div style="margin-top: 25px; font-size: 13pt; color: #000; text-align: center;">
              <strong>Dirección:</strong> ${direccionSede} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Teléfono:</strong> ${telefonoSede}
            </div>
            ` : `
            <!-- FIRMA ESTÁTICA (sin imagen) -->
            <div class="firma">
              <div class="linea-firma"></div>
              <div class="nombre-firma">${representante}</div>
              <div class="cargo-firma">Representante Legal</div>
              <div class="cargo-firma">${tipoDocRepresentante} ${cedulaRepresentante}</div>
              <div class="cargo-firma">NIT ${nitSede}</div>
            </div>
            <div style="margin-top: 25px; font-size: 13pt; color: #000; text-align: center;">
              <strong>Dirección:</strong> ${direccionSede} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Teléfono:</strong> ${telefonoSede}
            </div>
            `}
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
    
    // Función para normalizar el tipo de documento del empleado (vista previa)
    const normalizarTipoDoc = (tipo) => {
      if (!tipo) return 'Cédula de Ciudadanía';
      const tipoLower = tipo.toLowerCase().trim();
      if (tipoLower.includes('ppt') || tipoLower.includes('permiso de protección') || tipoLower.includes('permiso de proteccion') || tipoLower.includes('protección temporal') || tipoLower.includes('proteccion temporal')) {
        return 'Permiso de Protección Temporal PPT';
      }
      if (tipoLower === 'cc' || tipoLower.includes('cédula de ciudadanía') || tipoLower.includes('cedula de ciudadania') || (tipoLower.includes('cedula') && tipoLower.includes('ciudadan'))) {
        return 'Cédula de Ciudadanía';
      }
      if (tipoLower === 'ce' || tipoLower.includes('cédula de extranjería') || tipoLower.includes('cedula de extranjeria') || tipoLower.includes('extranjeria') || tipoLower.includes('extranjería')) {
        return 'Cédula de Extranjería';
      }
      if (tipoLower === 'ti' || tipoLower.includes('tarjeta de identidad') || tipoLower.includes('tarjeta identidad')) {
        return 'Tarjeta de Identidad';
      }
      if (tipoLower === 'rc' || tipoLower.includes('registro civil')) {
        return 'Registro Civil';
      }
      if (tipoLower.includes('pasaporte')) {
        return 'Pasaporte';
      }
      if (tipoLower.includes('venezolana') || tipoLower.includes('cedula venezolana') || tipoLower.includes('cédula venezolana')) {
        return 'Cédula Venezolana';
      }
      return tipo;
    };
    
    // Tipo de documento del empleado normalizado
    const tipoDocEmpleado = normalizarTipoDoc(empleado?.tipodoc || empleado?.tipoDoc || empleado?.tipo_doc || empleado?.tipo_documento || '');

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
              identificado(a) con <strong>{tipoDocEmpleado} N° {empleado?.documento || usuario?.usuario}</strong>, 
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
          
          {/* Firma - Vista previa */}
          <div style={{ marginTop: 50 }}>
            {datosSede?.firmaElectronica ? (
              <div style={{
                padding: 10,
                border: '1px solid #6b7280',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%)',
                maxWidth: 260,
                display: 'inline-block'
              }}>
                <div style={{ textAlign: 'center', marginBottom: 6 }}>
                  <span style={{
                    display: 'inline-block',
                    background: 'linear-gradient(135deg, #4b5563 0%, #6b7280 100%)',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: 8,
                    fontWeight: 700
                  }}>
                    ✓ FIRMA ELECTRÓNICA
                  </span>
                </div>
                <div style={{ textAlign: 'center', padding: 6, background: 'white', borderRadius: 6, border: '1px solid #d1d5db', marginBottom: 6 }}>
                  <img src={datosSede.firmaElectronica.firma} alt="Firma" style={{ maxWidth: 120, maxHeight: 40, filter: 'grayscale(100%)' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: 10, color: '#000' }}>{datosSede?.representanteLegal || 'REPRESENTANTE LEGAL'}</p>
                  <p style={{ margin: '2px 0', fontSize: 9, color: '#374151' }}>Representante Legal</p>
                  <p style={{ margin: '2px 0', fontSize: 8, color: '#374151' }}>{datosSede?.tipoDocRepresentante || 'C.C.'} {datosSede?.cedulaRepresentante || ''}</p>
                  <p style={{ margin: '2px 0', fontSize: 8, color: '#374151' }}>NIT {datosSede?.nit || ''}</p>
                </div>
              </div>
            ) : (
              <div style={{ borderTop: '1px solid #333', width: 220, paddingTop: 8 }}>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{datosSede?.representanteLegal || 'REPRESENTANTE LEGAL'}</p>
                <p style={{ margin: '2px 0', fontSize: 11 }}>Representante Legal</p>
                <p style={{ margin: '2px 0', fontSize: 11 }}>NIT {datosSede?.nit || ''}</p>
              </div>
            )}
            {/* Info de contacto centrada */}
            <div style={{ marginTop: 16, fontSize: 11, color: '#666', textAlign: 'center' }}>
              {datosSede?.direccion && <span><strong>Dir:</strong> {datosSede.direccion}</span>}
              {datosSede?.direccion && datosSede?.telefono && <span> &nbsp;|&nbsp; </span>}
              {datosSede?.telefono && <span><strong>Tel:</strong> {datosSede.telefono}</span>}
            </div>
          </div>
        </div>
        
        {/* Indicador de firma */}
        {datosSede?.firmaElectronica && (
          <div style={{ 
            marginTop: 16, 
            padding: '8px 16px', 
            background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
            border: '1px solid #22c55e',
            borderRadius: 8,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: '#166534'
          }}>
            ✓ Esta sede tiene firma electrónica registrada
          </div>
        )}
        
        {/* Botones imprimir */}
        <div style={{ marginTop: 24, textAlign: 'center', display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {datosSede?.firmaElectronica && (
            <button
              onClick={() => imprimirCarta(true)}
              style={{
                padding: '14px 24px',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 'bold',
                boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
              }}
            >
              ✍️ Imprimir con Firma
            </button>
          )}
          <button
            onClick={() => imprimirCarta(false)}
            style={{
              padding: '14px 24px',
              backgroundColor: '#c62828',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 'bold'
            }}
          >
            🖨️ Imprimir sin Firma
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
    
    // Función para generar e imprimir el contrato como PDF - CON FIRMAS DIGITALES
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
      
      // Parsear las firmas si el contrato está firmado
      let firmaEmpleadorImg = null;
      let firmaTrabajadorImg = null;
      let fechaFirmaEmpleador = null;
      let fechaFirmaTrabajador = null;
      let fechaRegistroEmpleador = null;
      const estaFirmado = contrato.firmado === true;
      const tipoFirmaEmpleador = contrato.tipo_firma_empleador || 'digital';
      
      // Función auxiliar para extraer datos completos de la firma
      const extraerDatosFirma = (firmaData) => {
        if (!firmaData) return { imagen: null, fechaFirma: null, fechaRegistro: null };
        
        // Si ya es una URL de imagen base64
        if (typeof firmaData === 'string' && firmaData.startsWith('data:image')) {
          return { imagen: firmaData, fechaFirma: null, fechaRegistro: null };
        }
        
        // Si es un string JSON, intentar parsearlo
        if (typeof firmaData === 'string') {
          try {
            const parsed = JSON.parse(firmaData);
            if (parsed && typeof parsed === 'object') {
              return {
                imagen: parsed.firma || parsed.imagen || parsed.image || parsed.data || null,
                fechaFirma: parsed.fechaFirma || parsed.timestamp || parsed.fecha || null,
                fechaRegistro: parsed.fechaRegistro || null
              };
            }
          } catch (e) {
            console.log('Error parseando firma:', e);
          }
        }
        
        // Si es un objeto directamente
        if (typeof firmaData === 'object' && firmaData !== null) {
          return {
            imagen: firmaData.firma || firmaData.imagen || firmaData.image || firmaData.data || null,
            fechaFirma: firmaData.fechaFirma || firmaData.timestamp || firmaData.fecha || null,
            fechaRegistro: firmaData.fechaRegistro || null
          };
        }
        
        return { imagen: null, fechaFirma: null, fechaRegistro: null };
      };
      
      // Función para formatear fecha de forma segura
      const formatearFecha = (fecha) => {
        if (!fecha) return 'N/A';
        
        // Si ya es un string formateado (contiene "de" o "a." o similar)
        if (typeof fecha === 'string' && (fecha.includes(' de ') || fecha.includes('a.m.') || fecha.includes('p.m.') || fecha.includes('a. m.') || fecha.includes('p. m.'))) {
          return fecha;
        }
        
        // Intentar parsear como fecha
        try {
          const fechaObj = new Date(fecha);
          if (isNaN(fechaObj.getTime())) {
            return typeof fecha === 'string' ? fecha : 'N/A';
          }
          return fechaObj.toLocaleString('es-CO', {
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit'
          });
        } catch (e) {
          return typeof fecha === 'string' ? fecha : 'N/A';
        }
      };
      
      if (estaFirmado) {
        console.log('Contrato firmado, datos de firmas:', {
          firma_empleador: contrato.firma_empleador,
          firma_trabajador: contrato.firma_trabajador,
          tipo: typeof contrato.firma_empleador
        });
        
        const datosEmpleador = extraerDatosFirma(contrato.firma_empleador);
        const datosTrabajador = extraerDatosFirma(contrato.firma_trabajador);
        
        firmaEmpleadorImg = datosEmpleador.imagen;
        fechaFirmaEmpleador = datosEmpleador.fechaFirma;
        fechaRegistroEmpleador = datosEmpleador.fechaRegistro;
        
        firmaTrabajadorImg = datosTrabajador.imagen;
        fechaFirmaTrabajador = datosTrabajador.fechaFirma;
        
        console.log('Firmas extraídas:', {
          empleador: firmaEmpleadorImg ? 'OK' : 'NULL',
          fechaEmpleador: fechaFirmaEmpleador,
          trabajador: firmaTrabajadorImg ? 'OK' : 'NULL',
          fechaTrabajador: fechaFirmaTrabajador
        });
      }

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
            
            ${estaFirmado && (firmaEmpleadorImg || firmaTrabajadorImg) ? `
            <!-- FIRMAS DIGITALES/ELECTRÓNICAS - MISMO DISEÑO QUE CORREGIR 2 -->
            <div style="margin-top: 30px; padding: 15px; border: 2px solid #6b7280; border-radius: 12px; background: linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%);">
              <div style="text-align: center; margin-bottom: 15px;">
                <span style="display: inline-block; background: linear-gradient(135deg, #4b5563 0%, #6b7280 100%); color: white; padding: 8px 20px; border-radius: 25px; font-size: 12px; font-weight: 700;">
                  ✓ DOCUMENTO FIRMADO ${tipoFirmaEmpleador === 'electronica' ? 'CON FIRMA ELECTRÓNICA' : 'DIGITALMENTE'}
                </span>
              </div>
              
              <div style="display: flex; gap: 30px; justify-content: center; flex-wrap: wrap;">
                <!-- Firma Empleador -->
                <div style="text-align: center; padding: 15px; background: white; border-radius: 10px; border: 1px solid #d1d5db; min-width: 200px;">
                  ${firmaEmpleadorImg ? `<img src="${firmaEmpleadorImg}" alt="Firma Empleador" style="max-width: 180px; max-height: 60px; margin-bottom: 8px; filter: grayscale(100%);"/>` : ''}
                  <div style="border-top: 1px solid #1a1a2e; padding-top: 8px;">
                    <div style="display: inline-block; background: #6b7280; color: white; padding: 2px 8px; border-radius: 10px; font-size: 8px; font-weight: 600; margin-bottom: 4px;">
                      ${tipoFirmaEmpleador === 'electronica' ? 'FIRMA ELECTRÓNICA' : 'FIRMA DIGITAL'}
                    </div>
                    <div style="font-weight: 700; font-size: 10px; color: #000;">EMPLEADOR</div>
                    <div style="font-size: 10px; color: #000;">${datos.representanteLegal || ''}</div>
                    <div style="font-size: 9px; color: #374151;">${datos.tipoDocRepresentante || "C.C."} ${datos.cedulaRepresentante || ''}</div>
                    ${tipoFirmaEmpleador === 'electronica' ? `
                      <div style="font-size: 8px; color: #374151; margin-top: 4px;">📋 Registrada: ${formatearFecha(fechaRegistroEmpleador || fechaFirmaEmpleador)}</div>
                      <div style="font-size: 8px; color: #374151;">📅 Aplicada: ${formatearFecha(fechaFirmaTrabajador || contrato.fecha_firma)}</div>
                    ` : `
                      <div style="font-size: 8px; color: #374151; margin-top: 4px;">📅 ${formatearFecha(fechaFirmaEmpleador || contrato.fecha_firma)}</div>
                    `}
                  </div>
                </div>
                
                <!-- Firma Trabajador -->
                <div style="text-align: center; padding: 15px; background: white; border-radius: 10px; border: 1px solid #d1d5db; min-width: 200px;">
                  ${firmaTrabajadorImg ? `<img src="${firmaTrabajadorImg}" alt="Firma Trabajador" style="max-width: 180px; max-height: 60px; margin-bottom: 8px; filter: grayscale(100%);"/>` : ''}
                  <div style="border-top: 1px solid #1a1a2e; padding-top: 8px;">
                    <div style="display: inline-block; background: #6b7280; color: white; padding: 2px 8px; border-radius: 10px; font-size: 8px; font-weight: 600; margin-bottom: 4px;">
                      FIRMA DIGITAL
                    </div>
                    <div style="font-weight: 700; font-size: 10px; color: #000;">${trabajadorNombre}</div>
                    <div style="font-size: 10px; color: #000;">${datos.nombreTrabajador || ''}</div>
                    <div style="font-size: 9px; color: #374151;">${datos.tipoDocTrabajador || "C.C."} ${datos.cedulaTrabajador || ''}</div>
                    <div style="font-size: 8px; color: #374151; margin-top: 4px;">📅 ${formatearFecha(fechaFirmaTrabajador || contrato.fecha_firma)}</div>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 12px; font-size: 9px; color: #374151; font-style: italic;">
                ${tipoFirmaEmpleador === 'electronica' 
                  ? 'Firma del empleador: electrónica pre-registrada | Firma del trabajador: digital' 
                  : 'Este documento fue firmado digitalmente por ambas partes'}
              </div>
            </div>
            ` : `
            <!-- CONTRATO SIN FIRMAR -->
            <div class="firma-container">
              <div class="firma-box"><div class="espacio-firma"></div><div class="linea-firma"></div><div class="nombre-firma">EMPLEADOR</div><div class="nombre-firma">${datos.representanteLegal || ''}</div><div class="cedula-firma">${datos.tipoDocRepresentante || "Cédula de Ciudadanía"} ${datos.cedulaRepresentante || ''}</div><div class="cedula-firma">Representante Legal</div></div>
              <div class="firma-box"><div class="espacio-firma"></div><div class="linea-firma"></div><div class="nombre-firma">${trabajadorNombre}</div><div class="nombre-firma">${datos.nombreTrabajador || ''}</div><div class="cedula-firma">${datos.tipoDocTrabajador || "Cédula de Ciudadanía"} ${datos.cedulaTrabajador || ''}</div></div>
            </div>
            `}

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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                  {contrato.firmado && (
                    <div style={{
                      padding: '6px 12px',
                      backgroundColor: '#e3f2fd',
                      color: '#1565c0',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 'bold',
                      textAlign: 'center'
                    }}>
                      ✍️ Firmado digitalmente
                    </div>
                  )}
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
                    backgroundColor: contrato.firmado ? '#2e7d32' : '#c62828',
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
                  {contrato.firmado ? '✍️ Ver Contrato Firmado (PDF)' : '📄 Ver / Imprimir Contrato (PDF)'}
                </button>
                <p style={{ color: '#666', fontSize: 12, marginTop: 10 }}>
                  {contrato.firmado 
                    ? 'Tu contrato está firmado digitalmente y cuenta con validez legal'
                    : 'Se abrirá una ventana con tu contrato listo para imprimir o guardar como PDF'}
                </p>
              </div>
            </div>
            
            {/* Fecha de generación y firma */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#999', fontSize: 12, margin: 0 }}>
                Contrato generado el {new Date(contrato.fechageneracion || contrato.created_at).toLocaleDateString('es-CO', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}
              </p>
              {contrato.firmado && contrato.fecha_firma && (
                <p style={{ color: '#2e7d32', fontSize: 12, margin: '4px 0 0 0', fontWeight: 'bold' }}>
                  ✓ Firmado el {new Date(contrato.fecha_firma).toLocaleDateString('es-CO', {
                    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              )}
            </div>
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
    // Usar eventos del estado global (cargados en cargarHorarios)
    const eventos = eventosEmpleado;
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
    
    // Función para formatear fecha en zona local (evita problemas con UTC)
    const formatearFechaLocal = (fecha) => {
      const year = fecha.getFullYear();
      const month = String(fecha.getMonth() + 1).padStart(2, '0');
      const day = String(fecha.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // Crear mapa de horarios por fecha para acceso rápido
    const horariosPorFecha = {};
    horarios.forEach(h => {
      horariosPorFecha[h.fecha] = h;
    });
    
    // Función para obtener ausencia de una fecha específica
    const getAusenciaFecha = (fechaStr) => {
      for (const ausencia of ausencias) {
        // Normalizar fechas a formato YYYY-MM-DD (solo la parte de fecha)
        const inicio = (ausencia.fechainicio || '').split('T')[0];
        const fin = (ausencia.fechafin || '').split('T')[0];
        
        if (inicio && fin && fechaStr >= inicio && fechaStr <= fin) {
          return ausencia;
        }
      }
      return null;
    };
    
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
    const diaActual = hoy.getDate();
    const esPrimeraQuincena = diaActual <= 15; // Días 1-15 = primera quincena
    
    const mesActual = { year: hoy.getFullYear(), month: hoy.getMonth() };
    const mesAnterior = hoy.getMonth() === 0 
      ? { year: hoy.getFullYear() - 1, month: 11 }
      : { year: hoy.getFullYear(), month: hoy.getMonth() - 1 };
    const mesSiguiente = hoy.getMonth() === 11
      ? { year: hoy.getFullYear() + 1, month: 0 }
      : { year: hoy.getFullYear(), month: hoy.getMonth() + 1 };
    
    const semanasActual = generarSemanasDelMes(mesActual.year, mesActual.month);
    const semanasAnterior = generarSemanasDelMes(mesAnterior.year, mesAnterior.month);
    const semanasSiguiente = generarSemanasDelMes(mesSiguiente.year, mesSiguiente.month);
    
    const renderizarCalendario = (semanas, year, month) => {
      const hoyStr = formatearFechaLocal(hoy);
      
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
                const fechaStr = formatearFechaLocal(fecha);
                const esDelMes = fecha.getMonth() === month;
                const esHoy = fechaStr === hoyStr;
                const horario = horariosPorFecha[fechaStr];
                const esPasado = fechaStr < hoyStr;
                const esDomingo = diaIdx === 0;
                const festivo = festivosColombia2026[fechaStr];
                const evento = eventos[fechaStr];
                const esFestivo = !!festivo;
                
                // Verificar si hay ausencia para esta fecha
                const ausencia = getAusenciaFecha(fechaStr);
                const tipoAusencia = ausencia?.tipo; // Vacaciones, Incapacidad, Permiso, Suspensión, etc.
                
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
                        fontSize: 10,
                        backgroundColor: (typeof evento === 'object' ? evento.color : null) || '#9c27b0',
                        color: (evento.color && ['#fff3a6', '#d1f4ff', '#b3e5fc', '#e8ffe1', '#f9d6ff', '#ffe0db'].includes(evento.color)) ? '#333' : 'white',
                        padding: '4px 6px',
                        borderRadius: 4,
                        marginBottom: 4,
                        fontWeight: 'bold',
                        textAlign: 'center',
                        border: '2px solid rgba(0,0,0,0.2)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.25)'
                      }}>
                        📌 {typeof evento === 'object' ? (evento.nombre || evento.titulo || evento.eventoId || 'Evento') : evento}
                      </div>
                    )}
                    
                    {/* Mostrar ausencia (Incapacidad, Vacaciones, Permiso, etc.) */}
                    {ausencia && esDelMes && (
                      <div style={{
                        backgroundColor: tipoAusencia === 'Vacaciones' ? '#dbeafe' : 
                                        tipoAusencia === 'Incapacidad' ? '#fce7f3' : 
                                        tipoAusencia === 'Suspensión' ? '#fee2e2' : 
                                        tipoAusencia === 'Permiso' ? '#fef3c7' : '#e5e7eb',
                        color: tipoAusencia === 'Vacaciones' ? '#1e40af' : 
                               tipoAusencia === 'Incapacidad' ? '#9d174d' : 
                               tipoAusencia === 'Suspensión' ? '#b91c1c' : 
                               tipoAusencia === 'Permiso' ? '#92400e' : '#374151',
                        padding: '6px 6px',
                        borderRadius: 4,
                        textAlign: 'center',
                        fontWeight: '800',
                        fontSize: 11,
                        border: tipoAusencia === 'Vacaciones' ? '2px solid #3b82f6' : 
                                tipoAusencia === 'Incapacidad' ? '2px solid #ec4899' : 
                                tipoAusencia === 'Suspensión' ? '2px solid #ef4444' : 
                                tipoAusencia === 'Permiso' ? '2px solid #f59e0b' : '2px solid #9ca3af'
                      }}>
                        {tipoAusencia === 'Vacaciones' && '🏖️ Vacaciones'}
                        {tipoAusencia === 'Incapacidad' && '🏥 Incapacidad'}
                        {tipoAusencia === 'Suspensión' && '⚠️ Suspensión'}
                        {tipoAusencia === 'Permiso' && '📋 Permiso'}
                        {!['Vacaciones', 'Incapacidad', 'Suspensión', 'Permiso'].includes(tipoAusencia) && `📌 ${tipoAusencia}`}
                      </div>
                    )}
                    
                    {/* Contenido del horario (solo si NO hay ausencia) */}
                    {horario && esDelMes && !ausencia && (
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
                              {horario.sede && (
                                <div style={{ fontSize: 9, color: '#b71c1c', fontWeight: '600', marginTop: 1 }}>
                                  📍 {horario.sede}
                                </div>
                              )}
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
                              {horario.segundo_turno.sede && (
                                <div style={{ fontSize: 9, color: '#0d47a1', fontWeight: '600', marginTop: 1 }}>
                                  📍 {horario.segundo_turno.sede}
                                </div>
                              )}
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
                                📍 {horario.sede}
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
          📅 Calendario de horarios - {esPrimeraQuincena ? 'Mes actual y mes anterior' : 'Mes actual y mes siguiente'}
          {Object.keys(eventos).length > 0 && (
            <span style={{ marginLeft: 10, color: '#10b981', fontWeight: 'bold' }}>
              📌 {Object.keys(eventos).length} evento(s) programado(s)
            </span>
          )}
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
                <div style={{ width: 18, height: 18, backgroundColor: '#fff3a6', border: '1px solid #f9a825', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11 }}>🧊 Congelador</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#d1f4ff', border: '1px solid #4dd0e1', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11 }}>🔔 Campana</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#b3e5fc', border: '1px solid #29b6f6', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11 }}>❄️ Refrigerador</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#e8ffe1', border: '1px solid #66bb6a', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11 }}>🧹 Aseo</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#f9d6ff', border: '1px solid #ba68c8', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11 }}>📦 Inventario</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#ffe0db', border: '1px solid #ef9a9a', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11 }}>👥 Reunión</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#dbeafe', border: '2px solid #3b82f6', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11 }}>🏖️ Vacaciones</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#fce7f3', border: '2px solid #ec4899', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11 }}>🏥 Incapacidad</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#fef3c7', border: '2px solid #f59e0b', borderRadius: 3 }}></div>
                <span style={{ fontSize: 11 }}>📋 Permiso</span>
              </div>
            </div>
            
            {/* Mes Actual */}
            {renderizarCalendario(semanasActual, mesActual.year, mesActual.month)}
            
            {/* Mes Anterior (solo en primera quincena) o Mes Siguiente (solo en segunda quincena) */}
            {esPrimeraQuincena 
              ? renderizarCalendario(semanasAnterior, mesAnterior.year, mesAnterior.month)
              : renderizarCalendario(semanasSiguiente, mesSiguiente.year, mesSiguiente.month)
            }
          </div>
        )}
      </div>
    );
  };

  // Componente para que el empleado responda a solicitudes con archivos adjuntos
  const FormularioRespuestaEmpleado = ({ solicitudId, onEnviar, empleadoDoc }) => {
    const [textoRespuesta, setTextoRespuesta] = useState('');
    const [archivosRespuesta, setArchivosRespuesta] = useState([]);
    const [subiendoArchivo, setSubiendoArchivo] = useState(false);
    const [enviando, setEnviando] = useState(false);

    // Función para subir archivo
    const subirArchivoRespuesta = async (archivo) => {
      setSubiendoArchivo(true);
      try {
        const nombreArchivo = `solicitudes/respuesta_${solicitudId}_${Date.now()}_${archivo.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error } = await supabase.storage
          .from('empleados-docs')
          .upload(nombreArchivo, archivo);
        
        if (error) throw error;
        
        const { data: urlData } = supabase.storage
          .from('empleados-docs')
          .getPublicUrl(nombreArchivo);
        
        setArchivosRespuesta(prev => [...prev, {
          nombre: archivo.name,
          url: urlData.publicUrl,
          tipo: archivo.type,
          tamaño: archivo.size,
          fecha: new Date().toISOString()
        }]);
      } catch (error) {
        console.error('Error subiendo archivo:', error);
        alert('❌ Error al subir el archivo');
      }
      setSubiendoArchivo(false);
    };

    const eliminarArchivo = (index) => {
      setArchivosRespuesta(prev => prev.filter((_, i) => i !== index));
    };

    const handleEnviar = async () => {
      if (!textoRespuesta.trim()) {
        alert('Por favor escribe tu respuesta');
        return;
      }
      setEnviando(true);
      try {
        await onEnviar(solicitudId, textoRespuesta, archivosRespuesta, false);
      } catch (e) {
        console.error('Error enviando respuesta:', e);
      }
      setEnviando(false);
    };

    return (
      <div style={{
        marginTop: 16,
        padding: 16,
        backgroundColor: '#f3e5f5',
        borderRadius: 12,
        border: '2px solid #ce93d8'
      }}>
        <div style={{ 
          fontWeight: 'bold', 
          color: '#7b1fa2', 
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span style={{ fontSize: 20 }}>📨</span>
          RRHH te ha enviado una propuesta. Por favor responde:
        </div>
        
        <textarea
          value={textoRespuesta}
          onChange={(e) => setTextoRespuesta(e.target.value)}
          rows={3}
          placeholder="Escribe tu respuesta aquí... (ej: Acepto la propuesta / No estoy de acuerdo porque...)"
          style={{
            width: '100%',
            padding: 12,
            border: '1px solid #ce93d8',
            borderRadius: 8,
            resize: 'vertical',
            boxSizing: 'border-box',
            marginBottom: 12
          }}
        />

        {/* Sección de archivos adjuntos */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', fontSize: 13, color: '#7b1fa2' }}>
            📎 Adjuntar archivos (opcional)
          </label>
          <div style={{
            border: '2px dashed #ce93d8',
            borderRadius: 8,
            padding: 12,
            textAlign: 'center',
            backgroundColor: '#faf5fb'
          }}>
            <input
              type="file"
              id={`archivo-respuesta-${solicitudId}`}
              multiple
              onChange={async (e) => {
                const files = Array.from(e.target.files);
                for (const file of files) {
                  await subirArchivoRespuesta(file);
                }
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />
            <label
              htmlFor={`archivo-respuesta-${solicitudId}`}
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: '#e1bee7',
                border: '1px solid #ce93d8',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              {subiendoArchivo ? '⏳ Subiendo...' : '📁 Seleccionar archivos'}
            </label>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9c27b0' }}>
              PDFs, imágenes, documentos (máx. 5MB por archivo)
            </p>
          </div>
          
          {/* Lista de archivos adjuntos */}
          {archivosRespuesta.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {archivosRespuesta.map((archivo, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  backgroundColor: '#e8f5e9',
                  borderRadius: 6,
                  marginBottom: 4,
                  fontSize: 12
                }}>
                  <a href={archivo.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2e7d32', textDecoration: 'none' }}>
                    📄 {archivo.nombre}
                  </a>
                  <button
                    type="button"
                    onClick={() => eliminarArchivo(idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#c62828',
                      cursor: 'pointer',
                      fontSize: 14
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
          onClick={handleEnviar}
          disabled={enviando || subiendoArchivo}
          style={{
            width: '100%',
            padding: '12px 20px',
            backgroundColor: enviando || subiendoArchivo ? '#b39ddb' : '#7b1fa2',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: enviando || subiendoArchivo ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: 14
          }}
        >
          {enviando ? '⏳ Enviando...' : '📤 Enviar Respuesta'}
        </button>
      </div>
    );
  };

  // RADICAR SOLICITUD
  const SeccionSolicitudes = () => {
    // Usar el estado del padre para la pestaña activa
    const pestanaActiva = pestanaSolicitudes;
    const setPestanaActiva = setPestanaSolicitudes;
    
    const [tipoSolicitud, setTipoSolicitud] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [archivosAdjuntos, setArchivosAdjuntos] = useState([]);
    const [subiendoArchivo, setSubiendoArchivo] = useState(false);
    
    // Bloqueos de solicitudes
    const [bloqueosActivos, setBloqueosActivos] = useState([]);
    
    // Campos adicionales para tipos específicos
    const [valorAdelanto, setValorAdelanto] = useState('');
    const [propuestaPago, setPropuestaPago] = useState('');
    const [epsActual, setEpsActual] = useState('');
    const [epsNueva, setEpsNueva] = useState('');
    const [observaciones, setObservaciones] = useState('');
    
    // Campos para Incapacidad/Permiso
    const [numeroDias, setNumeroDias] = useState('');
    const [fechaInicialIncapacidad, setFechaInicialIncapacidad] = useState('');
    const [esAccidenteLaboral, setEsAccidenteLaboral] = useState(false);
    const [archivoIncapacidad, setArchivoIncapacidad] = useState(null);
    const [subiendoArchivoIncapacidad, setSubiendoArchivoIncapacidad] = useState(false);

    // === ESTADOS PARA SOLICITUDES DEL EMPLEADOR ===
    const [solicitudesEmpleador, setSolicitudesEmpleador] = useState([]);
    const [cargandoSolicitudesEmpleador, setCargandoSolicitudesEmpleador] = useState(false);
    const [solicitudEmpleadorSeleccionada, setSolicitudEmpleadorSeleccionada] = useState(null);
    const [respuestaEmpleado, setRespuestaEmpleado] = useState('');
    const [archivosRespuestaEmpleado, setArchivosRespuestaEmpleado] = useState([]);
    const [enviandoRespuestaEmpleado, setEnviandoRespuestaEmpleado] = useState(false);
    const [subiendoArchivoRespuestaEmpleado, setSubiendoArchivoRespuestaEmpleado] = useState(false);

    // Cargar solicitudes del empleador dirigidas a este empleado
    const cargarSolicitudesEmpleador = async () => {
      setCargandoSolicitudesEmpleador(true);
      try {
        const doc = empleado?.documento || usuario?.usuario;
        if (!doc) {
          console.log('No hay documento de empleado para cargar solicitudes del empleador');
          setCargandoSolicitudesEmpleador(false);
          return;
        }
        
        const { data, error } = await supabase
          .from('solicitudes_empleador')
          .select('*')
          .eq('empleado_documento', doc)
          .order('fecha_creacion', { ascending: false });
        
        if (error) {
          if (error.code === '42P01') {
            console.log('⚠️ Tabla solicitudes_empleador no existe aún');
          } else {
            console.error('Error cargando solicitudes del empleador:', error);
          }
        } else {
          setSolicitudesEmpleador(data || []);
          console.log('📬 Solicitudes del empleador cargadas:', data?.length || 0);
        }
      } catch (err) {
        console.error('Error cargando solicitudes del empleador:', err);
      }
      setCargandoSolicitudesEmpleador(false);
    };

    // Subir archivo de respuesta del empleado
    const subirArchivoRespuestaEmpleado = async (archivo) => {
      setSubiendoArchivoRespuestaEmpleado(true);
      try {
        const nombreArchivo = `solicitudes_empleador/respuesta_${Date.now()}_${archivo.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error } = await supabase.storage
          .from('empleados-docs')
          .upload(nombreArchivo, archivo);
        
        if (error) throw error;
        
        const { data: urlData } = supabase.storage
          .from('empleados-docs')
          .getPublicUrl(nombreArchivo);
        
        setArchivosRespuestaEmpleado(prev => [...prev, {
          nombre: archivo.name,
          url: urlData.publicUrl
        }]);
      } catch (error) {
        console.error('Error subiendo archivo:', error);
        alert('Error al subir el archivo');
      }
      setSubiendoArchivoRespuestaEmpleado(false);
    };

    // Enviar respuesta del empleado a una solicitud del empleador
    const enviarRespuestaEmpleado = async () => {
      if (!solicitudEmpleadorSeleccionada) return;
      if (!respuestaEmpleado.trim()) {
        alert('Por favor escribe tu respuesta');
        return;
      }

      setEnviandoRespuestaEmpleado(true);
      try {
        const updateData = {
          estado: 'respondida',
          respuesta_empleado: respuestaEmpleado.trim(),
          fecha_respuesta_empleado: new Date().toISOString()
        };

        if (archivosRespuestaEmpleado.length > 0) {
          updateData.archivos_respuesta_empleado = JSON.stringify(archivosRespuestaEmpleado);
        }

        const { error } = await supabase
          .from('solicitudes_empleador')
          .update(updateData)
          .eq('id', solicitudEmpleadorSeleccionada.id);

        if (error) throw error;

        // 📱 Enviar SMS al admin notificando la respuesta del empleado
        try {
          const empresaId = empleado?.empresa_id || usuario?.empresa_id;
          // Obtener configuración de notificaciones desde tabla empresas
          const { data: configData } = await supabase
            .from('empresas')
            .select('telefono_solicitudes_1, nombre_receptor_1, telefono_solicitudes_2, nombre_receptor_2')
            .eq('id', empresaId)
            .single();
          
          const nombreEmpleado = empleado?.nombre || usuario?.usuario || 'Un empleado';
          const mensaje = `BIGBURGUER - ${nombreEmpleado} ha respondido a la solicitud: "${solicitudEmpleadorSeleccionada.asunto}". Revise el sistema para ver los detalles.`;
          
          // Enviar SMS al teléfono 1 (si está configurado)
          if (configData?.telefono_solicitudes_1) {
            fetch('/api/enviar-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                telefono: configData.telefono_solicitudes_1,
                mensaje: mensaje
              })
            }).then(res => res.json())
              .then(data => {
                if (data.ok) {
                  console.log('📱 SMS #1 enviado al admin:', configData.nombre_receptor_1 || 'Admin 1');
                } else {
                  console.warn('📱 No se pudo enviar SMS #1:', data.error);
                }
              })
              .catch(err => console.warn('Error enviando SMS #1:', err));
          }
          
          // Enviar SMS al teléfono 2 (si está configurado)
          if (configData?.telefono_solicitudes_2) {
            fetch('/api/enviar-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                telefono: configData.telefono_solicitudes_2,
                mensaje: mensaje
              })
            }).then(res => res.json())
              .then(data => {
                if (data.ok) {
                  console.log('📱 SMS #2 enviado al admin:', configData.nombre_receptor_2 || 'Admin 2');
                } else {
                  console.warn('📱 No se pudo enviar SMS #2:', data.error);
                }
              })
              .catch(err => console.warn('Error enviando SMS #2:', err));
          }
          
          if (!configData?.telefono_solicitudes_1 && !configData?.telefono_solicitudes_2) {
            console.log('📱 No hay teléfonos de notificaciones configurados para esta empresa');
          }
        } catch (smsErr) {
          console.warn('Error al intentar enviar SMS:', smsErr);
        }

        alert('✅ Respuesta enviada correctamente');
        setSolicitudEmpleadorSeleccionada(null);
        setRespuestaEmpleado('');
        setArchivosRespuestaEmpleado([]);
        cargarSolicitudesEmpleador();
      } catch (error) {
        console.error('Error enviando respuesta:', error);
        alert('❌ Error al enviar la respuesta: ' + (error.message || 'Error desconocido'));
      }
      setEnviandoRespuestaEmpleado(false);
    };

    // Cargar solicitudes del empleador al cambiar a esa pestaña
    useEffect(() => {
      if (pestanaActiva === 'empleador') {
        cargarSolicitudesEmpleador();
      }
    }, [pestanaActiva]);

    // Cargar bloqueos de solicitudes al montar
    useEffect(() => {
      const cargarBloqueos = async () => {
        try {
          const hoy = new Date();
          const fechaHoy = hoy.toISOString().split('T')[0];
          const diaDelMes = hoy.getDate();
          console.log('🔒 Cargando bloqueos para fecha:', fechaHoy, 'día del mes:', diaDelMes);
          
          // Cargar todos los bloqueos activos
          const { data, error } = await supabase
            .from('bloqueos_solicitudes')
            .select('*')
            .eq('activo', true);
          
          console.log('🔒 Todos los bloqueos activos:', { data, error });
          
          if (error) {
            console.error('❌ Error cargando bloqueos:', error);
            if (error.code === '42P01') {
              console.log('⚠️ Tabla bloqueos_solicitudes no existe aún');
            }
          } else if (data && data.length > 0) {
            // Guardar TODOS los bloqueos activos - la verificación de vigencia se hace en tiempo real
            console.log('🔒 Bloqueos activos cargados:', data.length);
            setBloqueosActivos(data);
          } else {
            console.log('✅ No hay bloqueos activos');
          }
        } catch (err) {
          console.log('Error cargando bloqueos:', err);
        }
      };
      cargarBloqueos();
    }, []);

    // Verificar si un tipo de solicitud está bloqueado (verificación en tiempo real)
    const verificarBloqueo = (tipo) => {
      const hoy = new Date();
      const diaDelMes = hoy.getDate();
      const fechaHoy = hoy.toISOString().split('T')[0];
      
      // Buscar bloqueo específico para este tipo o bloqueo de "todas"
      const bloqueo = bloqueosActivos.find(b => {
        if (b.tipo_solicitud !== tipo && b.tipo_solicitud !== 'todas') return false;
        
        // Verificar vigencia en tiempo real
        if (b.es_recurrente) {
          // Bloqueo recurrente: verificar si el día actual está dentro del rango
          return diaDelMes >= b.dia_inicio && diaDelMes <= b.dia_fin;
        } else {
          // Bloqueo por fechas: verificar rango de fechas
          return b.fecha_inicio <= fechaHoy && b.fecha_fin >= fechaHoy;
        }
      });
      return bloqueo;
    };

    // Cargar solicitudes cuando se cambia a la pestaña estado
    useEffect(() => {
      if (pestanaActiva === 'estado') {
        const doc = empleado?.documento || usuario?.usuario;
        if (doc && solicitudes.length === 0) {
          cargarSolicitudes(doc);
        }
      }
    }, [pestanaActiva]);

    const tiposSolicitud = [
      { id: 'incapacidad_permiso', nombre: 'Incapacidad/Permiso', icono: '🏥' },
      { id: 'permiso', nombre: 'Permiso', icono: '🙋' },
      { id: 'vacaciones', nombre: 'Vacaciones', icono: '🏖️' },
      { id: 'adelanto_nomina', nombre: 'Adelanto de Nómina', icono: '💰' },
      { id: 'cambio_eps', nombre: 'Cambio de EPS', icono: '🏥' },
      { id: 'documentos_vinculacion', nombre: 'Documentos Vinculación', icono: '📁' },
      { id: 'documentos_actualizacion', nombre: 'Docs. Actualización', icono: '🔄' },
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
        // Verificar si el tipo de solicitud está bloqueado
        const bloqueo = verificarBloqueo(tipoSolicitud);
        if (bloqueo) {
          let mensajeDisponible = '';
          if (bloqueo.es_recurrente) {
            mensajeDisponible = `📅 Disponible a partir del día ${bloqueo.dia_fin + 1} de cada mes`;
          } else {
            const fechaFin = new Date(bloqueo.fecha_fin + 'T12:00:00').toLocaleDateString('es-CO');
            mensajeDisponible = `📅 Disponible después del: ${fechaFin}`;
          }
          alert(`🚫 Esta solicitud no está disponible en este momento.\n\n${bloqueo.motivo ? '📋 Motivo: ' + bloqueo.motivo + '\n' : ''}${mensajeDisponible}\n\nPor favor intente más tarde.`);
          setEnviando(false);
          return;
        }
        
        // Validación especial para incapacidad/permiso
        if (tipoSolicitud === 'incapacidad_permiso') {
          if (!numeroDias || !fechaInicialIncapacidad) {
            alert('⚠️ Por favor complete todos los campos obligatorios');
            setEnviando(false);
            return;
          }
          if (!archivoIncapacidad) {
            alert('⚠️ Por favor adjunte el documento de incapacidad (Historia clínica + Incapacidad)');
            setEnviando(false);
            return;
          }
        }
        
        // Construir descripción completa según tipo
        let descripcionCompleta = descripcion;
        let archivosParaGuardar = archivosAdjuntos;
        
        if (tipoSolicitud === 'incapacidad_permiso') {
          descripcionCompleta = `🏥 INCAPACIDAD/PERMISO\n📅 Número de días: ${numeroDias}\n📆 Fecha inicial: ${fechaInicialIncapacidad}\n⚠️ Accidente laboral: ${esAccidenteLaboral ? 'SÍ' : 'NO'}\n\n${descripcion}`;
          // Agregar archivo de incapacidad a los adjuntos
          if (archivoIncapacidad) {
            archivosParaGuardar = [...archivosAdjuntos, archivoIncapacidad];
          }
        } else if (tipoSolicitud === 'adelanto_nomina') {
          descripcionCompleta = `💰 Valor solicitado: $${valorAdelanto}\n📅 Propuesta de pago: ${propuestaPago}\n\n${descripcion}`;
        } else if (tipoSolicitud === 'cambio_eps') {
          descripcionCompleta = `🏥 EPS Actual: ${epsActual}\n🏥 EPS Nueva: ${epsNueva}\n\n${descripcion}`;
        } else if (tipoSolicitud === 'documentos_vinculacion' || tipoSolicitud === 'documentos_actualizacion') {
          descripcionCompleta = `📝 Observaciones: ${observaciones}\n\n${descripcion}`;
        }
        
        const { data, error } = await supabase
          .from('solicitudes_empleados')
          .insert({
            usuario_id: usuario.id,
            documento: empleado?.documento || usuario.usuario,
            empleado_nombre: empleado?.nombre || usuario.nombre,
            tipo: tipoSolicitud,
            descripcion: descripcionCompleta,
            fecha_inicio: tipoSolicitud === 'incapacidad_permiso' ? fechaInicialIncapacidad : (fechaInicio || null),
            fecha_fin: fechaFin || null,
            estado: 'recibido',
            fecha_creacion: new Date().toISOString(),
            empresa_id: empleado?.empresa_id || usuario.empresa_id,
            archivos_adjuntos: JSON.stringify(archivosParaGuardar)
          })
          .select('id')
          .single();
        
        if (!error) {
          alert('✅ Solicitud radicada correctamente. Número de radicado: ' + data.id.substring(0, 8).toUpperCase());
          
          // 📱 Enviar SMS de notificación a los números configurados para esta empresa
          try {
            const empresaId = empleado?.empresa_id || usuario.empresa_id;
            console.log('📱 Buscando configuración de notificaciones SMS para empresa:', empresaId);
            
            const { data: configData, error: configError } = await supabase
              .from('empresas')
              .select('telefono_solicitudes_1, nombre_receptor_1, telefono_solicitudes_2, nombre_receptor_2')
              .eq('id', empresaId)
              .single();
            
            console.log('📱 Config SMS empresa encontrada:', configData, 'Error:', configError);
            
            // Construir mensaje SMS
            const tipoNombre = {
              'incapacidad_permiso': 'Incapacidad/Permiso',
              'adelanto_nomina': 'Adelanto de Nomina',
              'cambio_eps': 'Cambio de EPS',
              'documentos_vinculacion': 'Documentos Vinculacion',
              'documentos_actualizacion': 'Docs. Actualizacion',
              'vacaciones': 'Vacaciones',
              'permiso': 'Permiso',
              'otro': 'Otra Solicitud'
            }[tipoSolicitud] || tipoSolicitud;
            
            const mensajeSMS = `BigBurguer - Nueva Solicitud
Tipo: ${tipoNombre}
Empleado: ${empleado?.nombre || empleado?.nombres || usuario.nombre}
Doc: ${empleado?.documento || usuario.usuario}
Fecha: ${new Date().toLocaleDateString('es-CO')}
Revise el panel de administracion.`;
            
            // Enviar SMS al teléfono 1 (si está configurado)
            if (configData?.telefono_solicitudes_1) {
              console.log('📱 Enviando SMS al teléfono 1:', configData.telefono_solicitudes_1, '(' + configData.nombre_receptor_1 + ')');
              
              fetch('/api/enviar-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  telefono: configData.telefono_solicitudes_1, 
                  mensaje: mensajeSMS 
                })
              }).then(r => r.json()).then(result => {
                console.log('📱 Resultado SMS #1:', result);
                if (result.ok) console.log('📱 SMS #1 enviado a:', configData.nombre_receptor_1 || 'Receptor 1');
                else console.warn('📱 Error SMS #1:', result);
              }).catch(err => console.warn('SMS #1 no enviado:', err));
            }
            
            // Enviar SMS al teléfono 2 (si está configurado)
            if (configData?.telefono_solicitudes_2) {
              console.log('📱 Enviando SMS al teléfono 2:', configData.telefono_solicitudes_2, '(' + configData.nombre_receptor_2 + ')');
              
              fetch('/api/enviar-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  telefono: configData.telefono_solicitudes_2, 
                  mensaje: mensajeSMS 
                })
              }).then(r => r.json()).then(result => {
                console.log('📱 Resultado SMS #2:', result);
                if (result.ok) console.log('📱 SMS #2 enviado a:', configData.nombre_receptor_2 || 'Receptor 2');
                else console.warn('📱 Error SMS #2:', result);
              }).catch(err => console.warn('SMS #2 no enviado:', err));
            }
            
            if (!configData?.telefono_solicitudes_1 && !configData?.telefono_solicitudes_2) {
              console.warn('📱 No hay teléfonos de notificaciones configurados para esta empresa');
            }
          } catch (smsErr) {
            console.warn('Error al enviar notificación SMS:', smsErr);
          }
          
          setPestanaActiva('estado');
          setTipoSolicitud('');
          setDescripcion('');
          setFechaInicio('');
          setFechaFin('');
          setArchivosAdjuntos([]);
          setValorAdelanto('');
          setPropuestaPago('');
          setEpsActual('');
          setEpsNueva('');
          setObservaciones('');
          // Limpiar campos de incapacidad
          setNumeroDias('');
          setFechaInicialIncapacidad('');
          setEsAccidenteLaboral(false);
          setArchivoIncapacidad(null);
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
        case 'pendiente_confirmacion': return { bg: '#f3e5f5', color: '#7b1fa2', texto: '📨 PROPUESTA RECIBIDA', icono: '📨' };
        case 'confirmado_empleado': return { bg: '#e8f5e9', color: '#2e7d32', texto: '✅ CONFIRMADO', icono: '✅' };
        case 'rechazado_empleado': return { bg: '#fff3e0', color: '#e65100', texto: '🔄 RECHAZASTE PROPUESTA', icono: '🔄' };
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
              {/* Badge para propuestas pendientes de confirmación */}
              {solicitudes.filter(s => s.estado === 'pendiente_confirmacion').length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  backgroundColor: '#7b1fa2',
                  color: 'white',
                  borderRadius: '50%',
                  width: 24,
                  height: 24,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                  {solicitudes.filter(s => s.requiere_confirmacion && !s.respuesta_empleado && s.estado === 'en_proceso').length}
                </span>
              )}
              {/* Badge para otras pendientes */}
              {solicitudes.filter(s => s.requiere_confirmacion && !s.respuesta_empleado && s.estado === 'en_proceso').length === 0 && 
               solicitudes.filter(s => s.estado === 'recibido' || s.estado === 'en_proceso').length > 0 && (
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
            <button
              onClick={() => setPestanaActiva('empleador')}
              style={{
                padding: '12px 24px',
                backgroundColor: pestanaActiva === 'empleador' ? '#1565c0' : '#f5f5f5',
                color: pestanaActiva === 'empleador' ? 'white' : '#333',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
                position: 'relative'
              }}
            >
              📬 Del Empleador
              {/* Badge para solicitudes pendientes del empleador */}
              {solicitudesEmpleador.filter(s => s.estado === 'pendiente').length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  backgroundColor: '#1565c0',
                  color: 'white',
                  borderRadius: '50%',
                  width: 20,
                  height: 20,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}>
                  {solicitudesEmpleador.filter(s => s.estado === 'pendiente').length}
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
                  {/* Mensaje si hay bloqueo de todas las solicitudes */}
                  {verificarBloqueo('todas') && (
                    <div style={{
                      backgroundColor: '#ffebee',
                      border: '2px solid #f44336',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 12,
                      color: '#c62828',
                      textAlign: 'center'
                    }}>
                      🚫 <strong>Las solicitudes están temporalmente bloqueadas</strong>
                      {verificarBloqueo('todas').motivo && (
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          Motivo: {verificarBloqueo('todas').motivo}
                        </div>
                      )}
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        {verificarBloqueo('todas').es_recurrente 
                          ? `Disponible a partir del día ${verificarBloqueo('todas').dia_fin + 1} de este mes`
                          : `Disponible después del: ${new Date(verificarBloqueo('todas').fecha_fin + 'T12:00:00').toLocaleDateString('es-CO')}`
                        }
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {tiposSolicitud.map(tipo => {
                      const bloqueoTipo = verificarBloqueo(tipo.id);
                      const estaBloqueado = !!bloqueoTipo;
                      
                      return (
                        <button
                          key={tipo.id}
                          type="button"
                          onClick={() => {
                            if (estaBloqueado) {
                              let mensajeDisponible = '';
                              if (bloqueoTipo.es_recurrente) {
                                mensajeDisponible = `Disponible a partir del día ${bloqueoTipo.dia_fin + 1} de este mes`;
                              } else {
                                mensajeDisponible = `Disponible después del: ${new Date(bloqueoTipo.fecha_fin + 'T12:00:00').toLocaleDateString('es-CO')}`;
                              }
                              alert(`🚫 Este tipo de solicitud no está disponible.\n\n${bloqueoTipo.motivo ? 'Motivo: ' + bloqueoTipo.motivo + '\n' : ''}${mensajeDisponible}`);
                            } else {
                              setTipoSolicitud(tipo.id);
                            }
                          }}
                          style={{
                            padding: 16,
                            backgroundColor: estaBloqueado ? '#f5f5f5' : (tipoSolicitud === tipo.id ? '#ffebee' : '#f5f5f5'),
                            border: estaBloqueado ? '2px dashed #ccc' : (tipoSolicitud === tipo.id ? '2px solid #d32f2f' : '1px solid #e0e0e0'),
                            borderRadius: 8,
                            cursor: estaBloqueado ? 'not-allowed' : 'pointer',
                            textAlign: 'center',
                            opacity: estaBloqueado ? 0.5 : 1,
                            position: 'relative'
                          }}
                        >
                          {estaBloqueado && (
                            <div style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              fontSize: 14
                            }}>
                              🔒
                            </div>
                          )}
                          <div style={{ fontSize: 24 }}>{tipo.icono}</div>
                          <div style={{ fontSize: 12, marginTop: 4, color: estaBloqueado ? '#999' : 'inherit' }}>
                            {tipo.nombre}
                          </div>
                          {estaBloqueado && (
                            <div style={{ fontSize: 9, color: '#999', marginTop: 2 }}>
                              No disponible
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Campos para Permiso y Vacaciones - fechas */}
                {(tipoSolicitud === 'permiso' || tipoSolicitud === 'vacaciones') && (
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

                {/* Campos para Incapacidad/Permiso */}
                {tipoSolicitud === 'incapacidad_permiso' && (
                  <div style={{ marginBottom: 20, padding: 16, backgroundColor: '#ffebee', borderRadius: 12 }}>
                    <h4 style={{ margin: '0 0 16px', color: '#c62828' }}>🏥 Información de Incapacidad/Permiso</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                          Número de días *
                        </label>
                        <input
                          type="number"
                          value={numeroDias}
                          onChange={(e) => setNumeroDias(e.target.value)}
                          required
                          min="1"
                          placeholder="Ej: 3"
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
                          Fecha inicial *
                        </label>
                        <input
                          type="date"
                          value={fechaInicialIncapacidad}
                          onChange={(e) => setFechaInicialIncapacidad(e.target.value)}
                          required
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
                    
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={esAccidenteLaboral}
                          onChange={(e) => setEsAccidenteLaboral(e.target.checked)}
                          style={{ width: 20, height: 20 }}
                        />
                        <span style={{ fontWeight: 'bold' }}>¿Es accidente laboral?</span>
                      </label>
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                        📎 Adjuntar documento (Historia clínica + Incapacidad en 1 solo documento legible y en formato PDF) *
                      </label>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            setSubiendoArchivoIncapacidad(true);
                            try {
                              const nombreArchivo = `incapacidades/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                              const { error } = await supabase.storage
                                .from('empleados-docs')
                                .upload(nombreArchivo, file);
                              
                              if (error) throw error;
                              
                              const { data: urlData } = supabase.storage
                                .from('empleados-docs')
                                .getPublicUrl(nombreArchivo);
                              
                              setArchivoIncapacidad({
                                nombre: file.name,
                                url: urlData.publicUrl,
                                tipo: file.type
                              });
                            } catch (error) {
                              alert('Error al subir archivo: ' + error.message);
                            } finally {
                              setSubiendoArchivoIncapacidad(false);
                            }
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: 12,
                          border: '2px dashed #c62828',
                          borderRadius: 8,
                          backgroundColor: '#fff',
                          cursor: 'pointer'
                        }}
                        disabled={subiendoArchivoIncapacidad}
                      />
                      {subiendoArchivoIncapacidad && (
                        <p style={{ color: '#c62828', marginTop: 8 }}>⏳ Subiendo archivo...</p>
                      )}
                      {archivoIncapacidad && (
                        <div style={{ 
                          marginTop: 12, 
                          padding: 12, 
                          backgroundColor: '#e8f5e9', 
                          borderRadius: 8,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>✅ {archivoIncapacidad.nombre}</span>
                          <button
                            type="button"
                            onClick={() => setArchivoIncapacidad(null)}
                            style={{
                              background: '#f44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              padding: '4px 8px',
                              cursor: 'pointer'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Campos para Adelanto de Nómina */}
                {tipoSolicitud === 'adelanto_nomina' && (
                  <div style={{ marginBottom: 20, padding: 16, backgroundColor: '#fff3e0', borderRadius: 12 }}>
                    <h4 style={{ margin: '0 0 16px', color: '#e65100' }}>💰 Información del Adelanto</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                          Valor solicitado *
                        </label>
                        <input
                          type="number"
                          value={valorAdelanto}
                          onChange={(e) => setValorAdelanto(e.target.value)}
                          required
                          placeholder="Ej: 500000"
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
                          Propuesta de pago *
                        </label>
                        <input
                          type="text"
                          value={propuestaPago}
                          onChange={(e) => setPropuestaPago(e.target.value)}
                          required
                          placeholder="Ej: Descuento en 2 quincenas"
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
                  </div>
                )}

                {/* Campos para Cambio de EPS */}
                {tipoSolicitud === 'cambio_eps' && (
                  <div style={{ marginBottom: 20, padding: 16, backgroundColor: '#e3f2fd', borderRadius: 12 }}>
                    <h4 style={{ margin: '0 0 16px', color: '#1565c0' }}>🏥 Información de EPS</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                          EPS Actual *
                        </label>
                        <input
                          type="text"
                          value={epsActual}
                          onChange={(e) => setEpsActual(e.target.value)}
                          required
                          placeholder="Ej: Sura, Nueva EPS, etc."
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
                          EPS a trasladar *
                        </label>
                        <input
                          type="text"
                          value={epsNueva}
                          onChange={(e) => setEpsNueva(e.target.value)}
                          required
                          placeholder="Ej: Sanitas, Compensar, etc."
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
                  </div>
                )}

                {/* Campos para Documentos Vinculación y Actualización */}
                {(tipoSolicitud === 'documentos_vinculacion' || tipoSolicitud === 'documentos_actualizacion') && (
                  <div style={{ marginBottom: 20, padding: 16, backgroundColor: '#f3e5f5', borderRadius: 12 }}>
                    <h4 style={{ margin: '0 0 16px', color: '#7b1fa2' }}>
                      {tipoSolicitud === 'documentos_vinculacion' ? '📁 Documentos de Vinculación' : '🔄 Documentos para Actualización'}
                    </h4>
                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                        Observaciones *
                      </label>
                      <textarea
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        required
                        rows={3}
                        placeholder="Describe qué documentos estás adjuntando y el motivo..."
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
                    <p style={{ margin: '12px 0 0', fontSize: 12, color: '#666' }}>
                      ⚠️ Recuerda adjuntar los documentos en la sección de archivos más abajo.
                    </p>
                  </div>
                )}
                
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                    {tipoSolicitud === 'documentos_vinculacion' || tipoSolicitud === 'documentos_actualizacion' 
                      ? 'Descripción adicional (opcional)' 
                      : 'Descripción / Motivo *'}
                  </label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    required={tipoSolicitud !== 'documentos_vinculacion' && tipoSolicitud !== 'documentos_actualizacion'}
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

                {/* Sección de archivos adjuntos - NO mostrar para incapacidad (ya tiene su propio campo) */}
                {tipoSolicitud !== 'incapacidad_permiso' && (
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
                )}
                
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
                    
                    // Parsear archivos adjuntos (pueden venir como string JSON)
                    let archivosAdj = [];
                    try {
                      if (sol.archivos_adjuntos) {
                        archivosAdj = typeof sol.archivos_adjuntos === 'string' 
                          ? JSON.parse(sol.archivos_adjuntos) 
                          : sol.archivos_adjuntos;
                      }
                    } catch (e) { archivosAdj = []; }
                    
                    // Parsear archivos de respuesta
                    let archivosResp = [];
                    try {
                      if (sol.archivos_respuesta) {
                        archivosResp = typeof sol.archivos_respuesta === 'string' 
                          ? JSON.parse(sol.archivos_respuesta) 
                          : sol.archivos_respuesta;
                      }
                    } catch (e) { archivosResp = []; }
                    
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
                        {archivosAdj && archivosAdj.length > 0 && (
                          <div style={{ marginTop: 12, padding: 10, backgroundColor: '#e3f2fd', borderRadius: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>📎 Archivos adjuntos:</div>
                            {archivosAdj.map((arch, idx) => (
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
                        {archivosResp && archivosResp.length > 0 && (
                          <div style={{ marginTop: 8, padding: 10, backgroundColor: '#fff8e1', borderRadius: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>📎 Archivos de respuesta:</div>
                            {archivosResp.map((arch, idx) => (
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

                        {/* Formulario para responder a propuesta de RRHH */}
                        {sol.requiere_confirmacion && sol.estado === 'en_proceso' && !sol.respuesta_empleado && (
                          <FormularioRespuestaEmpleado 
                            solicitudId={sol.id} 
                            onEnviar={responderPropuesta}
                            empleadoDoc={empleado?.documento || usuario?.usuario}
                          />
                        )}

                        {/* Mostrar respuesta del empleado ya enviada */}
                        {sol.respuesta_empleado && (
                          <div style={{
                            marginTop: 12,
                            padding: 12,
                            backgroundColor: '#e8f5e9',
                            borderRadius: 8,
                            border: '1px solid #4caf50'
                          }}>
                            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#2e7d32', marginBottom: 4 }}>
                              ✅ Tu respuesta:
                            </div>
                            <p style={{ margin: 0, fontSize: 13, color: '#333' }}>{sol.respuesta_empleado}</p>
                            
                            {/* Mostrar archivos adjuntos de la respuesta */}
                            {sol.archivos_respuesta_empleado && (() => {
                              let archivosResp = [];
                              try {
                                archivosResp = typeof sol.archivos_respuesta_empleado === 'string' 
                                  ? JSON.parse(sol.archivos_respuesta_empleado) 
                                  : sol.archivos_respuesta_empleado;
                              } catch(e) { archivosResp = []; }
                              
                              return archivosResp.length > 0 && (
                                <div style={{ marginTop: 8, padding: 8, backgroundColor: '#c8e6c9', borderRadius: 6 }}>
                                  <div style={{ fontSize: 11, fontWeight: 'bold', color: '#1b5e20', marginBottom: 4 }}>
                                    📎 Archivos adjuntos:
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {archivosResp.map((arch, idx) => (
                                      <a
                                        key={idx}
                                        href={arch.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          padding: '4px 8px',
                                          backgroundColor: 'white',
                                          borderRadius: 4,
                                          fontSize: 11,
                                          color: '#2e7d32',
                                          textDecoration: 'none',
                                          border: '1px solid #81c784'
                                        }}
                                      >
                                        📄 {arch.nombre}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                            
                            {sol.fecha_respuesta_empleado && (
                              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                                Enviada: {new Date(sol.fecha_respuesta_empleado).toLocaleString('es-CO')}
                              </div>
                            )}
                            {sol.estado === 'en_proceso' && (
                              <div style={{ fontSize: 11, color: '#ff9800', marginTop: 4, fontWeight: 'bold' }}>
                                ⏳ Esperando respuesta definitiva de RRHH...
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Pestaña Solicitudes del Empleador */}
          {pestanaActiva === 'empleador' && (
            <div>
              <h3 style={{ color: '#1565c0', marginBottom: 20, marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                📬 Solicitudes del Empleador
              </h3>
              <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>
                Aquí aparecen las solicitudes que la empresa te ha enviado para que respondas.
              </p>

              {cargandoSolicitudesEmpleador ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
                  <p>Cargando solicitudes...</p>
                </div>
              ) : solicitudesEmpleador.length === 0 ? (
                <div style={{
                  padding: 40,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 12,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 60, marginBottom: 16 }}>📭</div>
                  <h3>No tienes solicitudes del empleador</h3>
                  <p style={{ color: '#666' }}>
                    Cuando la empresa te envíe alguna solicitud, aparecerá aquí.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {solicitudesEmpleador.map(sol => {
                    let archivosAdj = [];
                    try {
                      if (sol.archivos_adjuntos) {
                        archivosAdj = typeof sol.archivos_adjuntos === 'string' 
                          ? JSON.parse(sol.archivos_adjuntos) 
                          : sol.archivos_adjuntos;
                      }
                    } catch (e) { archivosAdj = []; }

                    return (
                      <div
                        key={sol.id}
                        style={{
                          padding: 16,
                          backgroundColor: sol.estado === 'pendiente' ? '#fff3e0' : '#e8f5e9',
                          border: sol.estado === 'pendiente' ? '2px solid #ff9800' : '1px solid #4caf50',
                          borderRadius: 12
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{
                                padding: '2px 8px',
                                backgroundColor: sol.prioridad === 'urgente' ? '#f44336' : sol.prioridad === 'alta' ? '#ff9800' : '#4caf50',
                                color: 'white',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 'bold'
                              }}>
                                {sol.prioridad === 'urgente' ? '🔴 URGENTE' : sol.prioridad === 'alta' ? '🟠 ALTA' : '🟢 NORMAL'}
                              </span>
                              <span style={{ fontSize: 11, color: '#999' }}>
                                📅 {new Date(sol.fecha_creacion).toLocaleDateString('es-CO')}
                              </span>
                            </div>
                            <div style={{ fontWeight: 'bold', fontSize: 16, color: '#1565c0', marginBottom: 8 }}>
                              {sol.asunto}
                            </div>
                            <p style={{ margin: '0 0 12px', color: '#333', fontSize: 14, lineHeight: 1.5 }}>
                              {sol.descripcion}
                            </p>

                            {/* Archivos adjuntos */}
                            {archivosAdj.length > 0 && (
                              <div style={{ marginBottom: 12, padding: 10, backgroundColor: '#e3f2fd', borderRadius: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>📎 Archivos adjuntos:</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {archivosAdj.map((arch, idx) => (
                                    <a
                                      key={idx}
                                      href={arch.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        padding: '4px 8px',
                                        backgroundColor: 'white',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        color: '#1565c0',
                                        textDecoration: 'none'
                                      }}
                                    >
                                      📄 {arch.nombre}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <span style={{
                            padding: '6px 12px',
                            backgroundColor: sol.estado === 'pendiente' ? '#ff9800' : '#4caf50',
                            color: 'white',
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 'bold'
                          }}>
                            {sol.estado === 'pendiente' ? '⏳ PENDIENTE' : '✅ RESPONDIDA'}
                          </span>
                        </div>

                        {/* Si ya respondió, mostrar la respuesta */}
                        {sol.respuesta_empleado && (
                          <div style={{
                            marginTop: 12,
                            padding: 12,
                            backgroundColor: '#e8f5e9',
                            borderRadius: 8,
                            border: '1px solid #4caf50'
                          }}>
                            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#2e7d32', marginBottom: 4 }}>
                              ✅ Tu respuesta:
                            </div>
                            <p style={{ margin: 0, fontSize: 13, color: '#333' }}>{sol.respuesta_empleado}</p>
                            {sol.fecha_respuesta_empleado && (
                              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                                Enviada: {new Date(sol.fecha_respuesta_empleado).toLocaleString('es-CO')}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Si está pendiente, mostrar formulario para responder */}
                        {sol.estado === 'pendiente' && sol.requiere_respuesta && (
                          <div style={{
                            marginTop: 12,
                            padding: 16,
                            backgroundColor: '#fafafa',
                            borderRadius: 8,
                            border: '1px dashed #ccc'
                          }}>
                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', fontSize: 13 }}>
                              ✍️ Tu respuesta:
                            </label>
                            <textarea
                              value={solicitudEmpleadorSeleccionada?.id === sol.id ? respuestaEmpleado : ''}
                              onChange={(e) => {
                                setSolicitudEmpleadorSeleccionada(sol);
                                setRespuestaEmpleado(e.target.value);
                              }}
                              onFocus={() => setSolicitudEmpleadorSeleccionada(sol)}
                              placeholder="Escribe tu respuesta aquí..."
                              rows={3}
                              style={{
                                width: '100%',
                                padding: 12,
                                border: '1px solid #ddd',
                                borderRadius: 8,
                                resize: 'vertical',
                                boxSizing: 'border-box',
                                marginBottom: 12
                              }}
                            />
                            
                            {/* Subir archivos */}
                            <div style={{ marginBottom: 12 }}>
                              <input
                                type="file"
                                multiple
                                onChange={(e) => {
                                  setSolicitudEmpleadorSeleccionada(sol);
                                  Array.from(e.target.files).forEach(file => subirArchivoRespuestaEmpleado(file));
                                }}
                                disabled={subiendoArchivoRespuestaEmpleado}
                                style={{ fontSize: 12 }}
                              />
                              {subiendoArchivoRespuestaEmpleado && <span style={{ fontSize: 11, color: '#666' }}> ⏳ Subiendo...</span>}
                              {archivosRespuestaEmpleado.length > 0 && solicitudEmpleadorSeleccionada?.id === sol.id && (
                                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {archivosRespuestaEmpleado.map((arch, idx) => (
                                    <span key={idx} style={{ padding: '4px 8px', backgroundColor: '#e3f2fd', borderRadius: 4, fontSize: 11 }}>
                                      📄 {arch.nombre}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                setSolicitudEmpleadorSeleccionada(sol);
                                enviarRespuestaEmpleado();
                              }}
                              disabled={enviandoRespuestaEmpleado || (solicitudEmpleadorSeleccionada?.id === sol.id && !respuestaEmpleado.trim())}
                              style={{
                                padding: '10px 20px',
                                backgroundColor: '#1565c0',
                                color: 'white',
                                border: 'none',
                                borderRadius: 8,
                                cursor: enviandoRespuestaEmpleado ? 'wait' : 'pointer',
                                fontWeight: 'bold',
                                fontSize: 13
                              }}
                            >
                              {enviandoRespuestaEmpleado ? '⏳ Enviando...' : '📤 Enviar Respuesta'}
                            </button>
                          </div>
                        )}

                        {/* Si no requiere respuesta */}
                        {sol.estado === 'pendiente' && !sol.requiere_respuesta && (
                          <div style={{
                            marginTop: 12,
                            padding: 10,
                            backgroundColor: '#e3f2fd',
                            borderRadius: 8,
                            textAlign: 'center',
                            fontSize: 13,
                            color: '#1565c0'
                          }}>
                            ℹ️ Esta solicitud es solo informativa, no requiere respuesta.
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
    const [reglamento, setReglamento] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [viendoDocumento, setViendoDocumento] = useState(false);
    const [debugInfo, setDebugInfo] = useState('');

    // Cargar reglamento según sede del empleado
    useEffect(() => {
      const cargarReglamento = async () => {
        setCargando(true);
        try {
          // Obtener la sede del empleado logueado
          const sedeIdEmpleado = empleado?.sede_id || empleado?.sedeId;
          const sedeNombreEmpleado = empleado?.sede; // Nombre de la sede
          const empresaEmpleado = empleado?.empresa_id || empleado?.empresaId;
          
          console.log('🔍 Buscando reglamento - SedeID:', sedeIdEmpleado, 'SedeNombre:', sedeNombreEmpleado, 'Empresa:', empresaEmpleado);
          
          let reglamentoEncontrado = null;
          
          // 1. Primero intentar buscar por sede_id (UUID)
          if (sedeIdEmpleado) {
            const { data: regSede, error: errSede } = await supabase
              .from('reglamentos_internos')
              .select('*')
              .eq('sede_id', sedeIdEmpleado)
              .eq('activo', true)
              .order('fecha_publicacion', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            console.log('📄 Resultado por sede_id:', regSede);
            
            if (regSede && !errSede) {
              reglamentoEncontrado = regSede;
            }
          }
          
          // 2. Si no encontró por sede_id, buscar por nombre_sede
          if (!reglamentoEncontrado && sedeNombreEmpleado) {
            const { data: regNombre, error: errNombre } = await supabase
              .from('reglamentos_internos')
              .select('*')
              .ilike('nombre_sede', `%${sedeNombreEmpleado}%`)
              .eq('activo', true)
              .order('fecha_publicacion', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            console.log('📄 Resultado por nombre_sede:', regNombre);
            
            if (regNombre && !errNombre) {
              reglamentoEncontrado = regNombre;
            }
          }
          
          // 3. NO buscar fallback - Solo mostrar el reglamento de su sede específica
          // Si no encuentra por sede, NO mostrar ninguno de otra sede
          
          if (reglamentoEncontrado) {
            console.log('✅ Reglamento encontrado:', reglamentoEncontrado.nombre_sede);
            setReglamento(reglamentoEncontrado);
          } else {
            console.log('❌ No se encontró reglamento para la sede del empleado');
            setDebugInfo(`Tu sede: ${sedeNombreEmpleado || sedeIdEmpleado || 'No asignada'}`);
          }
        } catch (e) {
          console.error('Error cargando reglamento:', e);
          setDebugInfo('Error: ' + e.message);
        }
        setCargando(false);
      };
      
      if (empleado) {
        cargarReglamento();
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empleado?.sede, empleado?.sede_id, empleado?.empresa_id]);

    if (cargando) {
      return (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <p style={{ color: '#666' }}>Cargando reglamento...</p>
        </div>
      );
    }
    
    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 20 }}>📖 Reglamento Interno de Trabajo</h2>
        
        {reglamento ? (
          <div>
            {/* Card del reglamento */}
            <div style={{
              padding: 24,
              backgroundColor: '#f5f5f5',
              borderRadius: 12,
              textAlign: 'center',
              marginBottom: 20
            }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>📖</div>
              <h3>Reglamento Interno de Trabajo</h3>
              <p style={{ color: '#666', marginBottom: 8 }}>
                {reglamento.nombre_sede}
              </p>
              <p style={{ color: '#999', fontSize: 12, marginBottom: 20 }}>
                Publicado: {new Date(reglamento.fecha_publicacion).toLocaleDateString('es-CO', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
              
              <button
                onClick={() => setViendoDocumento(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 28px',
                  backgroundColor: '#c62828',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(198, 40, 40, 0.3)'
                }}
              >
                👁️ Ver Reglamento
              </button>
              
              <p style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
                📌 El documento es únicamente para consulta
              </p>
            </div>

            {/* Modal para ver documento */}
            {viendoDocumento && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.85)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 9999
              }}>
                {/* Header del visor */}
                <div style={{
                  padding: '12px 20px',
                  background: 'linear-gradient(135deg, #c62828 0%, #d32f2f 100%)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
                    📖 Reglamento Interno - {reglamento.nombre_sede}
                  </div>
                  <button
                    onClick={() => setViendoDocumento(false)}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 16px',
                      color: 'white',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                  >
                    ✕ Cerrar
                  </button>
                </div>
                
                {/* Visor PDF sin herramientas de descarga */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <iframe
                    src={reglamento.archivo_url + '#toolbar=0&navpanes=0&scrollbar=1&view=FitH'}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none'
                    }}
                    title="Reglamento Interno de Trabajo"
                  />
                </div>
              </div>
            )}
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
              El reglamento interno aún no ha sido cargado al sistema para tu sede.<br />
              Por favor, contacta al área de Recursos Humanos.
            </p>
            {debugInfo && (
              <p style={{ color: '#999', fontSize: 11, marginTop: 12 }}>
                Info: {debugInfo}
              </p>
            )}
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

  // PRÉSTAMOS Y ADELANTOS
  const SeccionPrestamos = () => {
    const [prestamos, setPrestamos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [filtro, setFiltro] = useState('activo'); // activo, pagado

    useEffect(() => {
      cargarPrestamos();
    }, []);

    const cargarPrestamos = async () => {
      setCargando(true);
      try {
        const { data, error } = await supabase
          .from('prestamos')
          .select('*')
          .eq('empleadoid', empleado?.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error cargando préstamos:', error);
        } else {
          setPrestamos(data || []);
        }
      } catch (e) {
        console.error('Error:', e);
      }
      setCargando(false);
    };

    const formatearMoneda = (valor) => {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
      }).format(valor || 0);
    };

    const formatearFecha = (fecha) => {
      if (!fecha) return '-';
      return new Date(fecha).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };

    const getEstadoColor = (estado) => {
      switch (estado?.toLowerCase()) {
        case 'activo':
          return { bg: '#E8F5E9', color: '#2E7D32', texto: '✅ Activo' };
        case 'pagado':
          return { bg: '#E3F2FD', color: '#1565C0', texto: '💯 Pagado' };
        case 'pendiente':
          return { bg: '#FFF3E0', color: '#E65100', texto: '⏳ Pendiente' };
        case 'rechazado':
          return { bg: '#FFEBEE', color: '#C62828', texto: '❌ Rechazado' };
        default:
          return { bg: '#F5F5F5', color: '#616161', texto: estado || 'Sin estado' };
      }
    };

    // Parsear plan de cuotas
    const parsearPlan = (plan) => {
      if (!plan) return [];
      if (Array.isArray(plan)) return plan;
      if (typeof plan === 'string') {
        try {
          return JSON.parse(plan);
        } catch (e) {
          return [];
        }
      }
      return [];
    };

    // Calcular cuotas pagadas del plan - usa noDescontable como en el sistema principal
    const contarCuotasPagadas = (plan) => {
      const planArray = parsearPlan(plan);
      if (!planArray || planArray.length === 0) return 0;
      // En el sistema principal, noDescontable=true significa que ya se descontó/pagó
      return planArray.filter(c => c.noDescontable === true).length;
    };

    // Calcular el saldo real basado en las cuotas no pagadas
    const calcularSaldoReal = (prestamo) => {
      const planArray = parsearPlan(prestamo.plan);
      if (!planArray || planArray.length === 0) return prestamo.saldo || prestamo.valor || 0;
      // Sumar el valor de las cuotas que NO están pagadas (noDescontable !== true)
      const abonado = planArray
        .filter(c => c.noDescontable === true)
        .reduce((sum, c) => sum + (c.valor || 0), 0);
      return (prestamo.valor || 0) - abonado;
    };

    // Determinar estado real del préstamo
    const getEstadoReal = (prestamo) => {
      const planArray = parsearPlan(prestamo.plan);
      const cuotasPagadas = contarCuotasPagadas(prestamo.plan);
      const totalCuotas = prestamo.cuotas || planArray.length || 1;
      const saldoReal = calcularSaldoReal(prestamo);
      
      // Si todas las cuotas están pagadas o el saldo es 0, está pagado
      if (cuotasPagadas >= totalCuotas || saldoReal <= 0) {
        return 'pagado';
      }
      // Si no está pagado, está activo (incluye pendientes)
      return 'activo';
    };

    // Filtrar préstamos con estado calculado
    const prestamosFiltrados = prestamos.filter(p => {
      const estadoReal = getEstadoReal(p);
      return estadoReal === filtro;
    });

    // Para saldo pendiente, sumar los saldos reales calculados
    const totalActivo = prestamos
      .filter(p => getEstadoReal(p) !== 'pagado')
      .reduce((sum, p) => sum + calcularSaldoReal(p), 0);

    const cuotasProximaQuincena = prestamos
      .filter(p => getEstadoReal(p) === 'activo')
      .reduce((sum, p) => {
        // Calcular cuota mensual: valor / cuotas
        const cuotaMensual = p.cuotas > 0 ? (p.valor / p.cuotas) : 0;
        return sum + cuotaMensual;
      }, 0);

    if (cargando) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: 300,
          flexDirection: 'column',
          gap: 16
        }}>
          <div style={{
            width: 50,
            height: 50,
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #c62828',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: '#666' }}>Cargando préstamos...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );
    }

    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 16 }}>💳 Préstamos y Adelantos</h2>
        
        {/* Resumen */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
            color: 'white',
            borderRadius: 12,
            padding: 20,
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>Total Préstamos</p>
            <p style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 'bold' }}>{prestamos.length}</p>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #2E7D32 0%, #43A047 100%)',
            color: 'white',
            borderRadius: 12,
            padding: 20,
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>Saldo Pendiente</p>
            <p style={{ margin: '8px 0 0', fontSize: 22, fontWeight: 'bold' }}>{formatearMoneda(totalActivo)}</p>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #1565C0 0%, #1E88E5 100%)',
            color: 'white',
            borderRadius: 12,
            padding: 20,
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>Próximo Descuento</p>
            <p style={{ margin: '8px 0 0', fontSize: 22, fontWeight: 'bold' }}>{formatearMoneda(cuotasProximaQuincena)}</p>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ 
          display: 'flex', 
          gap: 8, 
          marginBottom: 16,
          flexWrap: 'wrap'
        }}>
          {['activo', 'pagado'].map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                border: 'none',
                background: filtro === f ? '#c62828' : '#e0e0e0',
                color: filtro === f ? 'white' : '#333',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {f === 'activo' ? '✅ Activos' : '💯 Pagados'}
            </button>
          ))}
        </div>

        {/* Lista de préstamos */}
        {prestamosFiltrados.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 60,
            background: 'white',
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <p style={{ fontSize: 48, margin: 0 }}>📭</p>
            <p style={{ color: '#666', marginTop: 16 }}>
              {filtro === 'todos' 
                ? 'No tienes préstamos registrados'
                : `No tienes préstamos con estado "${filtro}"`
              }
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {prestamosFiltrados.map((prestamo, index) => {
              const estadoReal = getEstadoReal(prestamo);
              const estadoInfo = getEstadoColor(estadoReal);
              const cuotaMensual = prestamo.cuotas > 0 ? (prestamo.valor / prestamo.cuotas) : 0;
              const cuotasPagadas = contarCuotasPagadas(prestamo.plan);
              const totalCuotas = prestamo.cuotas || parsearPlan(prestamo.plan).length || 1;
              const saldoReal = calcularSaldoReal(prestamo);
              const progreso = totalCuotas > 0 
                ? (cuotasPagadas / totalCuotas) * 100 
                : 0;
              
              return (
                <div 
                  key={prestamo.id || index}
                  style={{
                    background: 'white',
                    borderRadius: 12,
                    padding: 20,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    border: '1px solid #eee'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: 12,
                    flexWrap: 'wrap',
                    gap: 8
                  }}>
                    <div>
                      <span style={{
                        fontSize: 11,
                        background: '#f5f5f5',
                        padding: '2px 8px',
                        borderRadius: 4,
                        color: '#666'
                      }}>
                        {prestamo.razon === 'adelanto' ? '💵 Adelanto' : '💳 Préstamo'}
                      </span>
                      <h3 style={{ margin: '8px 0 0', fontSize: 24, color: '#c62828' }}>
                        {formatearMoneda(prestamo.valor)}
                      </h3>
                    </div>
                    <span style={{
                      padding: '6px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      backgroundColor: estadoInfo.bg,
                      color: estadoInfo.color
                    }}>
                      {estadoInfo.texto}
                    </span>
                  </div>

                  {/* Detalles */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: 12,
                    marginBottom: 12,
                    padding: 12,
                    background: '#fafafa',
                    borderRadius: 8
                  }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: '#666' }}>Fecha Solicitud</p>
                      <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{formatearFecha(prestamo.fechasolicitud)}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: '#666' }}>Cuotas Pagadas</p>
                      <p style={{ margin: '4px 0 0', fontWeight: 600, color: cuotasPagadas >= totalCuotas ? '#2E7D32' : '#333' }}>
                        {cuotasPagadas} / {totalCuotas} {cuotasPagadas >= totalCuotas && '✅'}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: '#666' }}>Cuota Mensual</p>
                      <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{formatearMoneda(cuotaMensual)}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: '#666' }}>Saldo Pendiente</p>
                      <p style={{ margin: '4px 0 0', fontWeight: 600, color: saldoReal > 0 ? '#c62828' : '#2E7D32' }}>
                        {saldoReal <= 0 ? '✅ Pagado' : formatearMoneda(saldoReal)}
                      </p>
                    </div>
                  </div>

                  {/* Barra de progreso - mostrar siempre para ver el avance */}
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: '#666',
                      marginBottom: 4
                    }}>
                      <span>Progreso de pago</span>
                      <span>{Math.round(progreso)}%</span>
                    </div>
                    <div style={{
                      height: 8,
                      background: '#e0e0e0',
                      borderRadius: 4,
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${progreso}%`,
                        background: progreso >= 100 
                          ? 'linear-gradient(90deg, #1565C0 0%, #1E88E5 100%)' 
                          : 'linear-gradient(90deg, #2E7D32 0%, #43A047 100%)',
                        borderRadius: 4,
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>

                  {/* Indicador de descuento programado - mostrar solo si hay cuotas SELECCIONADAS para descuento (pagado=true pero noDescontable=false) */}
                  {parsearPlan(prestamo.plan).some(c => c.pagado === true && !c.noDescontable) && (
                    <div style={{
                      marginTop: 12,
                      padding: 10,
                      background: '#E3F2FD',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <span>📅</span>
                      <span style={{ fontSize: 12, color: '#1565C0' }}>
                        Descuento programado en la próxima quincena
                      </span>
                    </div>
                  )}

                  {/* Motivo del préstamo */}
                  {prestamo.motivo && (
                    <div style={{
                      marginTop: 12,
                      padding: 10,
                      background: '#FFF8E1',
                      borderRadius: 8,
                      border: '1px solid #FFE082'
                    }}>
                      <p style={{ margin: 0, fontSize: 11, color: '#F57F17', fontWeight: 600 }}>📝 Motivo</p>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#333' }}>{prestamo.motivo}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ACTUALIZACIÓN DE DATOS DEL EMPLEADO
  const SeccionActualizacionDatos = () => {
    // Función para normalizar el tipo de documento al formato correcto
    const normalizarTipoDocumento = (tipo) => {
      if (!tipo) return 'Cédula de ciudadanía';
      const tipoLower = tipo.toLowerCase().trim();
      
      // Mapeo de variantes comunes a los valores exactos del select
      if (tipoLower.includes('ppt') || tipoLower.includes('permiso de protección') || tipoLower.includes('permiso de proteccion') || tipoLower.includes('protección temporal') || tipoLower.includes('proteccion temporal')) {
        return 'Permiso de protección temporal PPT';
      }
      if (tipoLower === 'cc' || tipoLower.includes('cédula de ciudadanía') || tipoLower.includes('cedula de ciudadania') || (tipoLower.includes('cedula') && tipoLower.includes('ciudadan'))) {
        return 'Cédula de ciudadanía';
      }
      if (tipoLower === 'ce' || tipoLower.includes('cédula de extranjería') || tipoLower.includes('cedula de extranjeria') || tipoLower.includes('extranjeria') || tipoLower.includes('extranjería')) {
        return 'Cédula de extranjería';
      }
      if (tipoLower === 'ti' || tipoLower.includes('tarjeta de identidad') || tipoLower.includes('tarjeta identidad')) {
        return 'Tarjeta de identidad';
      }
      if (tipoLower === 'rc' || tipoLower.includes('registro civil')) {
        return 'Registro civil';
      }
      if (tipoLower.includes('pasaporte')) {
        return 'Pasaporte';
      }
      if (tipoLower.includes('venezolana') || tipoLower.includes('cedula venezolana') || tipoLower.includes('cédula venezolana')) {
        return 'Cédula venezolana';
      }
      
      // Si no coincide, devolver el valor original o el predeterminado
      const opcionesValidas = ['Cédula de ciudadanía', 'Cédula de extranjería', 'Tarjeta de identidad', 'Registro civil', 'Permiso de protección temporal PPT', 'Pasaporte', 'Cédula venezolana'];
      const coincidencia = opcionesValidas.find(op => op.toLowerCase() === tipoLower);
      return coincidencia || 'Cédula de ciudadanía';
    };

    // Mapear campos de la BD (minúsculas sin guiones) a nombres legibles
    const [datosEditados, setDatosEditados] = useState({
      nombres: empleado?.nombres || '',
      apellidos: empleado?.apellidos || '',
      documento: empleado?.documento || '',
      tipodoc: normalizarTipoDocumento(empleado?.tipodoc),
      fechanacimiento: empleado?.fechanacimiento || '',
      telefono: empleado?.telefono || '',
      direccion: empleado?.direccion || '',
      eps: empleado?.eps || '',
      fondopensiones: empleado?.fondopensiones || empleado?.fondo || '',
      arl: empleado?.arl || '',
      banco: empleado?.banco || '',
      tipocuenta: empleado?.tipocuenta || '',
      numerocuenta: empleado?.numerocuenta || '',
      rh: empleado?.rh || '',
      nacionalidad: empleado?.nacionalidad || '',
      genero: empleado?.genero || ''
    });
    const [guardando, setGuardando] = useState(false);
    const [mensajeExito, setMensajeExito] = useState('');
    const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);

    useEffect(() => {
      cargarSolicitudesPendientes();
    }, []);

    const cargarSolicitudesPendientes = async () => {
      try {
        const { data } = await supabase
          .from('solicitudes_actualizacion_datos')
          .select('*')
          .eq('documento_empleado', empleado?.documento)
          .eq('estado', 'pendiente')
          .order('created_at', { ascending: false });
        if (data) setSolicitudesPendientes(data);
      } catch (e) {
        console.log('Tabla solicitudes_actualizacion_datos no disponible');
      }
    };

    const handleChange = (campo, valor) => {
      setDatosEditados(prev => ({ ...prev, [campo]: valor }));
    };

    const enviarSolicitudActualizacion = async () => {
      setGuardando(true);
      setMensajeExito('');
      
      // Identificar qué campos cambiaron
      const cambios = {};
      const datosOriginales = {};
      
      Object.keys(datosEditados).forEach(campo => {
        const valorOriginal = empleado?.[campo] || '';
        const valorNuevo = datosEditados[campo] || '';
        if (valorOriginal !== valorNuevo) {
          cambios[campo] = valorNuevo;
          datosOriginales[campo] = valorOriginal;
        }
      });

      if (Object.keys(cambios).length === 0) {
        alert('No hay cambios para enviar');
        setGuardando(false);
        return;
      }

      try {
        const { error } = await supabase
          .from('solicitudes_actualizacion_datos')
          .insert({
            empresa_id: empleado?.empresa_id || usuario?.empresa_id,
            empleado_id: empleado?.id,
            documento_empleado: empleado?.documento,
            nombre_empleado: empleado?.nombre,
            datos_originales: datosOriginales,
            datos_nuevos: cambios,
            estado: 'pendiente',
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error('Error al enviar solicitud:', error);
          alert('Error al enviar la solicitud. Inténtalo de nuevo.');
        } else {
          setMensajeExito('✅ Solicitud enviada correctamente. Un administrador revisará tu solicitud.');
          cargarSolicitudesPendientes();
        }
      } catch (e) {
        console.error('Error:', e);
        alert('Error al procesar la solicitud');
      }
      setGuardando(false);
    };

    const camposPersonales = [
      { campo: 'nombres', label: 'Nombres', tipo: 'text' },
      { campo: 'apellidos', label: 'Apellidos', tipo: 'text' },
      { campo: 'documento', label: 'Número de Documento', tipo: 'text', disabled: true },
      { campo: 'tipodoc', label: 'Tipo de Documento', tipo: 'select', opciones: ['Cédula de ciudadanía', 'Cédula de extranjería', 'Tarjeta de identidad', 'Registro civil', 'Permiso de protección temporal PPT', 'Pasaporte', 'Cédula venezolana'] },
      { campo: 'fechanacimiento', label: 'Fecha de Nacimiento', tipo: 'date' },
      { campo: 'rh', label: 'Grupo Sanguíneo (RH)', tipo: 'select', opciones: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] },
      { campo: 'genero', label: 'Género', tipo: 'select', opciones: ['Masculino', 'Femenino', 'Otro'] },
      { campo: 'nacionalidad', label: 'Nacionalidad', tipo: 'text' },
      { campo: 'telefono', label: 'Teléfono / Celular', tipo: 'tel' },
      { campo: 'direccion', label: 'Dirección de Residencia', tipo: 'text' },
    ];

    const camposSeguridad = [
      { campo: 'eps', label: 'EPS', tipo: 'text' },
      { campo: 'fondopensiones', label: 'Fondo de Pensión', tipo: 'text' },
      { campo: 'arl', label: 'ARL', tipo: 'text' },
    ];

    const camposBancarios = [
      { campo: 'banco', label: 'Banco', tipo: 'text' },
      { campo: 'tipocuenta', label: 'Tipo de Cuenta', tipo: 'select', opciones: ['Ahorros', 'Corriente'] },
      { campo: 'numerocuenta', label: 'Número de Cuenta', tipo: 'text' },
    ];

    const renderCampo = (config) => (
      <div key={config.campo} style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: '#555' }}>
          {config.label}
        </label>
        {config.tipo === 'select' ? (
          <select
            value={datosEditados[config.campo]}
            onChange={(e) => handleChange(config.campo, e.target.value)}
            disabled={config.disabled}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
              backgroundColor: config.disabled ? '#f5f5f5' : 'white'
            }}
          >
            {config.opciones?.map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        ) : (
          <input
            type={config.tipo}
            value={datosEditados[config.campo]}
            onChange={(e) => handleChange(config.campo, e.target.value)}
            disabled={config.disabled}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
              backgroundColor: config.disabled ? '#f5f5f5' : 'white',
              boxSizing: 'border-box'
            }}
          />
        )}
      </div>
    );

    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 8 }}>👤 Actualizar Mis Datos</h2>
        <p style={{ color: '#666', marginBottom: 24 }}>
          Revisa y actualiza tu información personal. Los cambios serán enviados para aprobación.
        </p>

        {mensajeExito && (
          <div style={{
            padding: 16,
            backgroundColor: '#e8f5e9',
            color: '#2e7d32',
            borderRadius: 12,
            marginBottom: 24
          }}>
            {mensajeExito}
          </div>
        )}

        {solicitudesPendientes.length > 0 && (
          <div style={{
            padding: 16,
            backgroundColor: '#fff3e0',
            border: '1px solid #ffb74d',
            borderRadius: 12,
            marginBottom: 24
          }}>
            <div style={{ fontWeight: 'bold', color: '#e65100', marginBottom: 8 }}>
              ⏳ Tienes {solicitudesPendientes.length} solicitud(es) pendiente(s) de aprobación
            </div>
            <p style={{ color: '#666', margin: 0, fontSize: 14 }}>
              Una vez aprobadas, tus datos se actualizarán automáticamente.
            </p>
          </div>
        )}

        <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <h3 style={{ color: '#333', marginBottom: 20, borderBottom: '2px solid #e0e0e0', paddingBottom: 10 }}>
            📋 Datos Personales
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            {camposPersonales.map(renderCampo)}
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <h3 style={{ color: '#333', marginBottom: 20, borderBottom: '2px solid #e0e0e0', paddingBottom: 10 }}>
            🏥 Seguridad Social
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            {camposSeguridad.map(renderCampo)}
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <h3 style={{ color: '#333', marginBottom: 20, borderBottom: '2px solid #e0e0e0', paddingBottom: 10 }}>
            🏦 Datos Bancarios
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            {camposBancarios.map(renderCampo)}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            onClick={() => {
              setDatosEditados({
                nombres: empleado?.nombres || '',
                apellidos: empleado?.apellidos || '',
                documento: empleado?.documento || '',
                tipodoc: empleado?.tipodoc || 'Cédula de ciudadanía',
                fechanacimiento: empleado?.fechanacimiento || '',
                telefono: empleado?.telefono || '',
                direccion: empleado?.direccion || '',
                eps: empleado?.eps || '',
                fondopensiones: empleado?.fondopensiones || empleado?.fondo || '',
                arl: empleado?.arl || '',
                banco: empleado?.banco || '',
                tipocuenta: empleado?.tipocuenta || '',
                numerocuenta: empleado?.numerocuenta || '',
                rh: empleado?.rh || '',
                nacionalidad: empleado?.nacionalidad || '',
                genero: empleado?.genero || ''
              });
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#f5f5f5',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            Cancelar Cambios
          </button>
          <button
            onClick={enviarSolicitudActualizacion}
            disabled={guardando}
            style={{
              padding: '12px 24px',
              backgroundColor: guardando ? '#ccc' : '#c62828',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: guardando ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 'bold'
            }}
          >
            {guardando ? 'Enviando...' : '📤 Enviar Solicitud de Actualización'}
          </button>
        </div>
      </div>
    );
  };

  // Componente de botón "Volver al inicio"
  const BotonVolverInicio = () => (
    <button
      onClick={() => setSeccionActiva('inicio')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 20px',
        backgroundColor: '#c62828',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 'bold',
        cursor: 'pointer',
        marginBottom: 20,
        boxShadow: '0 2px 8px rgba(198, 40, 40, 0.3)',
        transition: 'all 0.2s'
      }}
      onMouseOver={e => {
        e.currentTarget.style.backgroundColor = '#b71c1c';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseOut={e => {
        e.currentTarget.style.backgroundColor = '#c62828';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      ← Volver al Inicio
    </button>
  );

  // Renderizar sección activa
  const renderSeccion = () => {
    // Si es inicio, no mostrar botón de volver
    if (seccionActiva === 'inicio') {
      return <SeccionInicio />;
    }
    
    // Para otras secciones, mostrar botón de volver
    const seccionContenido = {
      'desprendible': <SeccionDesprendible />,
      'prestamos': <SeccionPrestamos />,
      'carta-laboral': <SeccionCartaLaboral />,
      'contrato': <SeccionContrato />,
      'horarios': <SeccionHorarios />,
      'solicitudes': <SeccionSolicitudes />,
      'actualizacion-datos': <SeccionActualizacionDatos />,
      'reglamento': <SeccionReglamento />,
      'formatos': <SeccionFormatos />,
    };
    
    return (
      <div>
        <BotonVolverInicio />
        {seccionContenido[seccionActiva] || <SeccionInicio />}
      </div>
    );
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
            {menuItems.map(item => {
              const bloqueo = moduloBloqueado(item.id);
              const estaBloqueado = !!bloqueo && item.id !== 'inicio';
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (estaBloqueado) {
                      alert(`🔒 Este módulo no está disponible para tu usuario.\n\n${bloqueo.motivo ? 'Motivo: ' + bloqueo.motivo : 'Comunícate con Recursos Humanos para más información.'}`);
                    } else {
                      setSeccionActiva(item.id);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    backgroundColor: estaBloqueado ? '#f5f5f5' : (seccionActiva === item.id ? '#ffebee' : 'transparent'),
                    border: 'none',
                    borderLeft: seccionActiva === item.id && !estaBloqueado ? '4px solid #c62828' : '4px solid transparent',
                    cursor: estaBloqueado ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    textAlign: 'left',
                    color: estaBloqueado ? '#999' : (seccionActiva === item.id ? '#c62828' : '#333'),
                    fontWeight: seccionActiva === item.id && !estaBloqueado ? 'bold' : 'normal',
                    opacity: estaBloqueado ? 0.6 : 1,
                    position: 'relative'
                  }}
                >
                  <span style={{ fontSize: 20 }}>{estaBloqueado ? '🔒' : item.icono}</span>
                  <span>{item.nombre}</span>
                  {estaBloqueado && (
                    <span style={{ 
                      fontSize: 9, 
                      color: '#999',
                      position: 'absolute',
                      right: 10
                    }}>
                      Bloqueado
                    </span>
                  )}
                </button>
              );
            })}
            
            {/* Botón Cumpleaños en el menú lateral */}
            <button
              onClick={() => setMostrarCumpleanos(true)}
              style={{
                width: '100%',
                padding: '14px 20px',
                backgroundColor: 'transparent',
                border: 'none',
                borderLeft: '4px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textAlign: 'left',
                color: '#333',
                fontWeight: 'normal'
              }}
              onMouseOver={e => {
                e.currentTarget.style.backgroundColor = '#fdf2f8';
                e.currentTarget.style.borderLeftColor = '#ec4899';
              }}
              onMouseOut={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderLeftColor = 'transparent';
              }}
            >
              <span style={{ fontSize: 20 }}>🎂</span>
              <span>Cumpleaños</span>
            </button>
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
      
      {/* Modal de Cumpleaños */}
      {mostrarCumpleanos && (() => {
        const hoy = new Date();
        const mesActual = hoy.getMonth();
        const diaActual = hoy.getDate();
        
        const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        // Colores por mes (estacionales)
        const COLORES_MES = [
          { bg: '#dbeafe', header: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)', text: '#1e40af' }, // Enero - Azul
          { bg: '#fce7f3', header: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)', text: '#9d174d' }, // Febrero - Rosa
          { bg: '#d1fae5', header: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', text: '#065f46' }, // Marzo - Verde
          { bg: '#fef3c7', header: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)', text: '#92400e' }, // Abril - Amarillo
          { bg: '#e0e7ff', header: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', text: '#3730a3' }, // Mayo - Indigo
          { bg: '#ffedd5', header: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)', text: '#9a3412' }, // Junio - Naranja
          { bg: '#fee2e2', header: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)', text: '#991b1b' }, // Julio - Rojo
          { bg: '#fae8ff', header: 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)', text: '#6b21a8' }, // Agosto - Púrpura
          { bg: '#ccfbf1', header: 'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)', text: '#0f766e' }, // Septiembre - Teal
          { bg: '#fef9c3', header: 'linear-gradient(135deg, #eab308 0%, #facc15 100%)', text: '#854d0e' }, // Octubre - Dorado
          { bg: '#f1f5f9', header: 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)', text: '#334155' }, // Noviembre - Gris
          { bg: '#dcfce7', header: 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)', text: '#166534' }  // Diciembre - Verde
        ];
        
        // Procesar cumpleaños de empleados activos
        const cumpleanosPorMes = {};
        MESES.forEach((_, i) => cumpleanosPorMes[i] = []);
        
        const empleadosActivos = empleadosCumple.filter(emp => emp.activo !== false);
        
        empleadosActivos.forEach(emp => {
          if (emp.fechaNacimiento) {
            const fecha = new Date(emp.fechaNacimiento + 'T00:00:00');
            if (!isNaN(fecha.getTime())) {
              const mes = fecha.getMonth();
              const dia = fecha.getDate();
              const edad = hoy.getFullYear() - fecha.getFullYear();
              cumpleanosPorMes[mes].push({
                ...emp,
                dia,
                edad,
                esHoy: mes === mesActual && dia === diaActual,
                esEsteMes: mes === mesActual,
                esteAno: hoy.getFullYear()
              });
            }
          }
        });
        
        // Ordenar cada mes por día
        Object.keys(cumpleanosPorMes).forEach(mes => {
          cumpleanosPorMes[mes].sort((a, b) => a.dia - b.dia);
        });
        
        // Cumpleaños de hoy
        const cumpleanosHoy = cumpleanosPorMes[mesActual].filter(c => c.esHoy);
        
        // Próximos cumpleaños (siguientes 30 días)
        const proximosCumpleanos = [];
        for (let i = 0; i < 30; i++) {
          const fechaCheck = new Date(hoy);
          fechaCheck.setDate(hoy.getDate() + i);
          const mesCheck = fechaCheck.getMonth();
          const diaCheck = fechaCheck.getDate();
          cumpleanosPorMes[mesCheck].forEach(c => {
            if (c.dia === diaCheck && i > 0) {
              proximosCumpleanos.push({ ...c, diasFaltan: i, mesIdx: mesCheck });
            }
          });
        }
        
        // Estadísticas
        const totalCumpleanos = Object.values(cumpleanosPorMes).flat().length;
        const cumpleEsteMes = cumpleanosPorMes[mesActual].length;
        const mesesConMasCumples = MESES.map((nombre, idx) => ({ nombre, cantidad: cumpleanosPorMes[idx].length, idx }))
          .sort((a, b) => b.cantidad - a.cantidad).slice(0, 3);
        
        return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: '20px',
            width: '95%',
            maxWidth: '1300px',
            maxHeight: '92vh',
            overflow: 'hidden',
            boxShadow: '0 25px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header Mejorado */}
            <div style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)',
              padding: '24px 30px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Decoración de fondo */}
              <div style={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 150,
                height: 150,
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '50%'
              }} />
              <div style={{
                position: 'absolute',
                bottom: -30,
                left: '30%',
                width: 100,
                height: 100,
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '50%'
              }} />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 1 }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  🎂
                </div>
                <div>
                  <h2 style={{ margin: 0, color: 'white', fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>
                    Cumpleaños del Equipo
                  </h2>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                    <span style={{ 
                      color: 'rgba(255,255,255,0.95)', 
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      👥 {empleadosActivos.length} empleados activos
                    </span>
                    <span style={{ 
                      color: 'rgba(255,255,255,0.95)', 
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      📅 {MESES[mesActual]} {hoy.getFullYear()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMostrarCumpleanos(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderRadius: 12,
                  width: 44,
                  height: 44,
                  fontSize: 20,
                  cursor: 'pointer',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  zIndex: 1
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Tarjetas de estadísticas */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              padding: '20px 24px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                borderRadius: 12,
                padding: 16,
                border: '1px solid #fbbf24'
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#92400e' }}>{cumpleanosHoy.length}</div>
                <div style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>🎉 Hoy</div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                borderRadius: 12,
                padding: 16,
                border: '1px solid #60a5fa'
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1e40af' }}>{proximosCumpleanos.filter(p => p.diasFaltan <= 7).length}</div>
                <div style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>📅 Esta semana</div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
                borderRadius: 12,
                padding: 16,
                border: '1px solid #f472b6'
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#9d174d' }}>{cumpleEsteMes}</div>
                <div style={{ fontSize: 12, color: '#be185d', fontWeight: 600 }}>📆 Este mes</div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                borderRadius: 12,
                padding: 16,
                border: '1px solid #818cf8'
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#3730a3' }}>{totalCumpleanos}</div>
                <div style={{ fontSize: 12, color: '#4338ca', fontWeight: 600 }}>🎂 Total año</div>
              </div>
            </div>
            
            {/* Contenido */}
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              {/* Cumpleaños de hoy - Especial */}
              {cumpleanosHoy.length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fed7aa 100%)',
                  borderRadius: 16,
                  padding: 24,
                  marginBottom: 24,
                  border: '3px solid #f59e0b',
                  boxShadow: '0 8px 32px rgba(245, 158, 11, 0.25)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    fontSize: 60,
                    opacity: 0.15
                  }}>🎊</div>
                  <h3 style={{ 
                    margin: '0 0 20px 0', 
                    color: '#78350f', 
                    fontSize: 20, 
                    fontWeight: 800,
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 10 
                  }}>
                    <span style={{
                      background: '#f59e0b',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 14
                    }}>🎉 HOY</span>
                    ¡Feliz Cumpleaños!
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    {cumpleanosHoy.map(emp => (
                      <div key={emp.id} style={{
                        background: 'white',
                        borderRadius: 14,
                        padding: 20,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
                        border: '2px solid #fbbf24',
                        minWidth: 280
                      }}>
                        <div style={{
                          width: 60,
                          height: 60,
                          borderRadius: 14,
                          background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: 22,
                          fontWeight: 800,
                          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)'
                        }}>
                          {emp.nombres?.charAt(0)}{emp.apellidos?.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: '#1e293b', fontSize: 16 }}>
                            {emp.nombres} {emp.apellidos}
                          </div>
                          <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>{emp.cargo}</div>
                          <div style={{ 
                            color: 'white',
                            background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
                            fontSize: 12, 
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 20,
                            display: 'inline-block',
                            marginTop: 6
                          }}>
                            🎈 Cumple {emp.edad} años
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Próximos cumpleaños - Mejorado */}
              {proximosCumpleanos.length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  borderRadius: 16,
                  padding: 24,
                  marginBottom: 24,
                  border: '2px solid #7dd3fc'
                }}>
                  <h3 style={{ 
                    margin: '0 0 18px 0', 
                    color: '#0c4a6e', 
                    fontSize: 17, 
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
                      color: 'white',
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: 13
                    }}>📅</span>
                    Próximos 30 días
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {proximosCumpleanos.slice(0, 12).map((emp, idx) => (
                      <div key={idx} style={{
                        background: 'white',
                        borderRadius: 10,
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        border: emp.diasFaltan <= 3 ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                        minWidth: 220,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                      }}>
                        <div style={{
                          background: emp.diasFaltan === 1 
                            ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
                            : emp.diasFaltan <= 3 
                              ? 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)'
                              : COLORES_MES[emp.mesIdx].header,
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'white',
                          textAlign: 'center',
                          minWidth: 60
                        }}>
                          {emp.diasFaltan === 1 ? '🔔 Mañana' : `${emp.diasFaltan} días`}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>
                            {emp.nombres?.split(' ')[0]} {emp.apellidos?.split(' ')[0]}
                          </div>
                          <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                            {emp.dia} de {MESES[emp.mesIdx]}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Calendario anual por meses - Colorido */}
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  color: '#1e293b', 
                  fontSize: 17, 
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <span style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                    color: 'white',
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: 13
                  }}>📆</span>
                  Calendario Anual
                </h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                  Meses con más cumpleaños: {mesesConMasCumples.map(m => `${m.nombre} (${m.cantidad})`).join(', ')}
                </p>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                gap: 18 
              }}>
                {MESES.map((nombreMes, mesIdx) => {
                  const cumplesMes = cumpleanosPorMes[mesIdx];
                  const esMesActual = mesIdx === mesActual;
                  const colores = COLORES_MES[mesIdx];
                  
                  return (
                    <div 
                      key={mesIdx}
                      style={{
                        background: esMesActual ? colores.bg : '#ffffff',
                        borderRadius: 14,
                        border: esMesActual ? `3px solid ${colores.text}` : '1px solid #e5e7eb',
                        overflow: 'hidden',
                        boxShadow: esMesActual ? '0 8px 24px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{
                        background: colores.header,
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ 
                          fontWeight: 700, 
                          fontSize: 15,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          {esMesActual && <span>👉</span>}
                          {nombreMes}
                        </span>
                        <span style={{
                          background: 'rgba(255,255,255,0.25)',
                          padding: '4px 12px',
                          borderRadius: 12,
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'white'
                        }}>
                          {cumplesMes.length} {cumplesMes.length === 1 ? 'cumple' : 'cumples'}
                        </span>
                      </div>
                      <div style={{ padding: 12, minHeight: 70, background: esMesActual ? colores.bg : '#fafafa' }}>
                        {cumplesMes.length === 0 ? (
                          <div style={{ 
                            color: '#9ca3af', 
                            fontSize: 13, 
                            textAlign: 'center',
                            padding: 16,
                            fontStyle: 'italic'
                          }}>
                            Sin cumpleaños este mes
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {cumplesMes.map((emp, idx) => (
                              <div 
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '8px 10px',
                                  background: emp.esHoy 
                                    ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' 
                                    : 'white',
                                  borderRadius: 8,
                                  border: emp.esHoy ? '2px solid #f59e0b' : '1px solid #e5e7eb'
                                }}
                              >
                                <div style={{
                                  minWidth: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  background: emp.esHoy 
                                    ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
                                    : colores.header,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: 'white'
                                }}>
                                  {emp.dia}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ 
                                    fontWeight: 600, 
                                    fontSize: 13, 
                                    color: '#1e293b',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    {emp.nombres?.split(' ')[0]} {emp.apellidos?.split(' ')[0]}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>
                                    {emp.sede || emp.cargo || 'Sin sede'}
                                  </div>
                                </div>
                                {emp.esHoy && <span style={{ fontSize: 16 }}>🎉</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Footer Mejorado */}
            <div style={{
              padding: '16px 24px',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              borderTop: '2px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                <span style={{ 
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  🎂 <strong style={{ color: '#1e293b' }}>{totalCumpleanos}</strong> cumpleaños registrados
                </span>
                <span style={{ 
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  📊 <strong style={{ color: '#1e293b' }}>{Math.round(totalCumpleanos / 12)}</strong> promedio por mes
                </span>
              </div>
              <button
                onClick={() => setMostrarCumpleanos(false)}
                style={{
                  padding: '10px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.3)';
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
        );
      })()}
      
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
