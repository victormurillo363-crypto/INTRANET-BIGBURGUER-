import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './config';

// ============================================
// INTRANET DE EMPLEADOS - APLICACIÓN PRINCIPAL
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
  const [documentos, setDocumentos] = useState([]);
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
        
        // Cargar datos adicionales usando documento
        await Promise.all([
          cargarNominas(emp.documento),
          cargarHorarios(emp.documento),
          cargarSolicitudes(emp.documento),
          cargarDocumentosEmp(emp.documento)
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
          cargarNominas(usuarioData.usuario),
          cargarHorarios(usuarioData.usuario),
          cargarSolicitudes(usuarioData.usuario),
          cargarDocumentosEmp(usuarioData.usuario)
        ]);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
    setCargando(false);
  };

  const cargarNominas = async (doc) => {
    try {
      const { data } = await supabase
        .from('nominas_intranet')
        .select('*')
        .eq('documento', doc)
        .order('periodo_fin', { ascending: false })
        .limit(12);
      if (data) setNominas(data);
    } catch (e) {
      console.log('Tabla nominas_intranet no disponible');
    }
  };

  const cargarHorarios = async (doc) => {
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('horarios_intranet')
        .select('*')
        .eq('documento', doc)
        .gte('fecha', hoy)
        .order('fecha', { ascending: true })
        .limit(14);
      if (data) setHorarios(data);
    } catch (e) {
      console.log('Tabla horarios_intranet no disponible');
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

  const cargarDocumentosEmp = async (doc) => {
    try {
      const { data } = await supabase
        .from('documentos_intranet')
        .select('*')
        .eq('documento', doc)
        .order('fecha_creacion', { ascending: false });
      if (data) setDocumentos(data);
    } catch (e) {
      console.log('Tabla documentos_intranet no disponible');
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
    setDocumentos([]);
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

  // DESPRENDIBLE DE PAGO
  const SeccionDesprendible = () => {
    const [nominaSeleccionada, setNominaSeleccionada] = useState(null);
    
    const formatearMoneda = (valor) => {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
      }).format(valor || 0);
    };

    const imprimirDesprendible = () => {
      window.print();
    };

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
                <p style={{ color: '#999', fontSize: 12 }}>Los desprendibles aparecerán aquí cuando Recursos Humanos los cargue al sistema.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {nominas.map(nomina => (
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
                        {nomina.periodo_nombre || `${nomina.periodo_inicio} - ${nomina.periodo_fin}`}
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                        Pagado: {new Date(nomina.fecha_pago || nomina.periodo_fin).toLocaleDateString('es-CO')}
                      </div>
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#4caf50', fontSize: 18 }}>
                      {formatearMoneda(nomina.neto_pagar)}
                    </div>
                  </button>
                ))}
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
                marginBottom: 20
              }}
            >
              ← Volver
            </button>
            
            <div id="desprendible-print" style={{
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: 12,
              padding: 24
            }}>
              {/* Encabezado */}
              <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #c62828', paddingBottom: 16 }}>
                <h3 style={{ margin: 0, color: '#c62828' }}>{configEmpresa?.nombre_empresa || empresa?.nombre || 'EMPRESA'}</h3>
                <p style={{ margin: '4px 0', fontSize: 12 }}>NIT: {configEmpresa?.nit || empresa?.nit || ''}</p>
                <h4 style={{ margin: '16px 0 0' }}>COMPROBANTE DE PAGO</h4>
                <p style={{ margin: '4px 0', fontSize: 12 }}>
                  Período: {nominaSeleccionada.periodo_inicio} al {nominaSeleccionada.periodo_fin}
                </p>
              </div>
              
              {/* Datos empleado */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginBottom: 24,
                padding: 16,
                backgroundColor: '#f5f5f5',
                borderRadius: 8
              }}>
                <div><strong>Nombre:</strong> {empleado?.nombre || usuario?.nombre}</div>
                <div><strong>Documento:</strong> {empleado?.documento || usuario?.usuario}</div>
                <div><strong>Cargo:</strong> {empleado?.cargo || 'Colaborador'}</div>
                <div><strong>Sede:</strong> {empleado?.sede || ''}</div>
              </div>
              
              {/* Devengados */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ color: '#4caf50', borderBottom: '1px solid #4caf50', paddingBottom: 8 }}>
                  DEVENGADOS
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: 8 }}>Salario Básico</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{formatearMoneda(nominaSeleccionada.salario_basico)}</td>
                    </tr>
                    {nominaSeleccionada.auxilio_transporte > 0 && (
                      <tr>
                        <td style={{ padding: 8 }}>Auxilio de Transporte</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{formatearMoneda(nominaSeleccionada.auxilio_transporte)}</td>
                      </tr>
                    )}
                    {nominaSeleccionada.horas_extras > 0 && (
                      <tr>
                        <td style={{ padding: 8 }}>Horas Extras</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{formatearMoneda(nominaSeleccionada.horas_extras)}</td>
                      </tr>
                    )}
                    {nominaSeleccionada.bonificaciones > 0 && (
                      <tr>
                        <td style={{ padding: 8 }}>Bonificaciones</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{formatearMoneda(nominaSeleccionada.bonificaciones)}</td>
                      </tr>
                    )}
                    <tr style={{ backgroundColor: '#e8f5e9', fontWeight: 'bold' }}>
                      <td style={{ padding: 8 }}>TOTAL DEVENGADO</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{formatearMoneda(nominaSeleccionada.total_devengado)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Deducciones */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ color: '#f44336', borderBottom: '1px solid #f44336', paddingBottom: 8 }}>
                  DEDUCCIONES
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: 8 }}>Salud (4%)</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{formatearMoneda(nominaSeleccionada.deduccion_salud)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8 }}>Pensión (4%)</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{formatearMoneda(nominaSeleccionada.deduccion_pension)}</td>
                    </tr>
                    {nominaSeleccionada.otros_descuentos > 0 && (
                      <tr>
                        <td style={{ padding: 8 }}>Otros Descuentos</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{formatearMoneda(nominaSeleccionada.otros_descuentos)}</td>
                      </tr>
                    )}
                    <tr style={{ backgroundColor: '#ffebee', fontWeight: 'bold' }}>
                      <td style={{ padding: 8 }}>TOTAL DEDUCCIONES</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{formatearMoneda(nominaSeleccionada.total_deducciones)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Neto a pagar */}
              <div style={{
                padding: 16,
                backgroundColor: '#c62828',
                color: 'white',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: 18, fontWeight: 'bold' }}>NETO A PAGAR</span>
                <span style={{ fontSize: 24, fontWeight: 'bold' }}>{formatearMoneda(nominaSeleccionada.neto_pagar)}</span>
              </div>
            </div>
            
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button
                onClick={imprimirDesprendible}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#c62828',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 16
                }}
              >
                🖨️ Imprimir Desprendible
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // CARTA LABORAL
  const SeccionCartaLaboral = () => {
    const [generando, setGenerando] = useState(false);
    const [cartaGenerada, setCartaGenerada] = useState(false);
    
    const fechaHoy = new Date().toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const formatearMoneda = (valor) => {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
      }).format(valor || 0);
    };

    const generarCarta = () => {
      setGenerando(true);
      setTimeout(() => {
        setGenerando(false);
        setCartaGenerada(true);
      }, 1500);
    };

    const imprimirCarta = () => {
      window.print();
    };

    // Función para convertir número a letras (simplificada)
    const numeroALetras = (num) => {
      if (!num || num === 0) return 'CERO';
      // Versión simplificada - solo formatea con separadores
      return new Intl.NumberFormat('es-CO').format(num);
    };

    const nombreEmpresa = configEmpresa?.nombre_empresa || empresa?.nombre || 'EMPRESA';
    const nitEmpresa = configEmpresa?.nit || empresa?.nit || '';
    const direccionEmpresa = configEmpresa?.direccion || empresa?.direccion || '';
    const ciudadEmpresa = configEmpresa?.ciudad || empresa?.ciudad || 'Ciudad';
    const representanteLegal = configEmpresa?.representante_legal || empresa?.representante_legal || 'REPRESENTANTE LEGAL';

    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 20 }}>📄 Carta Laboral</h2>
        
        {!cartaGenerada ? (
          <div style={{
            padding: 40,
            backgroundColor: '#f5f5f5',
            borderRadius: 16,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 60, marginBottom: 20 }}>📄</div>
            <h3 style={{ color: '#c62828' }}>Generar Carta Laboral</h3>
            <p style={{ color: '#666', marginBottom: 24 }}>
              Se generará una carta laboral con tu información básica y salario.
            </p>
            <button
              onClick={generarCarta}
              disabled={generando}
              style={{
                padding: '14px 32px',
                backgroundColor: '#c62828',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: 16,
                cursor: generando ? 'wait' : 'pointer',
                opacity: generando ? 0.7 : 1
              }}
            >
              {generando ? '⏳ Generando...' : '📄 Generar Carta'}
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setCartaGenerada(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f5f5f5',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                marginBottom: 20
              }}
            >
              ← Volver
            </button>
            
            <div id="carta-print" style={{
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: 12,
              padding: 40,
              maxWidth: 700,
              margin: '0 auto'
            }}>
              {/* Membrete */}
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <h2 style={{ margin: 0, color: '#c62828' }}>{nombreEmpresa}</h2>
                <p style={{ margin: '4px 0', fontSize: 12 }}>NIT: {nitEmpresa}</p>
                <p style={{ margin: '4px 0', fontSize: 12 }}>{direccionEmpresa}</p>
              </div>
              
              {/* Fecha y destinatario */}
              <div style={{ marginBottom: 30 }}>
                <p>{ciudadEmpresa}, {fechaHoy}</p>
                <br />
                <p><strong>A QUIEN INTERESE</strong></p>
              </div>
              
              {/* Cuerpo de la carta */}
              <div style={{ lineHeight: 1.8, textAlign: 'justify' }}>
                <p>
                  La empresa <strong>{nombreEmpresa}</strong>, identificada con NIT 
                  {' '}<strong>{nitEmpresa}</strong>, certifica que:
                </p>
                
                <p style={{ marginTop: 20 }}>
                  <strong>{(empleado?.nombre || usuario?.nombre || '').toUpperCase()}</strong>, identificado(a) con cédula de ciudadanía 
                  número <strong>{empleado?.documento || usuario?.usuario}</strong>, labora en nuestra empresa 
                  {empleado?.fecha_ingreso && ` desde el ${new Date(empleado.fecha_ingreso).toLocaleDateString('es-CO')}`}, 
                  desempeñando el cargo de <strong>{(empleado?.cargo || 'COLABORADOR').toUpperCase()}</strong>.
                </p>
                
                {empleado?.salario_basico && (
                  <p style={{ marginTop: 20 }}>
                    Actualmente devenga un salario básico mensual de <strong>{formatearMoneda(empleado.salario_basico)}</strong> 
                    {' '}({numeroALetras(empleado.salario_basico)} PESOS M/CTE).
                  </p>
                )}
                
                <p style={{ marginTop: 20 }}>
                  El tipo de contrato es <strong>{(empleado?.tipo_contrato || 'TÉRMINO INDEFINIDO').toUpperCase()}</strong>.
                </p>
                
                <p style={{ marginTop: 30 }}>
                  La presente certificación se expide a solicitud del interesado en la ciudad de 
                  {' '}{ciudadEmpresa} a los {new Date().getDate()} días del mes de 
                  {' '}{new Date().toLocaleDateString('es-CO', { month: 'long' })} de {new Date().getFullYear()}.
                </p>
              </div>
              
              {/* Firma */}
              <div style={{ marginTop: 60 }}>
                <p>Cordialmente,</p>
                <br /><br /><br />
                <p style={{ borderTop: '1px solid #333', width: 250, paddingTop: 8 }}>
                  <strong>{representanteLegal}</strong><br />
                  <span style={{ fontSize: 12 }}>Representante Legal</span><br />
                  <span style={{ fontSize: 12 }}>{nombreEmpresa}</span>
                </p>
              </div>
            </div>
            
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button
                onClick={imprimirCarta}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#c62828',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 16
                }}
              >
                🖨️ Imprimir Carta
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // CONTRATO DE TRABAJO
  const SeccionContrato = () => {
    const contratoDoc = documentos.find(d => d.tipo === 'contrato');
    
    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 20 }}>📋 Contrato de Trabajo</h2>
        
        {contratoDoc ? (
          <div style={{
            padding: 24,
            backgroundColor: '#f5f5f5',
            borderRadius: 12,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>📋</div>
            <h3>Tu contrato está disponible</h3>
            <p style={{ color: '#666', marginBottom: 20 }}>
              Haz clic para descargar tu contrato de trabajo.
            </p>
            <a
              href={contratoDoc.url}
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
              📥 Descargar Contrato
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
            <h3 style={{ color: '#e65100' }}>Contrato no disponible</h3>
            <p style={{ color: '#666' }}>
              Tu contrato aún no ha sido cargado al sistema.<br />
              Por favor, contacta al área de Recursos Humanos.
            </p>
          </div>
        )}
        
        {/* Información del contrato */}
        <div style={{
          marginTop: 24,
          padding: 20,
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: 12
        }}>
          <h4 style={{ color: '#c62828', marginBottom: 16 }}>📊 Información de tu contrato</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <span style={{ color: '#666', fontSize: 12 }}>Tipo de contrato</span>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{empleado?.tipo_contrato || 'No especificado'}</p>
            </div>
            <div>
              <span style={{ color: '#666', fontSize: 12 }}>Fecha de ingreso</span>
              <p style={{ margin: 0, fontWeight: 'bold' }}>
                {empleado?.fecha_ingreso ? new Date(empleado.fecha_ingreso).toLocaleDateString('es-CO') : 'No especificada'}
              </p>
            </div>
            <div>
              <span style={{ color: '#666', fontSize: 12 }}>Cargo</span>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{empleado?.cargo || 'No especificado'}</p>
            </div>
            <div>
              <span style={{ color: '#666', fontSize: 12 }}>Sede</span>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{empleado?.sede || 'No especificada'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // MIS HORARIOS
  const SeccionHorarios = () => {
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    return (
      <div>
        <h2 style={{ color: '#c62828', marginBottom: 20 }}>🕐 Mis Horarios</h2>
        
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
              Aún no tienes horarios asignados para los próximos días.<br />
              Los horarios aparecerán aquí cuando sean programados por tu supervisor.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {horarios.map((horario, idx) => {
              const fecha = new Date(horario.fecha + 'T00:00:00');
              const diaSemana = diasSemana[fecha.getDay()];
              const esHoy = horario.fecha === new Date().toISOString().split('T')[0];
              
              return (
                <div
                  key={idx}
                  style={{
                    padding: 16,
                    backgroundColor: esHoy ? '#ffebee' : 'white',
                    border: esHoy ? '2px solid #d32f2f' : '1px solid #e0e0e0',
                    borderRadius: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', color: esHoy ? '#d32f2f' : '#c62828' }}>
                      {diaSemana} {esHoy && '(HOY)'}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {fecha.toLocaleDateString('es-CO')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {horario.es_descanso ? (
                      <span style={{
                        padding: '6px 12px',
                        backgroundColor: '#e8f5e9',
                        color: '#2e7d32',
                        borderRadius: 20,
                        fontSize: 14
                      }}>
                        🌴 Descanso
                      </span>
                    ) : (
                      <>
                        <div style={{ fontWeight: 'bold', fontSize: 18, color: '#c62828' }}>
                          {horario.hora_inicio} - {horario.hora_fin}
                        </div>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          {horario.sede || empleado?.sede}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
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
      { id: 'permiso', nombre: 'Permiso', icono: '🙋' },
      { id: 'vacaciones', nombre: 'Vacaciones', icono: '🏖️' },
      { id: 'licencia', nombre: 'Licencia', icono: '📋' },
      { id: 'cambio_horario', nombre: 'Cambio de Horario', icono: '🕐' },
      { id: 'certificado', nombre: 'Certificado Laboral', icono: '📄' },
      { id: 'otro', nombre: 'Otra Solicitud', icono: '📝' },
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
          alert('✅ Solicitud enviada correctamente');
          setModo('lista');
          setTipoSolicitud('');
          setDescripcion('');
          setFechaInicio('');
          setFechaFin('');
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
        case 'aprobada': return { bg: '#e8f5e9', color: '#2e7d32' };
        case 'rechazada': return { bg: '#ffebee', color: '#c62828' };
        default: return { bg: '#fff3e0', color: '#e65100' };
      }
    };

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#c62828', margin: 0 }}>📝 Solicitudes</h2>
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
              ➕ Nueva Solicitud
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
              ← Volver
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
        ) : (
          <div>
            {solicitudes.length === 0 ? (
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
