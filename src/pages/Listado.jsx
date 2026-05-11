import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Printer, X } from 'lucide-react';

const ESTADOS = [
  'Pendiente', 'Autorizado', 'En Corte', 'Corte Finalizado',
  'En Confección', 'Confección Finalizada', 'En Bordado', 'Bordado Finalizado', 'Entregado'
];

const ESTADO_COLORS = {
  'Pendiente':              '#CA8A04',
  'Autorizado':             '#2563EB',
  'En Corte':               '#7C3AED',
  'Corte Finalizado':       '#059669',
  'En Confección':          '#EA580C',
  'Confección Finalizada':  '#10B981',
  'En Bordado':             '#BE185D',
  'Bordado Finalizado':     '#6D28D9',
  'Entregado':              '#059669',
};

const Listado = () => {
  const [pedidos, setPedidos] = useState([]);
  const [instituciones, setInstituciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroInstitucionId, setFiltroInstitucionId] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    supabase
      .from('instituciones')
      .select('*')
      .order('nombre')
      .then(({ data }) => { if (data) setInstituciones(data); });
  }, []);

  useEffect(() => {
    const fetchPedidos = async () => {
      setLoading(true);
      let query = supabase
        .from('pedidos')
        .select('*, clientes(nombre, dni), instituciones(nombre)')
        .order('fecha_creacion', { ascending: false });

      if (filtroInstitucionId) query = query.eq('institucion_id', filtroInstitucionId);
      if (filtroEstado)        query = query.eq('estado', filtroEstado);

      const { data } = await query;
      if (data) setPedidos(data);
      setLoading(false);
    };
    fetchPedidos();
  }, [filtroInstitucionId, filtroEstado]);

  const institucionNombre = instituciones.find(i => i.id === filtroInstitucionId)?.nombre || '';

  const resumenFiltros = [
    institucionNombre && `Escuela: ${institucionNombre}`,
    filtroEstado      && `Estado: ${filtroEstado}`,
  ].filter(Boolean).join(' — ') || 'Todos los pedidos';

  return (
    <div>
      {/* ============================================================
          CAPA DE IMPRESIÓN — Solo visible al hacer window.print()
          Estilos controlados vía @media print en index.css
          ============================================================ */}
      <div className="print-only">
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '0.15em', margin: 0 }}>PRIUS</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '4px 0 0' }}>
            Sistema de Gestión de Producción Textil
          </p>
          <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: '4px 0 0' }}>
            Listado generado el{' '}
            {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
            {' — '}{resumenFiltros}
          </p>
        </div>
        <hr style={{ borderColor: '#CBD5E1', marginBottom: '1rem' }} />

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #CBD5E1' }}>
              {['#', 'Cliente', 'DNI', 'Institución', 'Prenda / Talle', 'Estado', 'Total', 'Pagado', 'Fecha'].map(col => (
                <th key={col} style={{ padding: '0.5rem 0.6rem', textAlign: col === 'Total' || col === 'Pagado' ? 'right' : 'left', color: '#334155' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p, idx) => {
              const total  = parseFloat(p.precio_total);
              const pagado = parseFloat(p.monto_pagado);
              const pct    = total > 0 ? Math.round((pagado / total) * 100) : 0;
              const colorPct = pct >= 100 ? '#059669' : pct >= 50 ? '#2563EB' : '#DC2626';
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #E2E8F0', background: idx % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#94A3B8' }}>{idx + 1}</td>
                  <td style={{ padding: '0.45rem 0.6rem', fontWeight: '600', color: '#0F172A' }}>{p.clientes?.nombre}</td>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#64748B' }}>{p.clientes?.dni}</td>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#0F172A' }}>{p.instituciones?.nombre}</td>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#0F172A' }}>
                    {p.tipo_prenda} / {p.talle}
                    {p.nombre_bordado ? ` (${p.nombre_bordado})` : ''}
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem' }}>
                    <span style={{
                      padding: '2px 6px', borderRadius: '3px', fontSize: '0.75rem', fontWeight: '600',
                      border: `1px solid ${ESTADO_COLORS[p.estado] || '#94A3B8'}`,
                      color: ESTADO_COLORS[p.estado] || '#64748B',
                    }}>
                      {p.estado}
                    </span>
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#0F172A' }}>${total.toFixed(2)}</td>
                  <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: '700', color: colorPct }}>
                    ${pagado.toFixed(2)} ({pct}%)
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#64748B' }}>
                    {new Date(p.fecha_creacion).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#94A3B8', textAlign: 'right' }}>
          Total de pedidos: <strong>{pedidos.length}</strong>
        </div>
      </div>

      {/* ============================================================
          VISTA DE PANTALLA — Oculta al imprimir
          ============================================================ */}
      <div className="no-print">
        <h1 style={{ marginBottom: '0.25rem' }}>Listado de Pedidos</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Filtrá por escuela o estado y exportá el resultado como PDF.
        </p>

        {/* Filtros */}
        <div style={{
          display: 'flex', flexDirection: isMobile ? 'column' : 'row',
          gap: '1rem', marginBottom: '1.25rem',
          padding: '1rem', background: 'var(--bg-sidebar)',
          borderRadius: '8px', border: '1px solid var(--border-color)'
        }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Escuela
            </label>
            <select
              className="form-control"
              value={filtroInstitucionId}
              onChange={e => setFiltroInstitucionId(e.target.value)}
            >
              <option value="">Todas las escuelas</option>
              {instituciones.map(i => (
                <option key={i.id} value={i.id}>{i.nombre}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Estado
            </label>
            <select
              className="form-control"
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}>
            {(filtroInstitucionId || filtroEstado) && (
              <button
                title="Limpiar filtros"
                style={{
                  minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                  borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer'
                }}
                onClick={() => { setFiltroInstitucionId(''); setFiltroEstado(''); }}
              >
                <X size={16} />
              </button>
            )}
            <button
              className="btn btn-primary"
              style={{
                minHeight: '44px', padding: '0 1.25rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                opacity: pedidos.length === 0 ? 0.5 : 1
              }}
              onClick={() => window.print()}
              disabled={loading || pedidos.length === 0}
            >
              <Printer size={16} />
              {isMobile ? 'PDF' : 'Imprimir / Exportar PDF'}
            </button>
          </div>
        </div>

        {/* Contador */}
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          {loading
            ? 'Cargando...'
            : `${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''} encontrado${pedidos.length !== 1 ? 's' : ''}`
          }
        </p>

        {/* MOBILE: Cards apiladas */}
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
            ) : pedidos.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No hay pedidos con esos filtros.
              </div>
            ) : pedidos.map((p) => {
              const total  = parseFloat(p.precio_total);
              const pagado = parseFloat(p.monto_pagado);
              const pct    = total > 0 ? Math.round((pagado / total) * 100) : 0;
              const colorPct = pct >= 100 ? 'var(--accent)' : pct >= 50 ? '#60A5FA' : 'var(--danger)';
              return (
                <div key={p.id} style={{
                  background: 'var(--bg-sidebar)', borderRadius: '8px',
                  border: '1px solid var(--border-color)', padding: '1rem',
                  display: 'flex', flexDirection: 'column', gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '1rem' }}>{p.clientes?.nombre}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DNI: {p.clientes?.dni}</div>
                    </div>
                    <span style={{
                      padding: '3px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: '600', flexShrink: 0,
                      background: 'rgba(255,255,255,0.05)',
                      color: ESTADO_COLORS[p.estado] || '#94A3B8',
                      border: `1px solid ${ESTADO_COLORS[p.estado] || '#334155'}40`
                    }}>
                      {p.estado}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.instituciones?.nombre}</div>
                  <div style={{ fontSize: '0.9rem' }}>{p.tipo_prenda} — Talle: {p.talle}</div>
                  {p.nombre_bordado && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>✎ {p.nombre_bordado}</div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pago</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: colorPct }}>
                      ${pagado.toFixed(0)} / ${total.toFixed(0)} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                    <div style={{
                      width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: '2px',
                      background: pct >= 100 ? 'var(--accent)' : 'var(--primary)'
                    }} />
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(p.fecha_creacion).toLocaleDateString('es-AR')}
                  </div>
                </div>
              );
            })}
          </div>

        ) : (
          /* DESKTOP: Tabla */
          <div style={{ background: 'var(--bg-sidebar)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                  {['#', 'Cliente', 'Institución', 'Prenda', 'Estado', 'Pago', 'Fecha'].map(col => (
                    <th key={col} style={{
                      padding: '0.75rem 1rem', textAlign: 'left',
                      fontSize: '0.75rem', color: 'var(--text-muted)',
                      fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Cargando pedidos...
                    </td>
                  </tr>
                ) : pedidos.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No hay pedidos con esos filtros.
                    </td>
                  </tr>
                ) : pedidos.map((p, idx) => {
                  const total  = parseFloat(p.precio_total);
                  const pagado = parseFloat(p.monto_pagado);
                  const pct    = total > 0 ? Math.round((pagado / total) * 100) : 0;
                  const colorPct = pct >= 100 ? 'var(--accent)' : pct >= 50 ? '#60A5FA' : 'var(--danger)';
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: '600' }}>{p.clientes?.nombre}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DNI: {p.clientes?.dni}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }}>{p.instituciones?.nombre}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }}>
                        {p.tipo_prenda} / {p.talle}
                        {p.nombre_bordado && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>✎ {p.nombre_bordado}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600',
                          background: `${ESTADO_COLORS[p.estado]}20` || 'rgba(255,255,255,0.05)',
                          color: ESTADO_COLORS[p.estado] || '#94A3B8'
                        }}>
                          {p.estado}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.9rem', color: colorPct }}>{pct}%</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ${pagado.toFixed(0)} / ${total.toFixed(0)}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(p.fecha_creacion).toLocaleDateString('es-AR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Listado;
