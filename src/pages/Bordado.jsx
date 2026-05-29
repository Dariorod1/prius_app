import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Sparkles, CheckCircle, PlayCircle, RefreshCw, AlertTriangle, X, ArrowLeft, PauseCircle, ChevronDown, ChevronRight } from 'lucide-react';

const ESTADOS_COLA = ['Confección Finalizada'];
const ESTADOS_EN_PROGRESO = ['En Bordado'];
const ESTADOS_TERMINADO = ['Bordado Finalizado'];

const PRIORIDAD_ORDEN  = { urgente: 0, alta: 1, media: 2, baja: 3, ninguna: 4 };
const PRIORIDAD_COLORS = { urgente: '#EF4444', alta: '#10B981', media: '#FACC15', baja: '#94A3B8', ninguna: 'transparent' };
const getLoteKey = (g) => g.grado
  ? (g.pedidos[0]?.institucion_id + '|' + g.grado + '|' + g.tipo_prenda)
  : ('ind|' + g.pedidos[0]?.id);

const Bordado = () => {
  const [lotes, setLotes] = useState([]);
  const [pedidosTodos, setPedidosTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actualizando, setActualizando] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [loteAbierto, setLoteAbierto] = useState(null);
  const [modalNombre, setModalNombre] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState(0);
  const skipRealtimeCountRef = useRef(0);
  const fetchIdRef = useRef(0);
  const realtimeDebounceRef = useRef(null);
  const draggedGrupoRef = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [tallesAbiertos, setTallesAbiertos] = useState({});

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
    const myId = ++fetchIdRef.current;
    const todosEstados = [...ESTADOS_COLA, ...ESTADOS_EN_PROGRESO, ...ESTADOS_TERMINADO];
    const [lotesRes, pedidosRes] = await Promise.all([
      supabase.from('lotes').select('*, instituciones(nombre)'),
      supabase.from('pedidos')
        .select('*, clientes(nombre, dni), instituciones(nombre)')
        .in('estado', todosEstados)
        .order('fecha_creacion', { ascending: true })
    ]);
    if (myId !== fetchIdRef.current) return;
    if (lotesRes.data) setLotes(lotesRes.data);
    if (pedidosRes.data) setPedidosTodos(pedidosRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  useEffect(() => {
    const channel = supabase
      .channel('bordado-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        if (skipRealtimeCountRef.current > 0) { skipRealtimeCountRef.current--; return; }
        clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(cargarDatos, 400);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cargarDatos]);

  const cambiarEstado = async (pedidoId, nuevoEstado) => {
    setActualizando(pedidoId);
    const user = JSON.parse(localStorage.getItem('priusUser'));
    skipRealtimeCountRef.current += 1;
    setPedidosTodos(prev => prev.map(p => p.id === pedidoId ? { ...p, estado: nuevoEstado } : p));
    if (modalNombre && modalNombre.id === pedidoId) setModalNombre(prev => ({ ...prev, estado: nuevoEstado }));
    const { error } = await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', pedidoId);
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al actualizar.' });
      skipRealtimeCountRef.current = 0;
      cargarDatos();
    } else {
      await supabase.from('pedido_estado_log').insert([{ pedido_id: pedidoId, estado: nuevoEstado, empleado_username: user?.username || 'Desconocido' }]);
    }
    setActualizando(null);
  };

  const cambiarEstadoLote = async (pedidos, nuevoEstado) => {
    if (!pedidos || pedidos.length === 0) return;
    const user = JSON.parse(localStorage.getItem('priusUser'));
    const ids = pedidos.map(p => p.id);
    skipRealtimeCountRef.current += ids.length;
    setPedidosTodos(prev => prev.map(p => ids.includes(p.id) ? { ...p, estado: nuevoEstado } : p));
    const { error } = await supabase.from('pedidos').update({ estado: nuevoEstado }).in('id', ids);
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al actualizar el lote.' });
      skipRealtimeCountRef.current = 0;
      cargarDatos();
    } else {
      const logs = ids.map(id => ({ pedido_id: id, estado: nuevoEstado, empleado_username: user?.username || 'Desconocido' }));
      await supabase.from('pedido_estado_log').insert(logs);
      setMensaje({ tipo: 'success', texto: 'Lote actualizado' });
    }
  };

  const cambiarPausado = async (pedidoId, pausar) => {
    skipRealtimeCountRef.current += 1;
    setPedidosTodos(prev => prev.map(p => p.id === pedidoId ? { ...p, pausado: pausar } : p));
    const { error } = await supabase.from('pedidos').update({ pausado: pausar }).eq('id', pedidoId);
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al excluir: ' + error.message });
      skipRealtimeCountRef.current = 0;
      cargarDatos();
    }
  };

  const agruparPorLote = (pedidos) => {
    const grupos = {};
    pedidos.forEach(p => {
      if (!p.grado) {
        grupos['individual_' + p.id] = { pedidos: [p], tipo_prenda: p.tipo_prenda, institucion: p.instituciones?.nombre, grado: null, lote: null, prioridad: 'ninguna' };
        return;
      }
      const key = p.institucion_id + '_' + p.grado + '_' + p.tipo_prenda;
      if (!grupos[key]) {
        const lote = lotes.find(l => l.institucion_id === p.institucion_id && l.grado === p.grado);
        const prioridad = p.tipo_prenda === 'Chomba'
          ? (lote?.prioridad_chomba || lote?.prioridad || 'ninguna')
          : (p.tipo_prenda === 'Campera'
            ? (lote?.prioridad_campera || lote?.prioridad || 'ninguna')
            : (lote?.prioridad || 'ninguna'));
        grupos[key] = { pedidos: [], tipo_prenda: p.tipo_prenda, institucion: p.instituciones?.nombre, grado: p.grado, lote: lote || null, prioridad };
      }
      grupos[key].pedidos.push(p);
    });
    return Object.values(grupos).sort((a, b) => {
      const pa = PRIORIDAD_ORDEN[a.prioridad] ?? 4;
      const pb = PRIORIDAD_ORDEN[b.prioridad] ?? 4;
      if (pa !== pb) return pa - pb;
      return (a.pedidos[0]?.fecha_creacion || '').localeCompare(b.pedidos[0]?.fecha_creacion || '');
    });
  };

  // Agrupar TODOS los pedidos juntos para que cada lote siempre esté en exactamente una columna
  const todosGrupos = agruparPorLote(pedidosTodos);

  // Cola: ningún pedido activo del lote ha sido tocado (paused items excluded)
  const colaLotes = todosGrupos.filter(g => {
    const np = g.pedidos.filter(p => !p.pausado);
    if (np.length === 0) return g.pedidos.length > 0;
    return !np.some(p => ESTADOS_EN_PROGRESO.includes(p.estado) || ESTADOS_TERMINADO.includes(p.estado));
  });

  // Finalizado: TODOS los pedidos activos del lote están Bordado Finalizado
  const terminadosLotes = todosGrupos.filter(g => {
    const np = g.pedidos.filter(p => !p.pausado);
    if (np.length === 0) return false;
    return np.every(p => ESTADOS_TERMINADO.includes(p.estado));
  });

  // En Bordado: al menos uno activo iniciado, pero no todos activos terminados
  const enProgresoLotes = todosGrupos.filter(g => {
    const np = g.pedidos.filter(p => !p.pausado);
    if (np.length === 0) return false;
    return np.some(p => ESTADOS_EN_PROGRESO.includes(p.estado) || ESTADOS_TERMINADO.includes(p.estado)) &&
      !np.every(p => ESTADOS_TERMINADO.includes(p.estado));
  });

  const priorNumMap = new Map(
    [...colaLotes, ...enProgresoLotes]
      .sort((a, b) => {
        const pa = PRIORIDAD_ORDEN[a.prioridad] ?? 4;
        const pb = PRIORIDAD_ORDEN[b.prioridad] ?? 4;
        if (pa !== pb) return pa - pb;
        return (a.pedidos[0]?.fecha_creacion || '').localeCompare(b.pedidos[0]?.fecha_creacion || '');
      })
      .map((g, i) => [getLoteKey(g), i + 1])
  );

  // =========== MODAL NOMBRE GRANDE ===========
  const ModalNombre = () => {
    if (!modalNombre) return null;
    const pedido = pedidosTodos.find(p => p.id === modalNombre.id) || modalNombre;
    const yaFinalizado = ESTADOS_TERMINADO.includes(pedido.estado);
    return (
      <div
        onClick={() => setModalNombre(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: 'var(--bg-sidebar)', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '480px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{pedido.tipo_prenda}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{pedido.instituciones?.nombre || pedido.institucion}</div>
              {pedido.grado && <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{pedido.grado}</div>}
            </div>
            <button onClick={() => setModalNombre(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
              <X size={24} />
            </button>
          </div>

          <div style={{ background: '#FACC15', borderRadius: '16px', padding: '2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#000', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Texto a Bordar</div>
            <div style={{ fontSize: '3rem', fontWeight: '900', color: '#000', letterSpacing: '2px', lineHeight: 1.1 }}>{pedido.nombre_bordado || '—'}</div>
          </div>

          {pedido.observaciones && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '0.75rem', color: '#F87171', fontSize: '0.95rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} /> {pedido.observaciones}
            </div>
          )}

          {pedido.observaciones_bordado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#A78BFA', fontSize: '0.95rem' }}>
              <Sparkles size={16} style={{ flexShrink: 0 }} /> {pedido.observaciones_bordado}
            </div>
          )}

          {!pedido.observaciones && !pedido.observaciones_bordado && <div style={{ marginBottom: '1.5rem' }} />}

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ background: '#FACC15', color: '#000', fontWeight: '800', fontSize: '0.85rem', padding: '3px 10px', borderRadius: '6px' }}>{pedido.talle}</span>
            Cliente: <strong style={{ color: 'var(--text-main)' }}>{pedido.clientes?.nombre}</strong>
          </div>

          {!yaFinalizado ? (
            <button
              onClick={() => { cambiarEstado(pedido.id, 'Bordado Finalizado'); setModalNombre(null); }}
              disabled={actualizando === pedido.id}
              style={{ width: '100%', padding: '1.25rem', borderRadius: '12px', border: 'none', cursor: 'pointer', background: '#10B981', color: 'white', fontWeight: '800', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', opacity: actualizando === pedido.id ? 0.6 : 1, boxShadow: '0 4px 14px rgba(16,185,129,0.4)' }}>
              <CheckCircle size={22} /> {actualizando === pedido.id ? '...' : 'Marcar como Bordado'}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(16,185,129,0.12)', borderRadius: '10px', color: '#10B981', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <CheckCircle size={18} /> Bordado completado
              </div>
              <button
                onClick={() => { cambiarEstado(pedido.id, 'En Bordado'); setModalNombre(null); }}
                style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', border: '1px solid var(--border-color)', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Reabrir bordado
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // =========== DETALLE DE LOTE ===========
  if (loteAbierto) {
    const { grupo } = loteAbierto;
    const pedidosDelGrupo = grupo.grado
      ? pedidosTodos.filter(p => p.institucion_id === grupo.pedidos[0]?.institucion_id && p.grado === grupo.grado && p.tipo_prenda === grupo.tipo_prenda)
      : grupo.pedidos;
    const loteInfo = grupo.lote;
    const imagen = grupo.tipo_prenda === 'Chomba' ? loteInfo?.imagen_chomba_url : loteInfo?.imagen_campera_url;
    const pausados    = pedidosDelGrupo.filter(p => p.pausado);
    const finalizados = pedidosDelGrupo.filter(p => ESTADOS_TERMINADO.includes(p.estado) && !p.pausado);
    const enBordado   = pedidosDelGrupo.filter(p => ESTADOS_EN_PROGRESO.includes(p.estado) && !p.pausado);
    const enCola      = pedidosDelGrupo.filter(p => ESTADOS_COLA.includes(p.estado) && !p.pausado);
    const total = pedidosDelGrupo.filter(p => !p.pausado).length;
    const pct = total > 0 ? Math.round((finalizados.length / total) * 100) : 0;

    return (
      <div style={{ maxWidth: '520px', margin: '0 auto', paddingBottom: '2rem' }}>
        {modalNombre && <ModalNombre />}
        {mensaje && (
          <div style={{ position: 'fixed', bottom: '20px', right: '20px', padding: '1rem 1.5rem', borderRadius: '8px', backgroundColor: mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)', color: 'white', fontWeight: '500', zIndex: 10000 }}>
            {mensaje.texto}
          </div>
        )}

        <button onClick={() => setLoteAbierto(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', padding: '0.5rem 0', marginBottom: '1rem' }}>
          <ArrowLeft size={18} /> Volver al kanban
        </button>

        {imagen && (
          <div style={{ width: '100%', maxHeight: '240px', overflow: 'hidden', borderRadius: '16px', marginBottom: '1.25rem', background: 'var(--bg-dark)' }}>
            <img src={imagen} alt={grupo.tipo_prenda} style={{ width: '100%', maxHeight: '240px', objectFit: 'contain' }} />
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.6rem', fontWeight: '900', color: 'var(--text-main)' }}>{grupo.institucion}</h2>
          {grupo.grado && <div style={{ fontSize: '1.2rem', color: '#FACC15', fontWeight: '800', marginBottom: '4px' }}>{grupo.grado}</div>}
          <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>{grupo.tipo_prenda}</div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{finalizados.length} de {total} bordados{pausados.length > 0 ? ' (' + pausados.length + ' excluida' + (pausados.length !== 1 ? 's' : '') + ')' : ''}</span>
            <span style={{ color: '#FACC15', fontWeight: '700' }}>{pct}%</span>
          </div>
          <div style={{ height: '8px', background: 'var(--bg-dark)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: pct + '%', background: '#FACC15', borderRadius: '4px', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* === LISTA AGRUPADA POR TALLE === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
          {(() => {
            const TALLE_ORDEN = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2', '4', '6', '8', '10', '12', '14', '16'];
            const porTalle = {};
            pedidosDelGrupo.forEach(p => {
              const t = p.talle || 'Sin talle';
              if (!porTalle[t]) porTalle[t] = [];
              porTalle[t].push(p);
            });
            return Object.entries(porTalle)
              .sort((a, b) => {
                const ia = TALLE_ORDEN.indexOf(a[0]);
                const ib = TALLE_ORDEN.indexOf(b[0]);
                if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
                if (ia === -1) return 1;
                if (ib === -1) return -1;
                return ia - ib;
              })
              .map(([talle, items]) => {
              const activos = items.filter(p => !p.pausado);
              const hechos = activos.filter(p => ESTADOS_TERMINADO.includes(p.estado)).length;
              const abierto = !!tallesAbiertos[talle];
              const todosHechos = activos.length > 0 && hechos === activos.length;
              return (
                <div key={talle} style={{ borderRadius: '14px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  {/* Header del grupo talle — clickeable para desplegar */}
                  <div
                    onClick={() => setTallesAbiertos(prev => ({ ...prev, [talle]: !prev[talle] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--bg-dark)', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 0.2s' }}>
                      {abierto ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </span>
                    <span style={{ background: '#FACC15', color: '#000', fontWeight: '900', fontSize: '1.1rem', padding: '4px 12px', borderRadius: '8px', letterSpacing: '0.5px' }}>{talle}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{activos.length} prenda{activos.length !== 1 ? 's' : ''}</span>
                    <span style={{ fontSize: '0.8rem', color: todosHechos ? '#10B981' : 'var(--text-muted)', fontWeight: '600', marginLeft: 'auto' }}>{hechos}/{activos.length} ✓</span>
                  </div>
                  {/* Items del talle — colapsable */}
                  {abierto && (
                    <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border-color)' }}>
                      {items.map((pedido, idx) => {
                        const done = ESTADOS_TERMINADO.includes(pedido.estado);
                        const enProg = ESTADOS_EN_PROGRESO.includes(pedido.estado);
                        const esPausado = !!pedido.pausado;
                        const tieneObs = !!pedido.observaciones;
                        const tieneObsBordado = !!pedido.observaciones_bordado;
                        return (
                          <div key={pedido.id}>
                            <div
                              onClick={() => !esPausado && setModalNombre(pedido)}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: esPausado ? 'rgba(148,163,184,0.04)' : (done ? 'rgba(16,185,129,0.05)' : 'var(--bg-sidebar)'), cursor: esPausado ? 'default' : 'pointer', opacity: esPausado ? 0.5 : (done ? 0.7 : 1) }}>
                              <div style={{ flexShrink: 0 }}>
                                {done
                                  ? <CheckCircle size={20} style={{ color: '#10B981' }} />
                                  : esPausado
                                    ? <PauseCircle size={20} style={{ color: '#94A3B8' }} />
                                    : <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid ' + (enProg ? '#FACC15' : 'var(--border-color)'), background: enProg ? 'rgba(250,204,21,0.1)' : 'transparent' }} />
                                }
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: esPausado ? '#94A3B8' : (done ? 'var(--text-muted)' : '#FACC15'), textDecoration: done ? 'line-through' : 'none', letterSpacing: '1px' }}>
                                  {pedido.nombre_bordado || '(sin texto)'}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{pedido.clientes?.nombre}</div>
                              </div>
                              {!done && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); cambiarPausado(pedido.id, !esPausado); }}
                                  title={esPausado ? 'Reincorporar al lote' : 'Excluir del lote'}
                                  style={{ background: esPausado ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: esPausado ? '#10B981' : '#EF4444', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0, lineHeight: 1 }}
                                >
                                  {esPausado ? 'Reincorporar' : 'Excluir'}
                                </button>
                              )}
                              {!esPausado && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0 }}>›</div>}
                            </div>
                            {/* Observaciones inline — siempre visibles */}
                            {(tieneObs || tieneObsBordado) && !esPausado && (
                              <div style={{ padding: '0 1rem 0.6rem 3.5rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {tieneObs && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#F87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '6px', padding: '4px 8px' }}>
                                    <AlertTriangle size={12} style={{ flexShrink: 0 }} /> {pedido.observaciones}
                                  </div>
                                )}
                                {tieneObsBordado && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#A78BFA', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '6px', padding: '4px 8px' }}>
                                    <Sparkles size={12} style={{ flexShrink: 0 }} /> {pedido.observaciones_bordado}
                                  </div>
                                )}
                              </div>
                            )}
                            {idx < items.length - 1 && <div style={{ height: '1px', background: 'var(--border-color)', margin: '0 1rem' }} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {enCola.length > 0 && (
            <button
              onClick={() => cambiarEstadoLote(enCola, 'En Bordado')}
              disabled={!!actualizando}
              style={{ width: '100%', height: '60px', borderRadius: '14px', border: 'none', cursor: 'pointer', background: '#7C3AED', color: 'white', fontWeight: '800', fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}>
              <PlayCircle size={22} /> Iniciar Bordado del Lote
            </button>
          )}
          {enBordado.length > 0 && (
            <button
              onClick={() => cambiarEstadoLote(enBordado, 'Bordado Finalizado')}
              disabled={!!actualizando}
              style={{ width: '100%', height: '60px', borderRadius: '14px', border: 'none', cursor: 'pointer', background: '#10B981', color: 'white', fontWeight: '800', fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', boxShadow: '0 4px 14px rgba(16,185,129,0.4)' }}>
              <CheckCircle size={22} /> Finalizar Lote · {enBordado.length} pendientes
            </button>
          )}
          <button
            onClick={() => cambiarEstadoLote(pedidosDelGrupo.filter(p => !ESTADOS_COLA.includes(p.estado) && !p.pausado), 'Confección Finalizada')}
            style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1px solid var(--border-color)', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Devolver lote a cola
          </button>
        </div>
      </div>
    );
  }

  // =========== CARD LOTE ===========
  const CardLote = ({ grupo, color, forwardEstado, backEstado, colEstado, priorityNum }) => {
    const loteInfo = grupo.lote;
    const imagen = grupo.tipo_prenda === 'Chomba' ? loteInfo?.imagen_chomba_url : loteInfo?.imagen_campera_url;
    const prioridadColor = grupo.prioridad && grupo.prioridad !== 'ninguna' ? PRIORIDAD_COLORS[grupo.prioridad] : 'transparent';
    const cantidadActiva = grupo.pedidos.filter(p => !p.pausado).length;
    const pausadosCount = grupo.pedidos.length - cantidadActiva;
    const cantidad = cantidadActiva;
    const esIndividual = !grupo.grado;
    const finCount = grupo.pedidos.filter(p => ESTADOS_TERMINADO.includes(p.estado) && !p.pausado).length;
    const cardRef = useRef(null);
    const touchStartX = useRef(0);
    const touchDeltaX = useRef(0);
    const swipeThreshold = 80;
    const pedidosParaAvanzar = forwardEstado ? grupo.pedidos.filter(p => p.estado === colEstado && !p.pausado) : [];
    const pedidosParaRetroceder = backEstado ? grupo.pedidos.filter(p => p.estado === colEstado && !p.pausado) : [];

    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchDeltaX.current = 0;
      if (cardRef.current) cardRef.current.style.transition = 'none';
    };
    const handleTouchMove = (e) => {
      const delta = e.touches[0].clientX - touchStartX.current;
      touchDeltaX.current = delta;
      if (cardRef.current) {
        const clamped = Math.max(-150, Math.min(150, delta));
        cardRef.current.style.transform = 'translateX(' + clamped + 'px) rotate(' + (clamped * 0.03) + 'deg)';
        if (delta > swipeThreshold && pedidosParaAvanzar.length > 0) {
          cardRef.current.style.background = 'rgba(16,185,129,0.25)';
          cardRef.current.style.borderColor = '#10B981';
        } else if (delta < -swipeThreshold && pedidosParaRetroceder.length > 0) {
          cardRef.current.style.background = 'rgba(251,146,60,0.25)';
          cardRef.current.style.borderColor = '#FB923C';
        } else {
          cardRef.current.style.background = '';
          cardRef.current.style.borderColor = '';
        }
      }
    };
    const handleTouchEnd = () => {
      const delta = touchDeltaX.current;
      if (cardRef.current) {
        cardRef.current.style.transition = 'transform 0.3s ease, opacity 0.3s ease, background 0.3s ease';
        if (delta > swipeThreshold && pedidosParaAvanzar.length > 0) {
          cardRef.current.style.transform = 'translateX(110%) rotate(4deg)';
          cardRef.current.style.opacity = '0';
          setTimeout(() => cambiarEstadoLote(pedidosParaAvanzar, forwardEstado), 300);
        } else if (delta < -swipeThreshold && pedidosParaRetroceder.length > 0) {
          cardRef.current.style.transform = 'translateX(-110%) rotate(-4deg)';
          cardRef.current.style.opacity = '0';
          setTimeout(() => cambiarEstadoLote(pedidosParaRetroceder, backEstado), 300);
        } else {
          cardRef.current.style.transform = '';
          cardRef.current.style.background = '';
          cardRef.current.style.borderColor = '';
        }
      }
    };

    return (
      <div
        ref={cardRef}
        draggable={!isMobile}
        onDragStart={() => { draggedGrupoRef.current = grupo; }}
        onDragEnd={() => { draggedGrupoRef.current = null; setDragOverCol(null); }}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
        onClick={() => { if (!esIndividual && Math.abs(touchDeltaX.current) < 10) setLoteAbierto({ grupo }); }}
        style={{ background: 'var(--bg-sidebar)', borderRadius: '12px', border: '1px solid var(--border-color)', cursor: isMobile ? 'default' : (esIndividual ? 'default' : 'grab'), overflow: 'hidden', touchAction: isMobile ? 'pan-y' : 'auto' }}>
        {prioridadColor !== 'transparent' && (
          <div style={{ height: '5px', background: prioridadColor, width: '100%' }} />
        )}
        {imagen ? (
          <div style={{ width: '100%', height: '160px', overflow: 'hidden', background: 'var(--bg-dark)' }}>
            <img src={imagen} alt={grupo.tipo_prenda} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={{ width: '100%', height: '100px', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={36} style={{ color: '#FACC15', opacity: 0.5 }} />
          </div>
        )}
        <div style={{ padding: '1rem' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '2px' }}>{grupo.institucion}</div>
          {grupo.grado && <div style={{ fontSize: '1rem', color: '#FACC15', fontWeight: '700', marginBottom: '4px' }}>{grupo.grado}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span style={{ background: color + '30', color: color, fontSize: '0.8rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>{cantidad} prendas</span>
            {finCount > 0 && <span style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: '600' }}>{finCount}/{cantidad} ✓</span>}
            {pausadosCount > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '0.72rem', color: '#94A3B8', fontWeight: '600' }}><PauseCircle size={11} /> {pausadosCount}</span>}
            {priorityNum && (
              <span style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '900', background: prioridadColor === 'transparent' ? 'rgba(255,255,255,0.08)' : prioridadColor + '20', color: prioridadColor === 'transparent' ? 'var(--text-muted)' : prioridadColor, letterSpacing: '-0.5px' }}>
                {'#' + priorityNum}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{grupo.tipo_prenda}</div>
          {isMobile && !esIndividual && (
            <div style={{ marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex' }}>
              {backEstado && <span>← devolver</span>}
              {forwardEstado && pedidosParaAvanzar.length > 0 && <span style={{ marginLeft: 'auto' }}>avanzar →</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  const columnas = [
    { titulo: 'Cola', subtitle: 'Esperando bordado', color: '#3B82F6', dropEstado: 'Confección Finalizada', grupos: colaLotes, forwardEstado: 'En Bordado', backEstado: null },
    { titulo: 'En Bordado', subtitle: 'En proceso', color: '#7C3AED', dropEstado: 'En Bordado', grupos: enProgresoLotes, forwardEstado: 'Bordado Finalizado', backEstado: 'Confección Finalizada' },
    { titulo: 'Finalizado', subtitle: 'Completados', color: '#10B981', dropEstado: 'Bordado Finalizado', grupos: terminadosLotes, forwardEstado: null, backEstado: 'En Bordado' },
  ];

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
      {modalNombre && <ModalNombre />}
      {mensaje && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', padding: '1rem 1.5rem', borderRadius: '8px', backgroundColor: mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)', color: 'white', fontWeight: '500', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', zIndex: 10000 }}>
          {mensaje.texto}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ color: '#FACC15', marginBottom: '0.25rem' }}>Mesa de Bordado</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Lotes por escuela y grado</p>
        </div>
        <button onClick={cargarDatos} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.75rem 1.25rem', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={18} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Cargando trabajos de bordado...</div>
      ) : (
        <>
          {isMobile ? (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--bg-sidebar)', padding: '0.5rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                {columnas.map((col, idx) => (
                  <button key={col.titulo} onClick={() => setActiveTab(idx)}
                    style={{ flex: 1, padding: '0.75rem 0.5rem', borderRadius: '10px', border: 'none', cursor: 'pointer', background: activeTab === idx ? col.color : 'transparent', color: activeTab === idx ? 'white' : 'var(--text-muted)', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span>{col.titulo}</span>
                    <span style={{ background: activeTab === idx ? 'rgba(255,255,255,0.3)' : col.color + '40', color: activeTab === idx ? 'white' : col.color, borderRadius: '10px', padding: '1px 8px', fontSize: '0.8rem' }}>{col.grupos.length}</span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {columnas[activeTab].grupos.length === 0 ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOverCol(columnas[activeTab].dropEstado); }}
                    onDragLeave={() => setDragOverCol(null)}
                    onDrop={(e) => { e.preventDefault(); if (draggedGrupoRef.current) { cambiarEstadoLote(draggedGrupoRef.current.pedidos.filter(p => p.estado !== columnas[activeTab].dropEstado), columnas[activeTab].dropEstado); draggedGrupoRef.current = null; setDragOverCol(null); } }}
                    style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: dragOverCol === columnas[activeTab].dropEstado ? columnas[activeTab].color + '15' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: dragOverCol === columnas[activeTab].dropEstado ? '2px dashed ' + columnas[activeTab].color : '1px dashed var(--border-color)', transition: 'all 0.15s' }}>
                    Sin lotes
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOverCol(columnas[activeTab].dropEstado); }}
                    onDragLeave={() => setDragOverCol(null)}
                    onDrop={(e) => { e.preventDefault(); if (draggedGrupoRef.current) { cambiarEstadoLote(draggedGrupoRef.current.pedidos.filter(p => p.estado !== columnas[activeTab].dropEstado), columnas[activeTab].dropEstado); draggedGrupoRef.current = null; setDragOverCol(null); } }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '4px', borderRadius: '10px', outline: dragOverCol === columnas[activeTab].dropEstado ? '2px dashed ' + columnas[activeTab].color : '2px dashed transparent', transition: 'outline 0.12s' }}>
                    {columnas[activeTab].grupos.map((grupo, i) => <CardLote key={i} grupo={grupo} color={columnas[activeTab].color} forwardEstado={columnas[activeTab].forwardEstado} backEstado={columnas[activeTab].backEstado} colEstado={columnas[activeTab].dropEstado} priorityNum={priorNumMap.get(getLoteKey(grupo))} />)}
                  </div>
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
                        <span style={{ marginLeft: '0.5rem', background: col.color + '30', color: col.color, padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>{col.grupos.length}</span>
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{col.subtitle}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {col.grupos.length === 0 ? (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.dropEstado); }}
                        onDragLeave={() => setDragOverCol(null)}
                        onDrop={(e) => { e.preventDefault(); if (draggedGrupoRef.current) { cambiarEstadoLote(draggedGrupoRef.current.pedidos.filter(p => p.estado !== col.dropEstado), col.dropEstado); draggedGrupoRef.current = null; setDragOverCol(null); } }}
                        style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: dragOverCol === col.dropEstado ? col.color + '15' : 'rgba(255,255,255,0.02)', borderRadius: '8px', border: dragOverCol === col.dropEstado ? '2px dashed ' + col.color : '1px dashed var(--border-color)', transition: 'all 0.15s' }}>
                        Sin lotes
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.dropEstado); }}
                        onDragLeave={() => setDragOverCol(null)}
                        onDrop={(e) => { e.preventDefault(); if (draggedGrupoRef.current) { cambiarEstadoLote(draggedGrupoRef.current.pedidos.filter(p => p.estado !== col.dropEstado), col.dropEstado); draggedGrupoRef.current = null; setDragOverCol(null); } }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '4px', borderRadius: '10px', outline: dragOverCol === col.dropEstado ? '2px dashed ' + col.color : '2px dashed transparent', transition: 'outline 0.12s' }}>
                        {col.grupos.map((grupo, i) => <CardLote key={i} grupo={grupo} color={col.color} forwardEstado={col.forwardEstado} backEstado={col.backEstado} colEstado={col.dropEstado} priorityNum={priorNumMap.get(getLoteKey(grupo))} />)}
                      </div>
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

export default Bordado;
