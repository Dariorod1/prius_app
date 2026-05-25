import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Shirt, CheckCircle, PlayCircle, RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react';

const ESTADOS_COLA        = ['Corte Finalizado'];
const ESTADOS_EN_PROGRESO = ['En Confección'];
const ESTADOS_TERMINADO   = ['Confección Finalizada'];

const PRIORIDAD_ORDEN  = { urgente: 0, alta: 1, media: 2, baja: 3, ninguna: 4 };
const PRIORIDAD_COLORS = { urgente: '#EF4444', alta: '#10B981', media: '#FACC15', baja: '#94A3B8', ninguna: 'transparent' };
const getLoteKey = (g) => g.grado
  ? (g.pedidos[0]?.institucion_id + '|' + g.grado + '|' + g.tipo_prenda)
  : ('ind|' + g.pedidos[0]?.id);

const Confeccion = () => {
  const [lotes, setLotes] = useState([]);
  const [pedidosTodos, setPedidosTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actualizando, setActualizando] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [loteAbierto, setLoteAbierto] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState(0);
  const skipRealtimeCountRef = useRef(0);
  const fetchIdRef = useRef(0);
  const realtimeDebounceRef = useRef(null);
  const draggedGrupoRef = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (mensaje) { const t = setTimeout(() => setMensaje(null), 3500); return () => clearTimeout(t); }
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
    if (myId !== fetchIdRef.current) return; // fetch obsoleto, ignorar
    if (lotesRes.data) setLotes(lotesRes.data);
    if (pedidosRes.data) setPedidosTodos(pedidosRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  useEffect(() => {
    const channel = supabase.channel('confeccion-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        if (skipRealtimeCountRef.current > 0) { skipRealtimeCountRef.current--; return; }
        // Debounce para cambios externos (ej: Bordado moviendo items)
        clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(cargarDatos, 400);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cargarDatos]);

  const cambiarEstadoLote = async (pedidos, nuevoEstado) => {
    const user = JSON.parse(localStorage.getItem('priusUser'));
    const ids = pedidos.map(p => p.id);
    skipRealtimeCountRef.current += ids.length;
    setPedidosTodos(prev => prev.map(p => ids.includes(p.id) ? { ...p, estado: nuevoEstado } : p));
    const { error } = await supabase.from('pedidos').update({ estado: nuevoEstado }).in('id', ids);
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al mover el lote.' });
      skipRealtimeCountRef.current = 0;
      cargarDatos();
    } else {
      await supabase.from('pedido_estado_log').insert(ids.map(id => ({ pedido_id: id, estado: nuevoEstado, empleado_username: user?.username || 'Desconocido' })));
      setMensaje({ tipo: 'success', texto: 'Lote movido a "' + nuevoEstado + '"' });
    }
  };

  const agruparPorLote = (pedidos) => {
    const grupos = {};
    pedidos.forEach(p => {
      if (!p.grado) { grupos['individual_' + p.id] = { pedidos: [p], tipo_prenda: p.tipo_prenda, institucion: p.instituciones?.nombre, grado: null, lote: null, prioridad: 'ninguna' }; return; }
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

  const colaLotes = agruparPorLote(pedidosTodos.filter(p => ESTADOS_COLA.includes(p.estado)));
  const enProgresoLotes = (() => {
    const pedidos = pedidosTodos.filter(p => ESTADOS_EN_PROGRESO.includes(p.estado) || ESTADOS_TERMINADO.includes(p.estado));
    return agruparPorLote(pedidos).filter(g => g.pedidos.some(p => ESTADOS_EN_PROGRESO.includes(p.estado)));
  })();
  const terminadosLotes = (() => {
    const pedidos = pedidosTodos.filter(p => ESTADOS_TERMINADO.includes(p.estado));
    return agruparPorLote(pedidos).filter(g => {
      if (!g.grado) return true;
      return !pedidosTodos.some(p => p.institucion_id === g.pedidos[0]?.institucion_id && p.grado === g.grado && p.tipo_prenda === g.tipo_prenda && ESTADOS_EN_PROGRESO.includes(p.estado));
    });
  })();

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

  if (loteAbierto) {
    const { grupo } = loteAbierto;
    const pedidosDelGrupo = grupo.grado
      ? pedidosTodos.filter(p => p.institucion_id === grupo.pedidos[0]?.institucion_id && p.grado === grupo.grado && p.tipo_prenda === grupo.tipo_prenda)
      : grupo.pedidos;
    const loteInfo = grupo.lote;
    const imagen = grupo.tipo_prenda === 'Chomba' ? loteInfo?.imagen_chomba_url : loteInfo?.imagen_campera_url;

    const porConfeccionar = pedidosDelGrupo.filter(p => ESTADOS_COLA.includes(p.estado));
    const enConfeccion    = pedidosDelGrupo.filter(p => ESTADOS_EN_PROGRESO.includes(p.estado));
    const finalizados     = pedidosDelGrupo.filter(p => ESTADOS_TERMINADO.includes(p.estado));
    const total = pedidosDelGrupo.length;
    const pct   = total > 0 ? Math.round((finalizados.length / total) * 100) : 0;

    const talleOrden = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2', '4', '6', '8', '10', '12', '14', '16'];
    const sortTalle  = (arr) => arr.sort((a, b) => { const ia = talleOrden.indexOf(a[0]); const ib = talleOrden.indexOf(b[0]); return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib); });
    const normales    = pedidosDelGrupo.filter(p => !p.observaciones);
    const excepciones = pedidosDelGrupo.filter(p => !!p.observaciones);
    const conteoNormal = {};
    normales.forEach(p => { conteoNormal[p.talle] = (conteoNormal[p.talle] || 0) + 1; });
    const normalesOrdenados = sortTalle(Object.entries(conteoNormal));
    const conteoExcep = {};
    excepciones.forEach(p => { const key = p.talle + '|||' + p.observaciones; if (!conteoExcep[key]) conteoExcep[key] = { talle: p.talle, obs: p.observaciones, cant: 0 }; conteoExcep[key].cant++; });
    const excepcionesOrdenadas = Object.values(conteoExcep).sort((a, b) => { const ia = talleOrden.indexOf(a.talle); const ib = talleOrden.indexOf(b.talle); return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib); });

    return (
      <div style={{ maxWidth: '520px', margin: '0 auto', paddingBottom: '2rem' }}>
        {mensaje && (<div style={{ position: 'fixed', bottom: '20px', right: '20px', padding: '1rem 2rem', borderRadius: '8px', backgroundColor: mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)', color: 'white', fontWeight: '500', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', zIndex: 10000 }}>{mensaje.texto}</div>)}

        <button onClick={() => setLoteAbierto(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.85rem', padding: 0 }}>
          <ArrowLeft size={16} /> Volver
        </button>

        {imagen ? (
          <div style={{ width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: '1.25rem', background: 'var(--bg-dark)', maxHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={imagen} alt={grupo.tipo_prenda} style={{ width: '100%', maxHeight: '260px', objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={{ width: '100%', height: '180px', borderRadius: '16px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <Shirt size={52} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
          </div>
        )}

        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ margin: '0 0 4px', color: 'var(--text-main)', fontSize: '1.5rem', fontWeight: '800' }}>{grupo.tipo_prenda}</h2>
          <div style={{ fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: '600' }}>{grupo.institucion}</div>
          {grupo.grado && <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '2px' }}>{grupo.grado}</div>}
          <div style={{ marginTop: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
              <span>{finalizados.length} de {total} prendas confeccionadas</span>
              <span style={{ fontWeight: '600', color: pct === 100 ? '#10B981' : 'var(--text-muted)' }}>{pct}%</span>
            </div>
            <div style={{ height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}>
              <div style={{ width: pct + '%', height: '100%', background: pct === 100 ? '#10B981' : '#7C3AED', borderRadius: '4px', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        <div style={{ padding: '1.1rem', background: 'var(--bg-dark)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>Talles a confeccionar</div>
          {normalesOrdenados.length > 0 && (
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              {normalesOrdenados.map(([talle, cant]) => (
                <div key={talle} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.65rem 1.1rem', borderRadius: '10px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', minWidth: '62px' }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--accent)', lineHeight: 1 }}>{cant}</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', marginTop: '3px' }}>{talle}</span>
                </div>
              ))}
            </div>
          )}
          {excepcionesOrdenadas.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '1rem 0 0.6rem' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                <span style={{ fontSize: '0.72rem', color: '#FACC15', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}><AlertTriangle size={12} /> Con excepcion</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {excepcionesOrdenadas.map((e) => (
                  <div key={e.talle + e.obs} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.6rem 0.9rem', borderRadius: '10px', background: 'rgba(250,204,21,0.07)', border: '1px solid rgba(250,204,21,0.3)', minWidth: '62px' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#FACC15', lineHeight: 1 }}>{e.cant}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)', marginTop: '3px' }}>{e.talle}</span>
                    <span style={{ fontSize: '0.68rem', color: '#FACC15', marginTop: '4px', textAlign: 'center', maxWidth: '80px', lineHeight: 1.3 }}>{e.obs}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {porConfeccionar.length > 0 && (
            <button disabled={actualizando !== null} onClick={async () => { await cambiarEstadoLote(porConfeccionar, 'En Confección'); setLoteAbierto(null); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#7C3AED', color: 'white', border: 'none', borderRadius: '14px', padding: '1.1rem', fontSize: '1.1rem', fontWeight: '700', cursor: 'pointer', minHeight: '60px', opacity: actualizando !== null ? 0.6 : 1, boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}>
              <PlayCircle size={22} /> Iniciar Confección · {porConfeccionar.length} prendas
            </button>
          )}
          {enConfeccion.length > 0 && (
            <button disabled={actualizando !== null} onClick={async () => { await cambiarEstadoLote(enConfeccion, 'Confección Finalizada'); setLoteAbierto(null); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#10B981', color: 'white', border: 'none', borderRadius: '14px', padding: '1.1rem', fontSize: '1.1rem', fontWeight: '700', cursor: 'pointer', minHeight: '60px', opacity: actualizando !== null ? 0.6 : 1, boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
              <CheckCircle size={22} /> Finalizar Confección · {enConfeccion.length} prendas
            </button>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            {enConfeccion.length > 0 && (
              <button onClick={() => cambiarEstadoLote(enConfeccion, 'Corte Finalizado')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.65rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                <RefreshCw size={13} /> Devolver a cola
              </button>
            )}
            {finalizados.length === total && total > 0 && (
              <button onClick={() => cambiarEstadoLote(finalizados, 'En Confección')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.65rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                <RefreshCw size={13} /> Reabrir confección
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const CardLote = ({ grupo, color, forwardEstado, backEstado, priorityNum }) => {
    const loteInfo = grupo.lote;
    const imagen = grupo.tipo_prenda === 'Chomba' ? loteInfo?.imagen_chomba_url : loteInfo?.imagen_campera_url;
    const prioridadColor = grupo.prioridad && grupo.prioridad !== 'ninguna' ? PRIORIDAD_COLORS[grupo.prioridad] : 'transparent';
    const cantidad = grupo.pedidos.length;
    const esIndividual = !grupo.grado;
    const cardRef = useRef(null);
    const touchStartX = useRef(0);
    const touchDeltaX = useRef(0);
    const swipeThreshold = 80;

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
        if (delta > swipeThreshold && forwardEstado) {
          cardRef.current.style.background = 'rgba(16,185,129,0.25)';
          cardRef.current.style.borderColor = '#10B981';
        } else if (delta < -swipeThreshold && backEstado) {
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
        if (delta > swipeThreshold && forwardEstado) {
          cardRef.current.style.transform = 'translateX(110%) rotate(4deg)';
          cardRef.current.style.opacity = '0';
          setTimeout(() => cambiarEstadoLote(grupo.pedidos, forwardEstado), 300);
        } else if (delta < -swipeThreshold && backEstado) {
          cardRef.current.style.transform = 'translateX(-110%) rotate(-4deg)';
          cardRef.current.style.opacity = '0';
          setTimeout(() => cambiarEstadoLote(grupo.pedidos, backEstado), 300);
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
            <Shirt size={36} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          </div>
        )}
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1.05rem' }}>{grupo.tipo_prenda}</span>
            <span style={{ background: color + '30', color: color, fontSize: '0.8rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>{cantidad}</span>
            {priorityNum && (
              <span style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '900', background: prioridadColor === 'transparent' ? 'rgba(255,255,255,0.08)' : prioridadColor + '20', color: prioridadColor === 'transparent' ? 'var(--text-muted)' : prioridadColor, letterSpacing: '-0.5px' }}>
                {'#' + priorityNum}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{grupo.institucion}</div>
          {grupo.grado && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{grupo.grado}</div>}
          {grupo.grado && grupo.pedidos.some(p => ESTADOS_TERMINADO.includes(p.estado)) && (
            <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '4px', fontWeight: '600' }}>{grupo.pedidos.filter(p => ESTADOS_TERMINADO.includes(p.estado)).length}/{cantidad} finalizadas</div>
          )}
          {esIndividual && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{grupo.pedidos[0]?.clientes?.nombre} — T: {grupo.pedidos[0]?.talle}</div>}
          {isMobile && !esIndividual && (
            <div style={{ marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem' }}>
              {backEstado && <span>← devolver</span>}
              {forwardEstado && <span style={{ marginLeft: 'auto' }}>avanzar →</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  const columnas = [
    { titulo: 'Cola',          subtitle: 'Corte listo, esperando confección', color: '#3B82F6', dropEstado: 'Corte Finalizado',      grupos: colaLotes,       forwardEstado: 'En Confección',        backEstado: null },
    { titulo: 'En Confección', subtitle: 'En proceso ahora',                  color: '#7C3AED', dropEstado: 'En Confección',        grupos: enProgresoLotes, forwardEstado: 'Confección Finalizada', backEstado: 'Corte Finalizado' },
    { titulo: 'Finalizada',    subtitle: 'Confección terminada',              color: '#10B981', dropEstado: 'Confección Finalizada', grupos: terminadosLotes, forwardEstado: null,                    backEstado: 'En Confección' },
  ];

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
      {mensaje && (<div style={{ position: 'fixed', bottom: '20px', right: '20px', padding: '1rem 2rem', borderRadius: '8px', backgroundColor: mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)', color: 'white', fontWeight: '500', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', zIndex: 10000 }}>{mensaje.texto}</div>)}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ color: 'var(--primary)', marginBottom: '0.25rem' }}>Mesa de Confección</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Lotes agrupados por escuela y prenda</p>
        </div>
        <button onClick={cargarDatos} style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 1rem', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                  <button key={col.titulo} onClick={() => setActiveTab(idx)}
                    style={{ flex: 1, padding: '0.6rem 0.25rem', borderRadius: '7px', border: 'none', cursor: 'pointer', background: activeTab === idx ? col.color : 'transparent', color: activeTab === idx ? 'white' : 'var(--text-muted)', fontWeight: activeTab === idx ? 'bold' : 'normal', fontSize: '0.75rem', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <span>{col.titulo}</span>
                    <span style={{ background: activeTab === idx ? 'rgba(255,255,255,0.3)' : col.color + '40', color: activeTab === idx ? 'white' : col.color, borderRadius: '10px', padding: '1px 6px', fontSize: '0.7rem' }}>{col.grupos.length}</span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {columnas[activeTab].grupos.length === 0 ? (
                  <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>Sin lotes en esta etapa</div>
                ) : (
                  columnas[activeTab].grupos.map((grupo, i) => <CardLote key={i} grupo={grupo} color={columnas[activeTab].color} forwardEstado={columnas[activeTab].forwardEstado} backEstado={columnas[activeTab].backEstado} priorityNum={priorNumMap.get(getLoteKey(grupo))} />)
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
                      <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>{col.titulo}<span style={{ marginLeft: '0.5rem', background: col.color + '30', color: col.color, padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>{col.grupos.length}</span></h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{col.subtitle}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {col.grupos.length === 0 ? (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.dropEstado); }}
                        onDragLeave={() => setDragOverCol(null)}
                        onDrop={(e) => { e.preventDefault(); if (draggedGrupoRef.current) { cambiarEstadoLote(draggedGrupoRef.current.pedidos, col.dropEstado); draggedGrupoRef.current = null; setDragOverCol(null); } }}
                        style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: dragOverCol === col.dropEstado ? col.color + '15' : 'rgba(255,255,255,0.02)', borderRadius: '8px', border: dragOverCol === col.dropEstado ? '2px dashed ' + col.color : '1px dashed var(--border-color)', transition: 'all 0.15s' }}>Sin lotes</div>
                    ) : (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.dropEstado); }}
                        onDragLeave={() => setDragOverCol(null)}
                        onDrop={(e) => { e.preventDefault(); if (draggedGrupoRef.current) { cambiarEstadoLote(draggedGrupoRef.current.pedidos, col.dropEstado); draggedGrupoRef.current = null; setDragOverCol(null); } }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '4px', borderRadius: '10px', outline: dragOverCol === col.dropEstado ? '2px dashed ' + col.color : '2px dashed transparent', transition: 'outline 0.12s' }}>
                        {col.grupos.map((grupo, i) => <CardLote key={i} grupo={grupo} color={col.color} forwardEstado={col.forwardEstado} backEstado={col.backEstado} priorityNum={priorNumMap.get(getLoteKey(grupo))} />)}
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

export default Confeccion;
