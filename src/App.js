import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './config';

// ============================================
// INTRANET DE EMPLEADOS - APLICACIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N PRINCIPAL
// v1.3 - Horarios conectados
// ============================================
// Esta aplicaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n se conecta a la misma base de datos Supabase
// del sistema principal. Los usuarios ingresan con su nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºmero
// de documento (cÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©dula) y la misma clave del sistema principal.

// ConfiguraciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de Supabase desde archivo config.js
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

  // Verificar si hay sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n guardada al cargar
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
        
        // Guardar el ID del empleado para buscar nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³minas
        const empleadoId = emp.id || emp.documento;
        console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¹Ã…â€œÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¤ Empleado encontrado, ID:', empleadoId, 'Documento:', emp.documento);
        
        // Cargar configuraciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de empresa
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
        
        // Cargar datos adicionales usando ID para nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³minas y horarios, documento para el resto
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
      console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Buscando nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³minas para empleadoId:', empleadoId, 'documento:', documento);
      
      // PRIMERO: Ver cuÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ntas nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³minas hay en total en la tabla
      const { data: todasNominas, count, error: errorTotal } = await supabase
        .from('nominas')
        .select('id, empleadoid, periodo, totalneto', { count: 'exact' })
        .limit(10);
      
      console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â  TOTAL nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³minas en tabla:', count, 'Primeras 10:', todasNominas, errorTotal);
      
      // Mostrar los empleadoid para debug
      if (todasNominas && todasNominas.length > 0) {
        console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¹Ã…â€œÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¥ Empleadoids en la tabla:', todasNominas.map(n => n.empleadoid));
      }
      
      // Intentar buscar primero por empleadoid (ID del empleado)
      let { data, error } = await supabase
        .from('nominas')
        .select('*')
        .eq('empleadoid', empleadoId)
        .order('periodo', { ascending: false })
        .limit(12);
      
      console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ Resultado bÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºsqueda por empleadoid (ID):', data?.length || 0, error);
      
      // Si no encuentra por ID, intentar por documento
      if ((!data || data.length === 0) && !error && documento) {
        console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ Intentando bÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºsqueda por documento...');
        const { data: dataDoc } = await supabase
          .from('nominas')
          .select('*')
          .eq('empleadoid', documento)
          .order('periodo', { ascending: false })
          .limit(12);
        
        console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ Resultado bÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºsqueda por documento:', dataDoc?.length || 0);
        if (dataDoc && dataDoc.length > 0) {
          data = dataDoc;
        }
      }
      
      // Si aÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºn no encuentra, buscar con ilike por si hay prefijos/sufijos
      if ((!data || data.length === 0) && !error) {
        console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ Intentando bÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºsqueda con contains...');
        const { data: dataAlt } = await supabase
          .from('nominas')
          .select('*')
          .or(`empleadoid.ilike.%${empleadoId}%,empleadoid.ilike.%${documento}%`)
          .order('periodo', { ascending: false })
          .limit(12);
        
        console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ Resultado bÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºsqueda ilike:', dataAlt?.length || 0);
        if (dataAlt && dataAlt.length > 0) {
          data = dataAlt;
        }
      }
      
      if (data) {
        console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ NÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³minas encontradas:', data.length);
        setNominas(data);
      }
    } catch (e) {
      console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Error cargando nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³minas:', e);
    }
  };

  const cargarHorarios = async (empleadoId) => {
    try {
      console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ Buscando horarios para empleado ID:', empleadoId);
      
      // Calcular fechas: mes actual y mes anterior
      const hoy = new Date();
      const primerDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const ultimoDiaMesActual = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      
      const fechaInicio = primerDiaMesAnterior.toISOString().split('T')[0];
      const fechaFin = ultimoDiaMesActual.toISOString().split('T')[0];
      
      console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â  Buscando horarios desde', fechaInicio, 'hasta', fechaFin);
      
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
      
      console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ Horarios encontrados:', horariosData?.length || 0);
      
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
              
              // Solo incluir si estÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ dentro del rango
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
      
      // Ordenar por fecha descendente (mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s recientes primero)
      horariosEmpleado.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      
      console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¹Ã…â€œÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¤ Horarios del empleado:', horariosEmpleado.length);
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
  // FUNCIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N DE LOGIN - Usa tabla "usuarios" del sistema principal
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
        setErrorLogin('Documento o contraseÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±a incorrectos');
        setCargando(false);
        return;
      }
      
      // Usuario encontrado - guardar sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n
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
      setErrorLogin('Error al iniciar sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n');
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
                NÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºmero de Documento
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
                ContraseÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±a
              </label>
              <input
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢"
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
              {cargando ? 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ Ingresando...' : 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â Ingresar'}
            </button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: 20, color: '#999', fontSize: 12 }}>
            ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Olvidaste tu contraseÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±a? Contacta a Recursos Humanos
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // MENÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ LATERAL
  // ============================================
  const menuItems = [
    { id: 'inicio', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ', nombre: 'Inicio' },
    { id: 'desprendible', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°', nombre: 'Desprendible de Pago' },
    { id: 'carta-laboral', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾', nombre: 'Carta Laboral' },
    { id: 'contrato', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹', nombre: 'Contrato de Trabajo' },
    { id: 'horarios', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â', nombre: 'Mis Horarios' },
    { id: 'solicitudes', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â', nombre: 'Radicar Solicitud' },
    { id: 'reglamento', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ', nombre: 'Reglamento Interno' },
    { id: 'formatos', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â', nombre: 'Formatos' },
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
          <h2 style={{ margin: 0 }}>ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡Bienvenido, {empleado?.nombre || usuario?.nombre || 'Empleado'}!</h2>
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

    // FunciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n para calcular el rango de la quincena desde una fecha
    const getRangoQuincena = (fechaISO) => {
      if (!fechaISO) return { inicio: '', fin: '' };
      
      const date = new Date(fechaISO);
      const yyyy = date.getFullYear();
      const mm = date.getMonth();
      const dd = date.getDate();
      const half = dd <= 15 ? 1 : 2;
      
      // Calcular los dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­as de la quincena
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
        <h2 style={{ color: '#c62828', marginBottom: 20 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â° Desprendible de Pago</h2>
        
        {!nominaSeleccionada ? (
          <div>
            <p style={{ color: '#666', marginBottom: 16 }}>
              Selecciona un perÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­odo para ver tu desprendible:
            </p>
            
            {nominas.length === 0 ? (
              <div style={{
                padding: 40,
                backgroundColor: '#f5f5f5',
                borderRadius: 12,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­</div>
                <p style={{ color: '#666' }}>No hay desprendibles disponibles</p>
                <p style={{ color: '#999', fontSize: 12 }}>Los desprendibles aparecerÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡n aquÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ cuando se procese la nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³mina en el sistema.</p>
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
              ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Volver
            </button>
            
            {/* DESPRENDIBLE - DiseÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±o compacto para una sola hoja */}
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
                    ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â° HORAS TRABAJADAS
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
                    ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµ DEVENGADOS
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
                          <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>BonificaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n</td>
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
                    ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â° DEDUCCIONES
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
                          <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>PensiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n (4%)</td>
                          <td style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatearMoneda(nominaSeleccionada.descuentopension || nominaSeleccionada.descpension)}</td>
                        </tr>
                      )}
                      {(nominaSeleccionada.descuentoprestamos || nominaSeleccionada.descprestamos) > 0 && (
                        <tr>
                          <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>PrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©stamos</td>
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
                <span style={{ fontSize: 14, fontWeight: 'bold' }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â° NETO A PAGAR</span>
                <span style={{ fontSize: 20, fontWeight: 'bold' }}>{formatearMoneda(nominaSeleccionada.totalneto || nominaSeleccionada.netoapagar)}</span>
              </div>

              {/* Pie de pÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡gina */}
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
                ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¨ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Imprimir Desprendible
              </button>
            </div>
          </div>
        )}
        
        {/* Estilos para impresiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n */}
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

  // CARTA LABORAL - AutomÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡tica con datos de sede
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

    // FunciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n para convertir nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºmero a letras
    const numeroALetras = (num) => {
      if (!num || num === 0) return 'CERO';
      const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
      const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°IS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
      const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
      const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
      
      const n = Math.floor(num);
      if (n === 100) return 'CIEN';
      if (n === 1000) return 'MIL';
      if (n === 1000000) return 'UN MILLÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N';
      
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
        const millonesTexto = millones === 1 ? 'UN MILLÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N' : convertirCentena(millones) + ' MILLONES';
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
      // Campo correcto: fechaingreso (minÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºsculas, sin guiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n)
      const fechaIngreso = empleado?.fechaingreso || empleado?.fecha_ingreso || empleado?.fechaIngreso || '';
      // Campo correcto: tipocontrato (minÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºsculas, sin guiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n)
      const tipoContrato = empleado?.tipocontrato || empleado?.tipo_contrato || empleado?.tipoContrato || 'TÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rmino Indefinido';
      // Campo correcto: salariobase (minÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºsculas, sin guiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n)
      const salarioBase = empleado?.salariobase || empleado?.salario_basico || empleado?.salarioBase || empleado?.salario || 0;
      // Auxilio de transporte legal vigente 2026 Colombia
      const AUXILIO_TRANSPORTE = 249095;
      // Total: salario bÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡sico + auxilio de transporte
      const salarioTotal = salarioBase + AUXILIO_TRANSPORTE;
      
      console.log('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ Carta Laboral - Salario:', salarioBase, '+ Aux:', AUXILIO_TRANSPORTE, '= Total:', salarioTotal);
      
      const razonSocial = datosSede?.razonSocial || 'BIG BURGUER S.A.S';
      const nitSede = datosSede?.nit || '';
      const representante = datosSede?.representanteLegal || 'REPRESENTANTE LEGAL';
      const genero = datosSede?.generoRepresentante || 'Masculino';
      const direccionSede = datosSede?.direccion || '';
      const telefonoSede = datosSede?.telefono || '';
      const sede = empleado?.sede || '';

      ventanaImpresion.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>CertificaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n Laboral</title>
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
              <img src="/logo.jpg" alt="Big Burguer Logo" />
            </div>
            
            <div class="encabezado">
              <div class="empresa">${razonSocial}</div>
              <div class="sede-info">Sede: ${sede}</div>
            </div>

            <div class="fecha">Pereira, ${fechaTexto}</div>

            <div class="titulo">CERTIFICACIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N LABORAL</div>

            <div class="contenido">
              <p>${genero === "Femenino" ? "La suscrita" : "El suscrito"} <strong>${representante}</strong>, en calidad de Representante Legal de <strong>${razonSocial}</strong>, identificad${genero === "Femenino" ? "a" : "o"} con NIT <strong>${nitSede}</strong>,</p>
              
              <p style="text-align: center; margin: 25px 0;"><strong>CERTIFICA QUE:</strong></p>
              
              <p>El (la) SeÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±or(a) <strong>${nombreEmpleado.toUpperCase()}</strong>, identificado(a) con <strong>CÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©dula de CiudadanÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a ${documento}</strong>, labora en nuestra empresa${fechaIngreso ? ` desde el <strong>${new Date(fechaIngreso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>` : ''}, con un contrato <strong>${tipoContrato}</strong>, desempeÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±ando el cargo de <strong>${cargo.toUpperCase()}</strong>${salarioBase > 0 ? `, devengando un salario bÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡sico mensual de <strong>${formatearMoneda(salarioBase)}</strong> mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s auxilio de transporte de <strong>${formatearMoneda(AUXILIO_TRANSPORTE)}</strong>, para un total devengado de <strong>${formatearMoneda(salarioTotal)}</strong> (${numeroALetras(salarioTotal)} PESOS M/CTE)` : ''}.</p>
              
              <p>La presente certificaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n se expide a solicitud del interesado para los fines que estime conveniente.</p>
            </div>

            <div class="firma">
              <div class="linea-firma"></div>
              <div class="nombre-firma">${representante}</div>
              <div class="cargo-firma">Representante Legal</div>
              <div class="cargo-firma">NIT ${nitSede}</div>
              ${direccionSede ? `<div class="cargo-firma">DirecciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n: ${direccionSede}</div>` : ''}
              ${telefonoSede ? `<div class="cargo-firma">TelÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©fono: ${telefonoSede}</div>` : ''}
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

    // Campo correcto: salariobase (minÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºsculas, sin guiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n)
    const salarioEmpleado = empleado?.salariobase || empleado?.salario_basico || empleado?.salarioBase || empleado?.salario || 0;
    // Auxilio de transporte legal vigente 2026 Colombia
    const AUXILIO_TRANSPORTE = 249095;
    const salarioTotal = salarioEmpleado + AUXILIO_TRANSPORTE;
    
    // Nombre: combinar nombres y apellidos
    const nombreCompleto = empleado?.nombres && empleado?.apellidos 
      ? `${empleado.nombres} ${empleado.apellidos}` 
      : (empleado?.nombre || usuario?.nombre || '');
    
    // Campos correctos segÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºn estructura tabla
    const fechaIngresoEmpleado = empleado?.fechaingreso || empleado?.fecha_ingreso || '';
    const tipoContratoEmpleado = empleado?.tipocontrato || empleado?.tipo_contrato || 'TÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rmino Indefinido';

    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 20 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ CertificaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n Laboral</h2>
        
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
          
          {/* TÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­tulo */}
          <h4 style={{ textAlign: 'center', margin: '24px 0', textDecoration: 'underline' }}>
            CERTIFICACIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N LABORAL
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
              El (la) SeÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±or(a) <strong>{nombreCompleto.toUpperCase()}</strong>, 
              identificado(a) con <strong>CÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©dula de CiudadanÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a {empleado?.documento || usuario?.usuario}</strong>, 
              labora en nuestra empresa
              {fechaIngresoEmpleado && (
                <> desde el <strong>{new Date(fechaIngresoEmpleado).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></>
              )}, con un contrato <strong>{tipoContratoEmpleado}</strong>, 
              desempeÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±ando el cargo de <strong>{(empleado?.cargo || 'COLABORADOR').toUpperCase()}</strong>
              {salarioEmpleado > 0 && (
                <>, devengando un salario bÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡sico mensual de <strong>{formatearMoneda(salarioEmpleado)}</strong> mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s auxilio de transporte de <strong>{formatearMoneda(AUXILIO_TRANSPORTE)}</strong>, para un total devengado de <strong>{formatearMoneda(salarioTotal)}</strong></>
              )}.
            </p>
            
            <p style={{ marginTop: 16 }}>
              La presente certificaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n se expide a solicitud del interesado para los fines que estime conveniente.
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
        
        {/* BotÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n imprimir */}
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
            ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¨ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Imprimir CertificaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n
          </button>
          <p style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
            La certificaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n se generarÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ con los datos actuales y podrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s imprimirla o guardarla como PDF.
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
    
    // FunciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n para generar e imprimir el contrato como PDF - IGUAL AL SISTEMA ORIGINAL
    const imprimirContrato = () => {
      if (!contrato?.datos) return;
      
      const datos = contrato.datos;
      const win = window.open("", "_blank", "width=900,height=700");
      if (!win) return;

      // Variables de gÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©nero
      const esEmpleadoMujer = datos.generoTrabajador === "Femenino";
      const elLaTrabajador = esEmpleadoMujer ? "LA" : "EL";
      const trabajadorNombre = esEmpleadoMujer ? "TRABAJADORA" : "TRABAJADOR";
      const labelNombreTrabajador = esEmpleadoMujer ? "NOMBRE DE LA TRABAJADORA" : "NOMBRE DEL TRABAJADOR";
      const ellaEl = esEmpleadoMujer ? "ella" : "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©l";
      
      // Logo Big Burguer en Base64 para que aparezca siempre en la impresiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n
      const LOGO_BIGBURGUER_BASE64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wgARCAUABQADASIAAhEBAxEB/8QAGgABAAIDAQAAAAAAAAAAAAAAAAQFAQMGAv/EABkBAQADAQEAAAAAAAAAAAAAAAACAwQBBf/aAAwDAQACEAMQAAACjDN6oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABK1RjqEpAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/9oADAMBAAIAAwAAACEIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIYIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIISoIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIYLbwAIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIHwNGEIMIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII0zy4IEISwoIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIE8E33zyoIwKR0kIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII14/zzzzzzygJ+kbsIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIJfzzzzzzzzykIL+taEIEQoIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIJ7/AM8888888888c/8AKwgQi0/AgggggggggggggggggggggggggggggggggggggggggggggggggggggggkPfPPPPPPPPPPPPPPMgni72pAgggggggggggggggggggggggggggggggggggggggggggggggggggggggV/PPPPPPPPPPPPPPPDgV2k4IQggggggggggggggggggggggggggggggggggggggggggggggggggggggl/PPPPPPPPPPPPPPPPPDfPAgggggggggggggggggggggggggggggggggggggggggggggggggggggggggvvPPPPPPPPPPPPPPPPPPPKwgggggggggggggggggggggggggggggggggggggggggggggggggggggggggtvfPPPPPPPPPPPPPPPPPOaAggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggwwwwwwwwwwwwwwwwwwgggggggggggggggggggggggggggggggggggggSCwxjAgBzwgghxxQQgghQCwyCQhxyAhDiBhwwwggggiiTCQhDgDzxxTBzygQhhwwyAggggggggggggggPPPPL7wPKQgXvPPGwgggvPPPLi//AC9PzyN/zzzx0pO7zzw1XzwF3ylXzzzzyjXzzzxkkIIIIIIIIIIIJPy4HXyXLzpb7zvXy0IIJTy/T7wrbyoL7yNTzzbzwh3z/TSsXzwrTygbzzXzcv7zzrzygIIIIIIIIIIIIXy8TnODTywDzqoiWYIIJbyod3kHXz4JTzlTzgLyhfzwg+5BPzwATz/Ly80SiHzzxHyaIIIIIIIIIIIIJvz7e3gJ7yr3y0Lbz4oILbznG3kj/wAvCX8u38v8Xpf8qCQ8sB88BF88084++iBc8v8AKiQggggggggggggqvODtvLX/AC5/y+2XywsIJXy4r/z9Xytx/wA198xU8df88FX88E88N/8AO6/LiRmDF/OsvHQQgggggggggggk/PH/ADy9fy+rTzz3zygIJzyx/wA8kx88888B08pW88c088888X388887788/u8/e8rG88rCCCCCCCCCCCCF108yoQS52iT49924BCC15043qjRU/41DCR1sG2yLD2/cz7rH706mD265x121a1iF2ygCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCfMr1LfOueNNNNNNNNNNNNFCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCV8lXtd888888888888888pCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCn8hcRe888888888888888bCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCS088o0888888888888884iCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCV888888888888888888pCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCSCAAAAAAAAAAAAAACiCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC/9oADAMBAAIAAwAAABAIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIkIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIKK4gIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIwIQGoIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIOJNkIUIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII3sFQIIIQEAIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII0g4MIEEQIQC1IEIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIFNEEEEEEEEIKoIMWMIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIfoEEEEEEEEFSgeFRcAIA8sIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII0EEEEEEEEEEEEJMEAIoJCBEIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIJKIEEEEEEEEEEEEEEEsJiLjaUIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIeEEEEEEEEEEEEEEEEFQYvQFOMIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII0EEEEEEEEEEEEEEEEEHIEYIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIsEEEEEEEEEEEEEEEEEEEEQIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIKYw0000000000000000006AIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIKAEEEEEEEEEEEEEEEEEFAIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIAME0Q4IYUIIIY800EIIIc4008AIQ0gYsgk400k8IIIIUoEEIMgE8E8Ec00A4IgU0kEoIIIIIIIIIIIIIbzzzy48Pz4Jw7zzz4IIJXzzzz2hbzlTzwpzzzzxgp3zzzzxXzwnzzoHzzzzyPzzzzzsEIIIIIIIIIIIJPzkJ3yO7zoXzz/HXgIIIzypL7wP3zkLTyh3z/LzyT/z7/2wDzwtnztHzn3v8j3zrfzwkIIIIIIIIIIIITywrn6JTyo7zusBC8IILTyxPSgFfzoJzz9fy1jzJbziIerRXzyJLyqfy+EiEHXztPy0IIIIIIIIIIIIInzzHzgDXyn7zwJbzosIL7znlz4n3zoJbyhby5zUAPzkNLyzDzwBDyy/znTsED/z5yoAIIIIIIIIIIIILvzk/nyn3yr/AM+hs88jCC88uO/86W86G+8rV8f98MR89kN88788KM8up8tDCR9985+87BCCCCCCCCCCCCb88Pc8u/8AK+NPPPPPIQgl/PL/ADzJzzzzzglXyofzyLXzzvTzn/zzzyjzzy57z1/z9HzygIIIIIIIIIIILHXfr+RDLGyObvaDDcAILP3/AL1tgB56/wBogsMblPsq4fORfcQB8tepwM9ucderEdcQdtgAggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggnsi2qm4MAwAAAAAAAAAAALQgggggggggggggggggggggggggggggggggggggggggggggggggggggggggqwRwxwQQQQQQQQQQQQQQQVwggggggggggggggggggggggggggggggggggggggggggggggggggggggggglQYCGiAQQQQQQQQQQQQQQaQgggggggggggggggggggggggggggggggggggggggggggggggggggggggggkwQQdqwQQQQQQQQQQQQQQYwgggggggggggggggggggggggggggggggggggggggggggggggggggggggggggSAQQQQQQQQQQQQQQQRAQgggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggAQAAAAAAAAAAAAAgQAggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggv/EADgRAAEDAgEJBAkEAwEAAAAAAAEAAgMEERAFEhMhMTJRUmEUFUFxICIjMDNCUIGRQGChsaDB0fD/2gAIAQIBAT8A/wA/1lZA92a12v8AaGUyBUnN6KPKDWSkSG4NiDw1IEEXH7MkmjjIDza+GVadzZNKNhwoQRTsvw/Zb3tY0ucdQVVUGokLzs8Fk2oMsVnbR/4J7GvaWuGoqOhLqkxeA2+SAsLBFwGon9kzVEcIu8qrrX1BtsbwwyO46Vw6f7waxrSSBrOGUszs5zvt5qirbQF0vgbX80CCLj9hvqYWbzgn5Up27CT9v+p+WG/Iz8qXKc79QNvJOcXG5NzjkeM3dJ9sJ69kMwjcNXFAgi4WWA6zD4a02Z7Y3RjYVkxxNOL9f2BPXQw6nHXwClyvIdUYt/KkqJZN9xPuKKLRQNb9/wA4ZSdnVLullkmpJBhd4bFVxCWFzSoIHzvDGqKNsTAxuwfXqiqjgF3n7Koy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";

      // Cargar logo desde URL con espera
      win.document.write(`
        <html>
          <head>
            <title>${datos.tipoContrato === "Fijo" || datos.tipoContrato === "TÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rmino Fijo"
              ? "Contrato Individual de Trabajo a TÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rmino Fijo"
              : "Contrato Individual de Trabajo a TÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rmino Indefinido"} - ${datos.nombreTrabajador || ''}</title>
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
              <div class="logo-header"><img id="logoImg" src="${LOGO_BIGBURGUER_BASE64}" alt="BigBurguer Logo" /></div>
              <h1>CONTRATO INDIVIDUAL DE TRABAJO A TÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°RMINO ${datos.tipoContrato === "Fijo" || datos.tipoContrato === "TÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rmino Fijo" ? "FIJO" : "INDEFINIDO"}</h1>
            </div>

            <table class="tabla-datos">
              <tr><td class="label">NOMBRE DEL EMPLEADOR</td><td class="valor">${datos.nombreEmpleador || ''}</td></tr>
              <tr><td class="label">NIT</td><td class="valor">${datos.nitEmpleador || ''}</td></tr>
              <tr><td class="label">DIRECCIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N DEL EMPLEADOR</td><td class="valor">${datos.direccionEmpleador || ''}</td></tr>
              <tr><td class="label">TELÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°FONO</td><td class="valor">${datos.telefonoEmpleador || ''}</td></tr>
              <tr><td class="label">REPRESENTANTE LEGAL</td><td class="valor">${datos.representanteLegal || ''}</td></tr>
              <tr><td class="label">${datos.tipoDocRepresentante ? datos.tipoDocRepresentante.toUpperCase() : "CÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°DULA DE CIUDADANÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂA"}</td><td class="valor">${datos.cedulaRepresentante || ''}</td></tr>
              <tr><td colspan="2" style="height:8px;border:none;"></td></tr>
              <tr><td class="label">${labelNombreTrabajador}</td><td class="valor">${datos.nombreTrabajador || ''}</td></tr>
              <tr><td class="label">${datos.tipoDocTrabajador ? datos.tipoDocTrabajador.toUpperCase() : "CÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°DULA DE CIUDADANÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂA"}</td><td class="valor">${datos.cedulaTrabajador || ''}</td></tr>
              <tr><td class="label">LUGAR Y FECHA NACIMIENTO</td><td class="valor">${datos.lugarFechaNacimiento || ''}</td></tr>
              <tr><td class="label">DIRECCIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N</td><td class="valor">${datos.direccionTrabajador || ''}</td></tr>
              <tr><td class="label">TELÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°FONO</td><td class="valor">${datos.telefonoTrabajador || ''}</td></tr>
              <tr><td class="label">CARGO</td><td class="valor">${datos.cargo || ''}</td></tr>
              <tr><td class="label">TIPO DE SALARIO</td><td class="valor">${datos.tipoSalario || ''}</td></tr>
              <tr><td class="label">REMUNERACIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N SALARIAL MENSUAL</td><td class="valor">${datos.remuneracion || ''} (${datos.remuneracionLetras || ''} PESOS M/CTE)</td></tr>
              <tr><td class="label">PERÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂODO DE PAGO</td><td class="valor">${datos.periodoPago || ''}</td></tr>
              <tr><td class="label">FECHA INICIACIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N DE LABORES</td><td class="valor">${datos.fechaInicio || ''}</td></tr>
              <tr><td class="label">FECHA DE TERMINACIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N DE LABORES</td><td class="valor">${datos.fechaTerminacion || ''}</td></tr>
              <tr><td class="label">LUGAR DE TRABAJO</td><td class="valor">${datos.lugarTrabajo || ''}</td></tr>
              <tr><td class="label">LUGAR DE CONTRATACIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N</td><td class="valor">${datos.lugarContratacion || ''}</td></tr>
            </table>

            <p class="intro-text">Entre el EMPLEADOR y ${elLaTrabajador} ${trabajadorNombre}, de las condiciones ya dichas, identificados como aparece al pie de sus firmas, se ha celebrado el presente contrato individual de trabajo a tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rmino ${datos.tipoContrato === "Fijo" || datos.tipoContrato === "TÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rmino Fijo" ? "fijo" : "indefinido"}, regido ademÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s por las siguientes <strong>CLÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂUSULAS:</strong></p>
            
            <div class="clausula"><span class="clausula-titulo">PRIMERA: OBJETO.</span> EL EMPLEADOR contrata los servicios personales de ${elLaTrabajador} ${trabajadorNombre} en el cargo reseÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±ado y ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©ste se obliga: a) a poner al servicio del EMPLEADOR toda su capacidad normal de trabajo en el desempeÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±o de las funciones propias del oficio mencionado y en las labores descritas en el literal f de la presente clÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡usula y complementarias del mismo, de conformidad con las ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³rdenes e instrucciones que le imparta EL EMPLEADOR directamente o travÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©s de sus representantes. Las funciones serÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡n detalladas en Anexo al presente Contrato; b) a prestar sus servicios en forma exclusiva a EL EMPLEADOR, es decir, a no prestar directa ni indirectamente servicios laborales a otros empleadores, ni trabajar por cuenta propia en el mismo oficio, durante la vigencia de este contrato; y c) a guardar absoluta reserva y confidencialidad sobre los hechos, documentos fÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­sicos y/o electrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³nicos, informaciones y en general, sobre todos los asuntos y materias que lleguen a su conocimiento por causa o por ocasiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de su contrato de trabajo y aun despuÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©s dos (2) aÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±os de liquidado el mismo. En caso de incumplimiento de la presente obligaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n, ${elLaTrabajador} ${trabajadorNombre} responderÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ legalmente por los daÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±os y/o perjuicios que se causen a la empresa, de conformidad con las normas vigentes en la materia. d) a reportar cualquier orden, solicitud, o novedad que reciba de su jefe inmediato o de cualquier compaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±ero o colaborador, tendiente a realizar o encubrir actos fraudulentos o ilÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­citos que afecten de cualquier forma a EL EMPLEADOR. e) Dar cumplimiento a las polÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ticas que estipule el Empleador, los cuales constan en los anexos que forman parte integral de este contrato. f) ${elLaTrabajador} ${trabajadorNombre} desempeÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±arÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ las funciones tales como: Presentar el menÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âº, conocer los ingredientes y las preparaciones, sugerir platos, presentar las recomendaciones del dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a y las bebidas disponibles, ser enlace entre la cocina y el cliente, debe anotar pedidos y entregarlos al comando de la cocina, cerciorarse que los platos hayan sido preparados de forma correcta, en caso de que el comensal haya hecho una peticiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n especial, mantener comunicaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n continua con los clientes, prestar atenciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n a las reacciones de los clientes y canalizar quejas o sugerencias que busquen mejorar el servicio, mantener las mesas limpias y desinfectadas antes y despuÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©s de su uso por parte del cliente, y demÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s indicaciones que se le asignen o se le requieran, demÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s instrucciones dadas por el EMPLEADOR.</div>

            <div class="clausula"><span class="clausula-titulo">SEGUNDA: REMUNERACIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N.</span> ${elLaTrabajador} ${trabajadorNombre} devengarÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ una remuneraciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de UN (1) SALARIO MÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂNIMO LEGAL MENSUAL VIGENTE, equivalente actualmente a la suma de ${datos.remuneracionLetras || ''} PESOS M/CTE (${datos.remuneracion || ''}).<div class="paragrafo"><strong>PARÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂGRAFO PRIMERO: SALARIO ORDINARIO.</strong> Dentro del salario ordinario se encuentra incluida la remuneraciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de los descansos dominicales y festivos de que tratan los CapÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­tulos I, II y III del TÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­tulo VII del C.S.T. De igual manera se aclara y se conviene que en los casos en que ${elLaTrabajador} ${trabajadorNombre} devengue comisiones o cualquiera otra modalidad de salario variable, el 82.5% de dichos ingresos constituye remuneraciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de la labor realizada, y el 17.5% restante estarÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ destinado a remunerar el descanso en los dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­as dominicales y festivos de que tratan los CapÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­tulos I y II del TÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­tulo VIII del C.S.T.</div><div class="paragrafo"><strong>PARÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂGRAFO SEGUNDO: SALARIO INTEGRAL.</strong> En la eventualidad en que ${elLaTrabajador} ${trabajadorNombre} devengue salario integral, se entiende de conformidad con el numeral 2 del artÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­culo 132 del C.S.T, subrogado por el artÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­culo 18 de la ley 50/90, que dentro del salario integral convenido se encuentra incorporado el factor prestacional de ${elLaTrabajador} ${trabajadorNombre}, el cual no serÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ inferior al 30% del salario antes mencionado.</div><div class="paragrafo"><strong>PARÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂGRAFO TERCERO:</strong> Las partes acuerdan que en los casos en que se le reconozcan a ${elLaTrabajador} ${trabajadorNombre} beneficios diferentes al salario por concepto de alimentaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n, comunicaciones, habitaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n o vivienda, transporte, vestuario, auxilios en dinero o en especie o bonificaciones ocasionales, ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©sos no se considerarÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡n como factor constitutivo de salario y no se tendrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡n en cuenta como factor prestacional para la liquidaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de acreencias laborales, ni para el pago de aportes parafiscales y cotizaciones a la seguridad social, de conformidad con los Arts. 15 y 16 de la ley 50 de 1990, en concordancia el Art. 17 de la ley 344 de 1996.</div></div>

            <div class="clausula"><span class="clausula-titulo">TERCERA: DURACIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N DEL CONTRATO.</span> ${datos.tipoContrato === "Fijo" || datos.tipoContrato === "TÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rmino Fijo" ? "La duraciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n del presente contrato serÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ por el tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rmino establecido en la parte inicial del presente documento, contado a partir de la fecha de iniciaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de labores. No obstante, si antes de la fecha de vencimiento del tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rmino estipulado, ninguna de las partes avisare por escrito a la otra su determinaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de no prorrogar el contrato, con una antelaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n no inferior a treinta (30) dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­as, ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©ste se entenderÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ renovado por un perÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­odo igual al inicialmente pactado." : "La duraciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n del presente contrato serÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ de manera indefinida, periodo entre la fecha de iniciaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n del contrato establecida en la parte inicial del presente documento y terminarÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ segÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºn las razones dispuestas por la ley."}</div>

            <div class="clausula"><span class="clausula-titulo">CUARTA: TRABAJO NOCTURNO, SUPLEMENTARIO, DOMINICAL Y/O FESTIVO.</span> Todo trabajo nocturno, suplementario o en horas extras, y todo trabajo en dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a domingo o festivo en los que legalmente debe concederse descanso, se remunerarÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ conforme los dispone expresamente la ley, salvo acuerdo en contrario contenido en convenciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n, pacto colectivo o laudo arbitral. Para el reconocimiento y pago del trabajo suplementario, nocturno, dominical o festivo, EL EMPLEADOR o sus representantes deberÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡n haberlo autorizado previamente y por escrito.</div>

            <div class="clausula"><span class="clausula-titulo">QUINTA: JORNADA DE TRABAJO.</span> ${elLaTrabajador} ${trabajadorNombre} se obliga a laborar la jornada mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡xima legal, salvo acuerdo especial, cumpliendo con los turnos y horarios que seÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±ale EL EMPLEADOR, quien podrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ cambiarlos o ajustarlos cuando lo estime conveniente sin que ello se considere una desmejora en las condiciones laborales ${esEmpleadoMujer ? "de LA TRABAJADORA" : "del TRABAJADOR"}.</div>

            <div class="clausula"><span class="clausula-titulo">SEXTA: PERIODO DE PRUEBA.</span> Los 60 dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­as iniciales del contrato se considera como periodo de prueba sin que exceda los lÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­mites permitidos a partir de la fecha de inicio y por consiguiente, cualquiera de las partes podrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ terminar el contrato unilateralmente, en cualquier momento durante dicho periodo.</div>

            <div class="clausula"><span class="clausula-titulo">SÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°PTIMA: TERMINACIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N UNILATERAL.</span> Son justas causas para dar terminado unilateralmente este contrato, por cualquiera de las partes, las enumeradas en el Art. 62 del C.S.T., modificado por el Art. 7ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âª del Decreto 2351 de 1965 y ademÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s, por parte de EL EMPLEADOR, las faltas que para el efecto se califiquen como graves en reglamentos, manuales, instructivos y demÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s documentos que contengan reglamentaciones, ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³rdenes, instrucciones o prohibiciones de carÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡cter general o particular.<div class="paragrafo"><strong>PARÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂGRAFO:</strong> Al finalizar el contrato de trabajo por cualquier concepto, ${elLaTrabajador} ${trabajadorNombre} autoriza descontar de su liquidaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n final de prestaciones sociales el valor correspondiente a los faltantes y/o deterioro anormal de elementos puestos bajo su responsabilidad.</div></div>

            <div class="clausula"><span class="clausula-titulo">OCTAVA: PROPIEDAD INTELECTUAL.</span> Las partes acuerdan que todas las invenciones, descubrimientos y trabajos originales concebidos o hechos por ${elLaTrabajador} ${trabajadorNombre} en vigencia del presente contrato pertenecerÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡n a EL EMPLEADOR, por lo cual ${elLaTrabajador} ${trabajadorNombre} se obliga a informar a EL EMPLEADOR, de forma inmediata, sobre la existencia de dichas invenciones y/o trabajos originales.</div>

            <div class="clausula"><span class="clausula-titulo">NOVENA: MODIFICACIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N DE LAS CONDICIONES LABORALES.</span> ${elLaTrabajador} ${trabajadorNombre} acepta desde ahora expresamente todas las modificaciones de sus condiciones laborales determinadas por EL EMPLEADOR en ejercicio de su poder subordinante, tales como el horario de trabajo, el lugar de prestaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n del servicio y el cargo u oficio y/o funciones, siempre que tales modificaciones no afecten su honor, dignidad o sus derechos mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­nimos, ni impliquen desmejoras sustanciales o graves perjuicios para ${ellaEl}.</div>

            <div class="clausula"><span class="clausula-titulo">DÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°CIMA: DIRECCIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N ${esEmpleadoMujer ? "DE LA TRABAJADORA" : "DEL TRABAJADOR"}.</span> ${elLaTrabajador} ${trabajadorNombre} se compromete a informar por escrito y de manera inmediata a EL EMPLEADOR cualquier cambio en su direcciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de residencia, teniÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©ndose en todo caso como suya, la ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºltima direcciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n registrada en su hoja de vida.</div>

            <div class="clausula"><span class="clausula-titulo">DÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°CIMA PRIMERA: EFECTOS.</span> El presente contrato reemplaza en su integridad y deja sin efecto cualquiera otro contrato, verbal o escrito, celebrado entre las partes con anterioridad, pudiendo las partes convenir por escrito modificaciones al mismo, las que formarÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡n parte integral de este contrato.</div>

            <div class="clausula"><span class="clausula-titulo">DÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°CIMA SEGUNDA: USO DE INTERNET.</span> ${elLaTrabajador} ${trabajadorNombre}, en razÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de sus funciones, tendrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ acceso a Internet. ${elLaTrabajador} ${trabajadorNombre} se compromete a realizar un uso adecuado del Internet desde su computador o dispositivo mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³vil o cualquier otro dispositivo de la empresa con conexiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n a Internet. Se abstiene de usarlo para el ingreso a pÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ginas que no sean del desarrollo de sus funciones.</div>

            <div class="clausula"><span class="clausula-titulo">DÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°CIMA TERCERA: HABEAS DATA.</span> Los datos consignados en el presente Contrato serÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡n tratados de acuerdo a lo establecido en la Ley 1581 de 2012, en el Decreto 1377 de 2013 y cualquier otra normatividad en lo que respecta a la protecciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de la informaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n.</div>

            <div class="clausula"><span class="clausula-titulo">DÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°CIMA CUARTA: AUTORIZACIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“N DESCUENTOS.</span> ${elLaTrabajador} ${trabajadorNombre} autoriza desde ahora al EMPLEADOR para que, de sus salarios, prestaciones sociales e indemnizaciones, le descuente, durante la vigencia del contrato o al momento de la terminaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n del mismo por cualquier causa, las sumas de dinero que por cualquier motivo le llegare a adeudar.</div>

            <div class="clausula"><span class="clausula-titulo">DÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°CIMA QUINTA: OBLIGACIONES ESPECIALES DE CONFIDENCIALIDAD ${esEmpleadoMujer ? "DE LA TRABAJADORA" : "DEL TRABAJADOR"}.</span> ${elLaTrabajador} ${trabajadorNombre} se obliga a:<br/>a. Guardar absoluta confidencialidad respecto a: procedimientos, mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©todos, caracterÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­sticas, lista de clientes, fÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³rmulas de productos y similares, al igual que claves de seguridad, suministros, software, base de datos de cualquier ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ndole, valores de bienes y servicios, informaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©cnica, financiera, econÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³mica o comercial del contratante o sus clientes.<br/>b. No ejercer actos de competencia desleal frente a ${datos.nombreEmpleador || ''}.<br/>c. Adoptar todas las precauciones necesarias y apropiadas para guardar la confidencialidad de la informaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n.<br/>d. Devolver inmediatamente a la terminaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de su contrato: la lista de clientes, claves, bases de datos, equipos, informaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©cnica, y demÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s que tenga del empleador.<div class="paragrafo"><strong>PARÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂGRAFO:</strong> El incumplimiento u omisiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de cualquiera de las obligaciones aquÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ acordadas no solo es causal de terminaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de los vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­nculos laborales existentes entre las partes, sino que podrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a conllevar a iniciar acciones judiciales en contra ${esEmpleadoMujer ? "de la trabajadora" : "del trabajador"} por los perjuicios materiales e inmateriales que cause.</div></div>

            <p style="margin-top: 25px;">Para constancia se firma en dos ejemplares del mismo tenor y valor, ante testigos en la ciudad y fecha que se indican a continuaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n:</p>
            <p style="margin: 15px 0;"><strong>CIUDAD:</strong> ${datos.ciudad || ''} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>FECHA:</strong> ${datos.fechaFirma || ''}</p>
            
            <div class="firma-container">
              <div class="firma-box"><div class="espacio-firma"></div><div class="linea-firma"></div><div class="nombre-firma">EMPLEADOR</div><div class="nombre-firma">${datos.representanteLegal || ''}</div><div class="cedula-firma">${datos.tipoDocRepresentante || "CÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©dula de CiudadanÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a"} ${datos.cedulaRepresentante || ''}</div><div class="cedula-firma">Representante Legal</div></div>
              <div class="firma-box"><div class="espacio-firma"></div><div class="linea-firma"></div><div class="nombre-firma">${trabajadorNombre}</div><div class="nombre-firma">${datos.nombreTrabajador || ''}</div><div class="cedula-firma">${datos.tipoDocTrabajador || "CÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©dula de CiudadanÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a"} ${datos.cedulaTrabajador || ''}</div></div>
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
          <div style={{ fontSize: 40 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³</div>
          <p>Cargando contrato...</p>
        </div>
      );
    }
    
    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 20 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ Contrato de Trabajo</h2>
        
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
                    {contrato.datos?.tipoContrato || contrato.tipocontrato || 'TÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rmino Indefinido'}
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
                  ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ Vigente
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
              
              {/* BotÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n para imprimir/descargar */}
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
                  ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ Ver / Imprimir Contrato (PDF)
                </button>
                <p style={{ color: '#666', fontSize: 12, marginTop: 10 }}>
                  Se abrirÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ una ventana con tu contrato listo para imprimir o guardar como PDF
                </p>
              </div>
            </div>
            
            {/* Fecha de generaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n */}
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
            <div style={{ fontSize: 60, marginBottom: 16 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­</div>
            <h3 style={{ color: '#e65100' }}>Contrato no disponible</h3>
            <p style={{ color: '#666' }}>
              Tu contrato aÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºn no ha sido generado en el sistema.<br />
              Por favor, contacta al ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡rea de Recursos Humanos.
            </p>
          </div>
        )}
      </div>
    );
  };

  // MIS HORARIOS - Vista tipo Calendario
  const SeccionHorarios = () => {
    const [eventos, setEventos] = useState({});
    const diasSemanaCorto = ['Dom', 'Lun', 'Mar', 'MiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©', 'Jue', 'Vie', 'SÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡b'];
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    // Festivos de Colombia 2026 (Ley 51 de 1983)
    const festivosColombia2026 = {
      '2026-01-01': 'AÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±o Nuevo',
      '2026-01-12': 'DÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a de los Reyes Magos',
      '2026-03-23': 'DÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a de San JosÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©',
      '2026-04-02': 'Jueves Santo',
      '2026-04-03': 'Viernes Santo',
      '2026-05-01': 'DÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a del Trabajo',
      '2026-05-18': 'AscensiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n del SeÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±or',
      '2026-06-08': 'Corpus Christi',
      '2026-06-15': 'Sagrado CorazÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n',
      '2026-06-29': 'San Pedro y San Pablo',
      '2026-07-20': 'DÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a de la Independencia',
      '2026-08-07': 'Batalla de BoyacÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡',
      '2026-08-17': 'AsunciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de la Virgen',
      '2026-10-12': 'DÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a de la Raza',
      '2026-11-02': 'Todos los Santos',
      '2026-11-16': 'Independencia de Cartagena',
      '2026-12-08': 'Inmaculada ConcepciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n',
      '2026-12-25': 'Navidad',
      // 2025
      '2025-12-08': 'Inmaculada ConcepciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n',
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
              // Eventos por dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a
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
    
    // FunciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n para convertir hora 24h a formato AM/PM
    const formatearHora = (hora) => {
      if (!hora) return '';
      const [h, m] = hora.split(':');
      const hora24 = parseInt(h);
      const minutos = m || '00';
      const periodo = hora24 >= 12 ? 'PM' : 'AM';
      const hora12 = hora24 === 0 ? 12 : hora24 > 12 ? hora24 - 12 : hora24;
      return `${hora12}:${minutos}${periodo}`;
    };
    
    // Crear mapa de horarios por fecha para acceso rÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡pido
    const horariosPorFecha = {};
    horarios.forEach(h => {
      horariosPorFecha[h.fecha] = h;
    });
    
    // Generar semanas para el mes actual y anterior
    const generarSemanasDelMes = (year, month) => {
      const semanas = [];
      const primerDia = new Date(year, month, 1);
      const ultimoDia = new Date(year, month + 1, 0);
      
      // Empezar desde el domingo de la semana del primer dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a
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
            ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â  {meses[month]} {year}
          </h3>
          
          {/* Encabezados de dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­as */}
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
                    {/* NÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºmero del dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a */}
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
                        ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â½ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â° {festivo}
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
                            ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â´ Descanso
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
                              ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ Partido
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
        <h2 style={{ color: '#c62828', marginBottom: 10 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Mis Horarios</h2>
        
        <p style={{ color: '#666', marginBottom: 20, fontSize: 14 }}>
          ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ Calendario de horarios - Mes actual y mes anterior
        </p>
        
        {horarios.length === 0 ? (
          <div style={{
            padding: 40,
            backgroundColor: '#f5f5f5',
            borderRadius: 12,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦</div>
            <h3>No hay horarios programados</h3>
            <p style={{ color: '#666' }}>
              AÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºn no tienes horarios asignados.<br />
              Los horarios aparecerÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡n aquÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ cuando sean programados por tu supervisor.
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
                <span style={{ fontSize: 11, fontWeight: '500' }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â½ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â° Festivo</span>
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
    const [modo, setModo] = useState('lista'); // 'lista' | 'nueva'
    const [tipoSolicitud, setTipoSolicitud] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [enviando, setEnviando] = useState(false);

    const tiposSolicitud = [
      { id: 'permiso', nombre: 'Permiso', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹' },
      { id: 'vacaciones', nombre: 'Vacaciones', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â' },
      { id: 'licencia', nombre: 'Licencia', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹' },
      { id: 'cambio_horario', nombre: 'Cambio de Horario', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â' },
      { id: 'certificado', nombre: 'Certificado Laboral', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾' },
      { id: 'otro', nombre: 'Otra Solicitud', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â' },
    ];

    const enviarSolicitud = async (e) => {
      e.preventDefault();
      setEnviando(true);
      
      try {
        const { error } = await supabase
          .from('solicitudes_empleados')
          .insert({
            usuario_id: usuario.id,
            documento: empleado?.documento || usuario.usuario,
            empleado_nombre: empleado?.nombre || usuario.nombre,
            tipo: tipoSolicitud,
            descripcion,
            fecha_inicio: fechaInicio || null,
            fecha_fin: fechaFin || null,
            estado: 'pendiente',
            fecha_creacion: new Date().toISOString(),
            empresa_id: empleado?.empresa_id || usuario.empresa_id
          });
        
        if (!error) {
          alert('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ Solicitud enviada correctamente');
          setModo('lista');
          setTipoSolicitud('');
          setDescripcion('');
          setFechaInicio('');
          setFechaFin('');
          await cargarSolicitudes(empleado?.documento || usuario.usuario);
        } else {
          console.error('Error:', error);
          alert('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Error al enviar la solicitud');
        }
      } catch (error) {
        console.error('Error:', error);
        alert('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Error al enviar la solicitud');
      }
      setEnviando(false);
    };

    const getEstadoColor = (estado) => {
      switch (estado) {
        case 'aprobada': return { bg: '#e8f5e9', color: '#2e7d32' };
        case 'rechazada': return { bg: '#ffebee', color: '#c62828' };
        default: return { bg: '#fff3e0', color: '#e65100' };
      }
    };

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#c62828', margin: 0 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Solicitudes</h2>
          {modo === 'lista' && (
            <button
              onClick={() => setModo('nueva')}
              style={{
                padding: '10px 20px',
                backgroundColor: '#c62828',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer'
              }}
            >
              ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Nueva Solicitud
            </button>
          )}
        </div>
        
        {modo === 'nueva' ? (
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: 12,
            padding: 24
          }}>
            <button
              onClick={() => setModo('lista')}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f5f5f5',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                marginBottom: 20
              }}
            >
              ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Volver
            </button>
            
            <h3 style={{ color: '#c62828', marginBottom: 20 }}>Nueva Solicitud</h3>
            
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
                  DescripciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n / Motivo *
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
                {enviando ? 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ Enviando...' : 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¤ Enviar Solicitud'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            {solicitudes.length === 0 ? (
              <div style={{
                padding: 40,
                backgroundColor: '#f5f5f5',
                borderRadius: 12,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 60, marginBottom: 16 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­</div>
                <h3>No tienes solicitudes</h3>
                <p style={{ color: '#666' }}>
                  AÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºn no has radicado ninguna solicitud.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {solicitudes.map(sol => {
                  const estadoStyle = getEstadoColor(sol.estado);
                  const tiposSolicitudMap = {
                    permiso: { nombre: 'Permiso', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹' },
                    vacaciones: { nombre: 'Vacaciones', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â' },
                    licencia: { nombre: 'Licencia', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹' },
                    cambio_horario: { nombre: 'Cambio de Horario', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â' },
                    certificado: { nombre: 'Certificado Laboral', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾' },
                    otro: { nombre: 'Otra Solicitud', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â' }
                  };
                  const tipo = tiposSolicitudMap[sol.tipo] || { nombre: sol.tipo, icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â' };
                  
                  return (
                    <div
                      key={sol.id}
                      style={{
                        padding: 16,
                        backgroundColor: 'white',
                        border: '1px solid #e0e0e0',
                        borderRadius: 12
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
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
                            Radicada: {new Date(sol.fecha_creacion).toLocaleDateString('es-CO')}
                            {sol.fecha_inicio && ` | Del ${sol.fecha_inicio} al ${sol.fecha_fin}`}
                          </div>
                        </div>
                        <span style={{
                          padding: '6px 12px',
                          backgroundColor: estadoStyle.bg,
                          color: estadoStyle.color,
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 'bold'
                        }}>
                          {sol.estado?.toUpperCase()}
                        </span>
                      </div>
                      {sol.respuesta && (
                        <div style={{
                          marginTop: 12,
                          padding: 12,
                          backgroundColor: '#f5f5f5',
                          borderRadius: 8,
                          fontSize: 13
                        }}>
                          <strong>Respuesta:</strong> {sol.respuesta}
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
    );
  };

  // REGLAMENTO INTERNO
  const SeccionReglamento = () => {
    const reglamentoUrl = configEmpresa?.reglamento_url;
    
    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 20 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ Reglamento Interno de Trabajo</h2>
        
        {reglamentoUrl ? (
          <div style={{
            padding: 24,
            backgroundColor: '#f5f5f5',
            borderRadius: 12,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ</div>
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
              ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¥ Descargar Reglamento
            </a>
          </div>
        ) : (
          <div style={{
            padding: 40,
            backgroundColor: '#fff3e0',
            borderRadius: 12,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­</div>
            <h3 style={{ color: '#e65100' }}>Reglamento no disponible</h3>
            <p style={{ color: '#666' }}>
              El reglamento interno aÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºn no ha sido cargado al sistema.<br />
              Por favor, contacta al ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡rea de Recursos Humanos.
            </p>
          </div>
        )}
        
        {/* InformaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n bÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡sica */}
        <div style={{
          marginTop: 24,
          padding: 20,
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: 12
        }}>
          <h4 style={{ color: '#c62828', marginBottom: 16 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â InformaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n Importante</h4>
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
          { id: 'formato_permiso', nombre: 'Formato Solicitud de Permiso', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â' },
          { id: 'formato_vacaciones', nombre: 'Formato Solicitud de Vacaciones', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â' },
          { id: 'formato_licencia', nombre: 'Formato Solicitud de Licencia', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹' },
          { id: 'formato_incapacidad', nombre: 'Formato Reporte de Incapacidad', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¥' },
          { id: 'formato_horas_extra', nombre: 'Formato AutorizaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n Horas Extra', icono: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°' },
        ]);
      }
    };

    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 20 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Formatos</h2>
        
        <p style={{ color: '#666', marginBottom: 20 }}>
          Descarga los formatos que necesites para tus trÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡mites internos.
        </p>
        
        {formatosDisponibles.length === 0 ? (
          <div style={{
            padding: 40,
            backgroundColor: '#f5f5f5',
            borderRadius: 12,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­</div>
            <h3>No hay formatos disponibles</h3>
            <p style={{ color: '#666' }}>
              Los formatos aparecerÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡n aquÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ cuando sean cargados por Recursos Humanos.
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
                  <span style={{ fontSize: 32 }}>{formato.icono || 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾'}</span>
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
                    ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¥ Descargar
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
            ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ <strong>Tip:</strong> Los formatos descargados pueden ser llenados digitalmente o impresos para diligenciar a mano.
          </p>
        </div>
      </div>
    );
  };

  // Renderizar secciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n activa
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
            ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¹Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°
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
            ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âª Salir
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
      
      {/* Estilos para impresiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n */}
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
