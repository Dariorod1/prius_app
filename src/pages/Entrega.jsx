import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  Truck, CheckCircle, RefreshCw, AlertTriangle,
  Search, X, ChevronDown, ChevronUp, List, LayoutGrid,
} from 'lucide-react';

const ESTADOS_COLA  = ['Bordado Finalizado'];
const ESTADOS_LISTO = ['Listo para Entrega'];
const TODOS_ESTADOS = [...ESTADOS_COLA, ...ESTADOS_LISTO];

// ─── Item row (outside component to avoid remount on re-render) ────────────────
const ItemRow = ({ p, compact, actualizando, onCambiarEstado }) => {
  const isCola  = ESTADOS_COLA.includes(p.estado);
  const isListo = ESTADOS_LISTO.includes(p.estado);
  const enCambio = actualizando === p.id;

  const badge = isCola
    ? { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', text: 'En cola' }
    : { bg: 'rgba(16,185,129,0.15)', color: '#10B981', text: 'Listo' };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: compact ? '0.7rem 0.9rem' : '0.85rem 1rem',
      borderBottom: '1px solid var(--border-color)',
      background: enCambio ? 'rgba(255,255,255,0.03)' : 'transparent',
      transition: 'background 0.2s',
    }}>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.92rem' }}>
            {p.tipo_prenda} {p.talle}
          </span>
          {p.nombre_bordado && (
            <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: '600' }}>
              · {p.nombre_bordado}
            </span>
          )}
          {p.observaciones && (
            <span style={{ fontSize: '0.74rem', color: '#FACC15', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <AlertTriangle size={11} /> {p.observaciones}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          {p.clientes?.nombre || 'Sin nombre'}
          {p.grado ? ' · ' + p.grado : ''}
          {!compact && p.instituciones?.nombre ? ' · ' + p.instituciones.nombre : ''}
        </div>
      </div>

      {/* Estado badge */}
      <div style={{
        padding: '3px 10px', borderRadius: '99px',
        background: badge.bg, color: badge.color,
        fontSize: '0.74rem', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0,
      }}>{badge.text}</div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
        {isCola && (
          <button
            disabled={enCambio}
            onClick={() => onCambiarEstado(p.id, 'Listo para Entrega')}
            title="Marcar listo para entrega"
            style={{
              background: '#10B981', color: 'white', border: 'none',
              borderRadius: '8px', padding: '0.4rem 0.75rem',
              fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer',
              opacity: enCambio ? 0.5 : 1, whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}>
            <CheckCircle size={14} /> Listo
          </button>
        )}
        {isListo && (
          <>
            <button
              disabled={enCambio}
              onClick={() => onCambiarEstado(p.id, 'Entregado')}
              title="Marcar como entregado"
              style={{
                background: 'var(--accent)', color: 'white', border: 'none',
                borderRadius: '8px', padding: '0.4rem 0.75rem',
                fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer',
                opacity: enCambio ? 0.5 : 1, whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}>
              <Truck size={14} /> Entregado
            </button>
            <button
              disabled={enCambio}
              onClick={() => onCambiarEstado(p.id, 'Bordado Finalizado')}
              title="Devolver a cola"
              style={{
                background: 'transparent', color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px', padding: '0.4rem 0.6rem',
                fontSize: '0.74rem', cursor: 'pointer',
                opacity: enCambio ? 0.5 : 1, display: 'flex', alignItems: 'center',
              }}>
              <RefreshCw size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────
const Entrega = () => {
  const [pedidos, setPedidos]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [mensaje, setMensaje]           = useState(null);
  const [vista, setVista]               = useState('institucion'); // 'institucion' | 'lista'
  const [busqueda, setBusqueda]         = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [expandidos, setExpandidos]     = useState(new Set());
  const [actualizando, setActualizando] = useState(null);
  const [isMobile, setIsMobile]         = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab]       = useState(0); // 0=Cola 1=Listo

  const skipRealtimeCountRef = useRef(0);
  const fetchIdRef           = useRef(0);
  const realtimeDebounceRef  = useRef(null);

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
    const { data } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, dni), instituciones(nombre)')
      .in('estado', TODOS_ESTADOS)
      .order('fecha_creacion', { ascending: true });
    if (myId !== fetchIdRef.current) return;
    if (data) setPedidos(data);
    setLoading(false);
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  useEffect(() => {
    const channel = supabase.channel('entrega-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        if (skipRealtimeCountRef.current > 0) { skipRealtimeCountRef.current--; return; }
        clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(cargarDatos, 400);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cargarDatos]);

  const cambiarEstado = useCallback(async (pedidoId, nuevoEstado) => {
    const user = JSON.parse(localStorage.getItem('priusUser'));
    setActualizando(pedidoId);
    skipRealtimeCountRef.current += 1;
    setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, estado: nuevoEstado } : p));
    const { error } = await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', pedidoId);
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al actualizar.' });
      skipRealtimeCountRef.current = 0;
      cargarDatos();
    } else {
      await supabase.from('pedido_estado_log').insert([{
        pedido_id: pedidoId,
        estado: nuevoEstado,
        empleado_username: user?.username || 'Desconocido',
      }]);
      setMensaje({ tipo: 'success', texto: 'Estado actualizado.' });
    }
    setActualizando(null);
  }, [cargarDatos]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const toggleExpand = (key) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const agruparPorInstitucion = () => {
    const map = {};
    pedidos.forEach(p => {
      const key = p.institucion_id || '__sin_escuela__';
      if (!map[key]) map[key] = { key, nombre: p.instituciones?.nombre || 'Sin escuela', cola: [], listo: [] };
      if (ESTADOS_COLA.includes(p.estado))       map[key].cola.push(p);
      else if (ESTADOS_LISTO.includes(p.estado)) map[key].listo.push(p);
    });
    // Schools with pending items first
    return Object.values(map).sort((a, b) => {
      const pA = a.cola.length + a.listo.length;
      const pB = b.cola.length + b.listo.length;
      if (pA !== pB) return pB - pA;
      return a.nombre.localeCompare(b.nombre);
    });
  };

  const pedidosFiltrados = pedidos.filter(p => {
    const q = busqueda.toLowerCase();
    const matchQ = !q
      || p.clientes?.nombre?.toLowerCase().includes(q)
      || p.clientes?.dni?.toLowerCase().includes(q)
      || p.instituciones?.nombre?.toLowerCase().includes(q)
      || p.grado?.toLowerCase().includes(q)
      || p.nombre_bordado?.toLowerCase().includes(q)
      || p.tipo_prenda?.toLowerCase().includes(q)
      || p.talle?.toLowerCase().includes(q);
    const matchE = !filtroEstado || p.estado === filtroEstado;
    return matchQ && matchE;
  });

  const totalCola  = pedidos.filter(p => ESTADOS_COLA.includes(p.estado)).length;
  const totalListo = pedidos.filter(p => ESTADOS_LISTO.includes(p.estado)).length;
  const grupos     = agruparPorInstitucion();

  // ── Render ────────────────────────────────────────────────────────────────────
  const tabColors = ['#F59E0B', '#10B981'];

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div style={{ color: 'var(--text-muted)' }}>Cargando...</div>
    </div>
  );

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '3rem' }}>

      {/* Toast */}
      {mensaje && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          padding: '1rem 2rem', borderRadius: '8px',
          backgroundColor: mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)',
          color: 'white', fontWeight: '500',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', zIndex: 10000,
        }}>{mensaje.texto}</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Truck size={26} style={{ color: 'var(--accent)' }} />
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)' }}>Entrega</h1>
          </div>
          <div style={{ marginTop: '0.4rem', display: 'flex', gap: '1rem', fontSize: '0.82rem' }}>
            <span style={{ color: '#F59E0B', fontWeight: '600' }}>{totalCola} en cola</span>
            <span style={{ color: '#10B981', fontWeight: '600' }}>{totalListo} listos</span>
          </div>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
          {[
            { id: 'institucion', label: 'Por escuela', Icon: LayoutGrid },
            { id: 'lista',       label: 'Lista',       Icon: List },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setVista(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '0.55rem 1rem', border: 'none',
                background: vista === id ? 'rgba(124,58,237,0.3)' : 'transparent',
                color: vista === id ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: vista === id ? '700' : '500',
                fontSize: '0.85rem', cursor: 'pointer',
              }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Vista por institución ────────────────────────────────────────────── */}
      {vista === 'institucion' && (
        <>
          {/* Mobile: tabs per estado */}
          {isMobile && (
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              {['En cola', 'Listos'].map((name, i) => {
                const count = [totalCola, totalListo][i];
                return (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    style={{
                      flex: 1, padding: '0.55rem 0.4rem',
                      borderRadius: '8px', border: 'none',
                      background: activeTab === i ? tabColors[i] + '22' : 'transparent',
                      color: activeTab === i ? tabColors[i] : 'var(--text-muted)',
                      fontWeight: activeTab === i ? '700' : '500',
                      fontSize: '0.8rem', cursor: 'pointer',
                      borderBottom: activeTab === i ? '2px solid ' + tabColors[i] : '2px solid transparent',
                    }}>
                    {name} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {grupos.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 1rem', fontSize: '0.9rem' }}>
              No hay prendas en entrega.
            </div>
          ) : (
            grupos.map(g => {
              const itemsMobile = isMobile ? (activeTab === 0 ? g.cola : g.listo) : [];
              if (isMobile && itemsMobile.length === 0) return null;

              const expanded = expandidos.has(g.key);
              const pending  = g.cola.length + g.listo.length;

              return (
                <div key={g.key} style={{ marginBottom: '0.85rem', background: 'var(--bg-sidebar)', borderRadius: '14px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  {/* Card header — desktop: clickable expand / mobile: always open */}
                  <button
                    onClick={isMobile ? undefined : () => toggleExpand(g.key)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '1rem',
                      padding: '0.9rem 1.1rem', background: 'var(--bg-dark)', border: 'none',
                      cursor: isMobile ? 'default' : 'pointer', textAlign: 'left',
                      borderBottom: (expanded || isMobile) ? '1px solid var(--border-color)' : 'none',
                    }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>{g.nombre}</div>
                      {!isMobile && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {pending + ' pendiente' + (pending !== 1 ? 's' : '')}
                        </div>
                      )}
                    </div>
                    {/* Estado pills */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {g.cola.length > 0 && (
                        <span style={{ padding: '3px 10px', borderRadius: '99px', background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: '0.78rem', fontWeight: '700' }}>
                          Cola: {g.cola.length}
                        </span>
                      )}
                      {g.listo.length > 0 && (
                        <span style={{ padding: '3px 10px', borderRadius: '99px', background: 'rgba(16,185,129,0.15)', color: '#10B981', fontSize: '0.78rem', fontWeight: '700' }}>
                          Listo: {g.listo.length}
                        </span>
                      )}
                      {!isMobile && (
                        <span style={{ color: 'var(--text-muted)', marginLeft: '0.2rem', display: 'flex' }}>
                          {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Items list */}
                  {(expanded || isMobile) && (
                    <div>
                      {(isMobile ? itemsMobile : [...g.cola, ...g.listo]).map(p => (
                        <ItemRow key={p.id} p={p} compact actualizando={actualizando} onCambiarEstado={cambiarEstado} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      {/* ── Vista lista ──────────────────────────────────────────────────────── */}
      {vista === 'lista' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem 0.9rem' }}>
              <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, escuela, talle..."
                style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: '0.9rem', width: '100%' }}
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                  <X size={15} />
                </button>
              )}
            </div>
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem 0.9rem', color: 'var(--text-main)', fontSize: '0.88rem', cursor: 'pointer' }}>
              <option value="">Todos los estados</option>
              <option value="Bordado Finalizado">En cola</option>
              <option value="Listo para Entrega">Listos</option>
            </select>
          </div>

          {pedidosFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1rem', fontSize: '0.9rem' }}>
              {busqueda || filtroEstado ? 'No se encontraron resultados.' : 'No hay prendas en entrega.'}
            </div>
          ) : (
            <div style={{ background: 'var(--bg-sidebar)', borderRadius: '14px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              {pedidosFiltrados.map(p => (
                <ItemRow key={p.id} p={p} compact={false} actualizando={actualizando} onCambiarEstado={cambiarEstado} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Entrega;
