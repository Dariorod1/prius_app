import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Printer, X, Pen } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  const generarPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // — Encabezado —
    doc.setFillColor(15, 23, 42); // --bg-dark
    doc.rect(0, 0, 297, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('PRIUS', 148.5, 12, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // --text-muted
    doc.text('Sistema de Gestión de Producción Textil', 148.5, 18, { align: 'center' });
    doc.text(
      `Generado el ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}  ·  ${resumenFiltros}`,
      148.5, 23, { align: 'center' }
    );

    // — Tabla —
    autoTable(doc, {
      startY: 32,
      head: [['#', 'Cliente', 'DNI', 'Institución', 'Prenda / Talle', 'Estado', 'Total', 'Pagado', 'Fecha']],
      body: pedidos.map((p, i) => {
        const total  = parseFloat(p.precio_total);
        const pagado = parseFloat(p.monto_pagado);
        const pct    = total > 0 ? Math.round((pagado / total) * 100) : 0;
        return [
          i + 1,
          p.clientes?.nombre || '-',
          p.clientes?.dni || '-',
          p.instituciones?.nombre || '-',
          `${p.tipo_prenda} / ${p.talle}${p.nombre_bordado ? ` (${p.nombre_bordado})` : ''}`,
          p.estado,
          `$${total.toFixed(2)}`,
          `$${pagado.toFixed(2)} (${pct}%)`,
          new Date(p.fecha_creacion).toLocaleDateString('es-AR'),
        ];
      }),
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [79, 70, 229], // --primary
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 8 },   // #
        6: { halign: 'right' }, // Total
        7: { halign: 'right' }, // Pagado
      },
      didParseCell: (data) => {
        // Colorear la columna Estado según el estado
        if (data.column.index === 5 && data.section === 'body') {
          const estado = data.cell.raw;
          const colorMap = {
            'Pendiente':              [202, 138, 4],
            'Autorizado':             [37, 99, 235],
            'En Corte':               [124, 58, 237],
            'Corte Finalizado':       [5, 150, 105],
            'En Confección':          [234, 88, 12],
            'Confección Finalizada':  [16, 185, 129],
            'En Bordado':             [190, 24, 93],
            'Bordado Finalizado':     [109, 40, 217],
            'Entregado':              [5, 150, 105],
          };
          const color = colorMap[estado];
          if (color) data.cell.styles.textColor = color;
          data.cell.styles.fontStyle = 'bold';
        }
        // Colorear Pagado en rojo/verde según porcentaje
        if (data.column.index === 7 && data.section === 'body') {
          const texto = data.cell.raw;
          const pct = parseInt(texto.match(/\((\d+)%\)/)?.[1] || '0');
          data.cell.styles.textColor = pct >= 100 ? [5, 150, 105] : pct >= 50 ? [37, 99, 235] : [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    // — Pie de página —
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Prius App · Página ${i} de ${pageCount} · Total de pedidos: ${pedidos.length}`,
        148.5,
        doc.internal.pageSize.height - 5,
        { align: 'center' }
      );
    }

    const fecha = new Date().toISOString().split('T')[0];
    doc.save(`prius-listado-${fecha}.pdf`);
  };

  return (
    <div>
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
              onClick={generarPDF}
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
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}><Pen size={12} /> {p.nombre_bordado}</div>
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
                          <div style={{ fontSize: '0.8rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}><Pen size={11} /> {p.nombre_bordado}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600',
                          background: ESTADO_COLORS[p.estado] ? (ESTADO_COLORS[p.estado] + '20') : 'rgba(255,255,255,0.05)',
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
  );
};

export default Listado;
