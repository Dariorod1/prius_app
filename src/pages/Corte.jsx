import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Scissors, CheckCircle, PlayCircle, RefreshCw, AlertTriangle, ArrowLeft, Image } from 'lucide-react';

const ESTADOS_COLA = ['Autorizado'];
const ESTADOS_EN_PROGRESO = ['En Corte'];
const ESTADOS_TERMINADO = ['Corte Finalizado'];

const PRIORIDAD_COLORS = {
  urgente: '#EF4444',
  alta: '#10B981',
  media: '#FACC15',
  baja: '#94A3B8',
  ninguna: 'transparent'
};

const PRIORIDAD_LABELS = {
  urgente: 'URGENTE',
  alta: 'ALTA',
  media: 'MEDIA',
  baja: 'BAJA',
  ninguna: ''
};

const Corte = () => {
  const [lotes, setLotes] = useState([]);
  const [pedidosTodos, setPedidosTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actualizando, setActualizando] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [loteAbierto, setLoteAbierto] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState(0);
  const skipRealtimeRef = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (mensaje) {
      const t = setTimeout(() => setMensaje(null), 3500);
      return () => clearTimeout(t);
    }
  }, [mensaje]);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    const todosEstados = [...ESTADOS_COLA, ...ESTADOS_EN_PROGRESO, ...ESTADOS_TERMINADO];

    const [lotesRes, pedidosRes] = await Promise.all([
      supabase.from('lotes').select('*, instituciones(nombre)'),
      supabase.from('pedidos')
        .select('*, clientes(nombre, dni), instituciones(nombre)')
        .in('estado', todosEstados)
        .order('fecha_creacion', { ascending: true })
    ]);

    if (lotesRes.data) setLotes(lotesRes.data);
    if (pedidosRes.data) setPedidosTodos(pedidosRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  useEffect(() => {
    const channel = supabase
      .channel('corte-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        if (skipRealtimeRef.current) { skipRealtimeRef.current = false; return; }
        cargarDatos();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cargarDatos]);

  const cambiarEstado = async (pedidoId, nuevoEstado) => {
    setActualizando(pedidoId);
    const user = JSON.parse(localStorage.getItem('priusUser'));
    skipRealtimeRef.current = true;
    setPedidosTodos(prev => prev.map(p => p.id === pedidoId ? { ...p, estado: nuevoEstado } : p));

    const { error } = await supabase
      .from('pedidos')
      .update({ estado: nuevoEstado })
      .eq('id', pedidoId);

    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al actualizar el estado.' });
      skipRealtimeRef.current = false;
      cargarDatos();
    } else {
      await supabase.from('pedido_estado_log').insert([{
        pedido_id: pedidoId,
        estado: nuevoEstado,
        empleado_username: user?.username || 'Desconocido'
      }]);
      setMensaje({ tipo: 'success', texto: 'Estado actualizado.' });
    }
    setActualizando(null);
  };

  const cambiarEstadoLote = async (pedidos, nuevoEstado) => {
    const user = JSON.parse(localStorage.getItem('priusUser'));
    skipRealtimeRef.current = true;
    const ids = pedidos.map(p => p.id);
    setPedidosTodos(prev => prev.map(p => ids.includes(p.id) ? { ...p, estado: nuevoEstado } : p));

    const { error } = await supabase
      .from('pedidos')
      .update({ estado: nuevoEstado })
      .in('id', ids);

    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al mover el lote.' });
      skipRealtimeRef.current = false;
      cargarDatos();
    } else {
      const logs = ids.map(id => ({
        pedido_id: id,
        estado: nuevoEstado,
        empleado_username: user?.username || 'Desconocido'
      }));
      await supabase.from('pedido_estado_log').insert(logs);
      setMensaje({ tipo: 'success', texto: 'Lote movido a "' + nuevoEstado + '"' });
    }
  };

  // Agrupar pedidos por lote (institucion_id + grado + tipo_prenda)
  const agruparPorLote = (pedidos) => {
    const grupos = {};
    pedidos.forEach(p => {
      if (!p.grado) {
        const key = 'individual_' + p.id;
        grupos[key] = { pedidos: [p], tipo_prenda: p.tipo_prenda, institucion: p.instituciones?.nombre, grado: null, lote: null };
        return;
      }
      const key = p.institucion_id + '_' + p.grado + '_' + p.tipo_prenda;
      if (!grupos[key]) {
        const lote = lotes.find(l => l.institucion_id === p.institucion_id && l.grado === p.grado);
        grupos[key] = {
          pedidos: [],
          tipo_prenda: p.tipo_prenda,
          institucion: p.instituciones?.nombre,
          grado: p.grado,
          lote: lote || null
        };
      }
      grupos[key].pedidos.push(p);
    });
    // Ordenar por prioridad
    const prioridadOrden = { urgente: 0, alta: 1, media: 2, baja: 3, ninguna: 4 };
    return Object.values(grupos).sort((a, b) => {
      const pa = prioridadOrden[a.lote?.prioridad || 'ninguna'] || 4;
      const pb = prioridadOrden[b.lote?.prioridad || 'ninguna'] || 4;
      return pa - pb;
    });
  };

  const colaLotes = agruparPorLote(pedidosTodos.filter(p => ESTADOS_COLA.includes(p.estado)));
  // En progreso: un lote se queda en esta columna si tiene al menos 1 prenda "En Corte"
  const enProgresoLotes = (() => {
    // Pedidos que son "En Corte" o "Corte Finalizado" pero pertenecen a un lote con al menos 1 en "En Corte"
    const pedidosEnProgresoOFinalizados = pedidosTodos.filter(p => ESTADOS_EN_PROGRESO.includes(p.estado) || ESTADOS_TERMINADO.includes(p.estado));
    const grupos = agruparPorLote(pedidosEnProgresoOFinalizados);
    // Filtrar: solo grupos que tengan al menos 1 prenda "En Corte"
    return grupos.filter(g => g.pedidos.some(p => ESTADOS_EN_PROGRESO.includes(p.estado)));
  })();
  // Terminados: solo lotes donde TODAS las prendas están finalizadas
  const terminadosLotesFiltrados = (() => {
    const pedidosFinalizados = pedidosTodos.filter(p => ESTADOS_TERMINADO.includes(p.estado));
    const grupos = agruparPorLote(pedidosFinalizados);
    // Solo grupos donde NO hay ninguna prenda en progreso
    return grupos.filter(g => {
      if (!g.grado) return true; // individuales pasan directo
      // Verificar que no haya prendas del mismo lote aún en corte
      const tieneEnCorte = pedidosTodos.some(p =>
        p.institucion_id === g.pedidos[0]?.institucion_id &&
        p.grado === g.grado &&
        p.tipo_prenda === g.tipo_prenda &&
        ESTADOS_EN_PROGRESO.includes(p.estado)
      );
      return !tieneEnCorte;
    });
  })();

  // =========== DETALLE DE LOTE ===========
  if (loteAbierto) {
    const { grupo } = loteAbierto;
    // Re-fetch pedidos actuales del grupo
    const pedidosDelGrupo = grupo.grado
      ? pedidosTodos.filter(p => p.institucion_id === grupo.pedidos[0]?.institucion_id && p.grado === grupo.grado && p.tipo_prenda === grupo.tipo_prenda)
      : grupo.pedidos;
    const loteInfo = grupo.lote;
    const imagen = grupo.tipo_prenda === 'Chomba' ? loteInfo?.imagen_chomba_url : loteInfo?.imagen_campera_url;

    return (
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {mensaje && (
          <div style={{
            position: 'fixed', bottom: '20px', right: '20px', padding: '1rem 2rem',
            borderRadius: '8px', backgroundColor: mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)',
            color: 'white', fontWeight: '500', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', zIndex: 10000
          }}>
            {mensaje.texto}
          </div>
        )}

        <button
          onClick={() => setLoteAbierto(null)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.9rem', padding: 0 }}
        >
          <ArrowLeft size={18} /> Volver al Kanban
        </button>

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {imagen ? (
            <img src={imagen} alt={grupo.tipo_prenda} style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
          ) : (
            <div style={{ width: '120px', height: '120px', borderRadius: '12px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image size={40} style={{ color: 'var(--text-muted)' }} />
            </div>
          )}
          <div>
            <h1 style={{ color: 'var(--primary)', margin: '0 0 0.25rem 0' }}>{grupo.tipo_prenda}</h1>
            <p style={{ color: 'var(--text-main)', margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>{grupo.institucion}</p>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>{grupo.grado} — {pedidosDelGrupo.length} prendas</p>
            {loteInfo?.prioridad && loteInfo.prioridad !== 'ninguna' && (
              <span style={{ display: 'inline-block', marginTop: '0.5rem', padding: '3px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: PRIORIDAD_COLORS[loteInfo.prioridad] + '25', color: PRIORIDAD_COLORS[loteInfo.prioridad] }}>
                {PRIORIDAD_LABELS[loteInfo.prioridad]}
              </span>
            )}
          </div>
        </div>

        {/* Acciones masivas */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {pedidosDelGrupo.some(p => ESTADOS_COLA.includes(p.estado)) && (
            <button onClick={() => cambiarEstadoLote(pedidosDelGrupo.filter(p => ESTADOS_COLA.includes(p.estado)), 'En Corte')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', color: 'white', border: 'none', padding: '0.7rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              <PlayCircle size={16} /> Iniciar Corte ({pedidosDelGrupo.filter(p => ESTADOS_COLA.includes(p.estado)).length})
            </button>
          )}
          {pedidosDelGrupo.some(p => ESTADOS_EN_PROGRESO.includes(p.estado)) && (
            <>
              <button onClick={() => cambiarEstadoLote(pedidosDelGrupo.filter(p => ESTADOS_EN_PROGRESO.includes(p.estado)), 'Corte Finalizado')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#10B981', color: 'white', border: 'none', padding: '0.7rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                <CheckCircle size={16} /> Finalizar ({pedidosDelGrupo.filter(p => ESTADOS_EN_PROGRESO.includes(p.estado)).length})
              </button>
              <button onClick={() => cambiarEstadoLote(pedidosDelGrupo.filter(p => ESTADOS_EN_PROGRESO.includes(p.estado)), 'Autorizado')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-sidebar)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '0.7rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}>
                <RefreshCw size={16} /> Devolver a Cola
              </button>
            </>
          )}
          {pedidosDelGrupo.every(p => ESTADOS_TERMINADO.includes(p.estado)) && (
            <button onClick={() => cambiarEstadoLote(pedidosDelGrupo, 'En Corte')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-sidebar)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '0.7rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}>
              <RefreshCw size={16} /> Reabrir Corte
            </button>
          )}
        </div>

        {/* Resumen de talles */}
        {pedidosDelGrupo.length > 0 && (() => {
          const talleOrden = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2', '4', '6', '8', '10', '12', '14', '16'];
          const conteo = {};
          pedidosDelGrupo.forEach(p => { conteo[p.talle] = (conteo[p.talle] || 0) + 1; });
          const tallesOrdenados = Object.entries(conteo).sort((a, b) => {
            const ia = talleOrden.indexOf(a[0]);
            const ib = talleOrden.indexOf(b[0]);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
          });
          return (
            <div style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'var(--bg-dark)', borderRadius: '12px', border: '2px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cortar:</div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {tallesOrdenados.map(([talle, cant]) => (
                  <div key={talle} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem 1.25rem', borderRadius: '10px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', minWidth: '70px' }}>
                    <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--accent)', lineHeight: 1 }}>{cant}</span>
                    <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '4px' }}>{talle}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Lista de prendas */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
          {pedidosDelGrupo.map((p, idx) => {
            const finalizado = ESTADOS_TERMINADO.includes(p.estado);
            return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
              borderBottom: idx < pedidosDelGrupo.length - 1 ? '1px solid var(--border-color)' : 'none',
              background: finalizado ? 'rgba(16,185,129,0.06)' : 'var(--bg-sidebar)'
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', width: '28px', flexShrink: 0, fontWeight: 'bold' }}>{idx + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>{p.clientes?.nombre || p.cliente_dni}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2px' }}>
                  <span>Talle: <strong style={{ color: 'var(--accent)' }}>{p.talle}</strong></span>
                  {p.nombre_bordado && <span>Bordado: <strong style={{ color: 'var(--text-main)' }}>{p.nombre_bordado}</strong></span>}
                </div>
                {p.observaciones && (
                  <div style={{ marginTop: '4px', fontSize: '0.8rem', color: '#FACC15', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> {p.observaciones}
                  </div>
                )}
              </div>
              {ESTADOS_COLA.includes(p.estado) && (
                <button onClick={() => cambiarEstado(p.id, 'En Corte')} disabled={actualizando === p.id} style={{ background: '#7C3AED', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0, opacity: actualizando === p.id ? 0.5 : 1 }}>
                  <PlayCircle size={14} />
                </button>
              )}
              {ESTADOS_EN_PROGRESO.includes(p.estado) && (
                <button onClick={() => cambiarEstado(p.id, 'Corte Finalizado')} disabled={actualizando === p.id} style={{ background: '#10B981', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0, opacity: actualizando === p.id ? 0.5 : 1 }}>
                  <CheckCircle size={14} />
                </button>
              )}
              {finalizado && (
                <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 'bold', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={14} /> Listo
                </span>
              )}
            </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========== KANBAN PRINCIPAL ===========
  const CardLote = ({ grupo, color }) => {
    const loteInfo = grupo.lote;
    const imagen = grupo.tipo_prenda === 'Chomba' ? loteInfo?.imagen_chomba_url : loteInfo?.imagen_campera_url;
    const prioridadColor = loteInfo?.prioridad ? PRIORIDAD_COLORS[loteInfo.prioridad] : 'transparent';
    const prioridadLabel = loteInfo?.prioridad ? PRIORIDAD_LABELS[loteInfo.prioridad] : '';
    const cantidad = grupo.pedidos.length;
    const esIndividual = !grupo.grado;

    return (
      <div
        onClick={() => { if (!esIndividual) setLoteAbierto({ grupo }); }}
        style={{
          background: 'var(--bg-sidebar)', borderRadius: '12px',
          border: '1px solid var(--border-color)',
          cursor: esIndividual ? 'default' : 'pointer',
          transition: 'transform 0.15s, box-shadow 0.15s',
          overflow: 'hidden'
        }}
        onMouseEnter={(e) => { if (!esIndividual) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'; } }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
      >
        {/* Barra prioridad */}
        {prioridadColor !== 'transparent' && (
          <div style={{ height: '5px', background: prioridadColor, width: '100%' }}></div>
        )}

        {/* Imagen grande */}
        {imagen ? (
          <div style={{ width: '100%', height: '160px', overflow: 'hidden', background: 'var(--bg-dark)' }}>
            <img src={imagen} alt={grupo.tipo_prenda} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={{ width: '100%', height: '100px', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Scissors size={36} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          </div>
        )}

        {/* Info debajo de la imagen */}
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1.05rem' }}>{grupo.tipo_prenda}</span>
            <span style={{ background: color + '30', color: color, fontSize: '0.8rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>{cantidad}</span>
            {prioridadLabel && (
              <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', background: prioridadColor + '25', color: prioridadColor }}>
                {prioridadLabel}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {grupo.institucion}
          </div>
          {grupo.grado && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{grupo.grado}</div>
          )}
          {grupo.grado && grupo.pedidos.some(p => ESTADOS_TERMINADO.includes(p.estado)) && (
            <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '4px', fontWeight: '600' }}>
              {grupo.pedidos.filter(p => ESTADOS_TERMINADO.includes(p.estado)).length}/{cantidad} finalizadas
            </div>
          )}
          {esIndividual && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {grupo.pedidos[0]?.clientes?.nombre} — T: {grupo.pedidos[0]?.talle}
            </div>
          )}
        </div>
      </div>
    );
  };

  const columnas = [
    { titulo: 'Cola de Corte', subtitle: 'Esperando ser cortados', color: '#3B82F6', grupos: colaLotes },
    { titulo: 'En Corte', subtitle: 'En proceso ahora', color: '#7C3AED', grupos: enProgresoLotes },
    { titulo: 'Corte Finalizado', subtitle: 'Finalizados', color: '#10B981', grupos: terminadosLotesFiltrados }
  ];

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
      {mensaje && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', padding: '1rem 2rem',
          borderRadius: '8px', backgroundColor: mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)',
          color: 'white', fontWeight: '500', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', zIndex: 10000
        }}>
          {mensaje.texto}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ color: 'var(--primary)', marginBottom: '0.25rem' }}>Mesa de Corte</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Lotes agrupados por escuela y prenda</p>
        </div>
        <button
          onClick={cargarDatos}
          style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 1rem', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Cargando...</div>
      ) : (
        <>
          {isMobile ? (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', background: 'var(--bg-sidebar)', padding: '0.4rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                {columnas.map((col, idx) => (
                  <button
                    key={col.titulo}
                    onClick={() => setActiveTab(idx)}
                    style={{
                      flex: 1, padding: '0.6rem 0.25rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                      background: activeTab === idx ? col.color : 'transparent',
                      color: activeTab === idx ? 'white' : 'var(--text-muted)',
                      fontWeight: activeTab === idx ? 'bold' : 'normal',
                      fontSize: '0.75rem', transition: 'all 0.2s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px'
                    }}
                  >
                    <span>{col.titulo}</span>
                    <span style={{
                      background: activeTab === idx ? 'rgba(255,255,255,0.3)' : col.color + '40',
                      color: activeTab === idx ? 'white' : col.color,
                      borderRadius: '10px', padding: '1px 6px', fontSize: '0.7rem'
                    }}>
                      {col.grupos.length}
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {columnas[activeTab].grupos.length === 0 ? (
                  <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                    Sin lotes en esta etapa
                  </div>
                ) : (
                  columnas[activeTab].grupos.map((grupo, i) => (
                    <CardLote key={i} grupo={grupo} color={columnas[activeTab].color} />
                  ))
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
              {columnas.map((col) => (
                <div key={col.titulo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: col.color, flexShrink: 0 }}></div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>
                        {col.titulo}
                        <span style={{ marginLeft: '0.5rem', background: col.color + '30', color: col.color, padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                          {col.grupos.length}
                        </span>
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{col.subtitle}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {col.grupos.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                        Sin lotes
                      </div>
                    ) : (
                      col.grupos.map((grupo, i) => (
                        <CardLote key={i} grupo={grupo} color={col.color} />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Corte;
