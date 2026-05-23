import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { User, Hash, Paperclip, ExternalLink, Clock, Receipt } from 'lucide-react';
import Layout from './components/Layout';

// Libro Mayor — Vista consolidada cross-lote de todos los pedidos
const Dashboard = () => {
  const [pedidos, setPedidos] = useState([]);
  const [instituciones, setInstituciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filtroInstitucion, setFiltroInstitucion] = useState('');
  const [filtroInstitucionInput, setFiltroInstitucionInput] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroGrado, setFiltroGrado] = useState('');
  const [filtroPrenda, setFiltroPrenda] = useState('');
  const [filtroCobro, setFiltroCobro] = useState('');

  const [expandedRows, setExpandedRows] = useState([]);
  const [estadoLogs, setEstadoLogs] = useState({});

  const [modalPago, setModalPago] = useState(null);
  const [montoPago, setMontoPago] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [talonarioLM, setTalonarioLM] = useState('');
  const [comprobanteFileLM, setComprobanteFileLM] = useState(null);
  const [uploadingComprobanteLM, setUploadingComprobanteLM] = useState(false);
  const [guardandoPago, setGuardandoPago] = useState(false);

  const [modalHistorial, setModalHistorial] = useState(null); // pedido seleccionado
  const [historialData, setHistorialData] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Cargar lista de instituciones
  useEffect(() => {
    async function fetchInstituciones() {
      const { data } = await supabase.from('instituciones').select('*').order('nombre');
      if (data) setInstituciones(data);
    }
    fetchInstituciones();
  }, []);

  // Cargar pedidos con filtros de servidor
  useEffect(() => {
    async function fetchPedidos() {
      setLoading(true);
      try {
        let query = supabase
          .from('pedidos')
          .select('*, clientes(nombre, dni), instituciones(nombre)')
          .order('fecha_creacion', { ascending: false });

        if (filtroInstitucion) query = query.eq('institucion_id', filtroInstitucion);
        if (filtroEstado) query = query.eq('estado', filtroEstado);
        if (filtroGrado) query = query.ilike('grado', '%' + filtroGrado + '%');
        if (filtroPrenda) query = query.eq('tipo_prenda', filtroPrenda);

        const { data, error } = await query;
        if (error) throw error;
        setPedidos(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchPedidos();
  }, [filtroInstitucion, filtroEstado, filtroGrado, filtroPrenda]);

  const pedidosFiltrados = pedidos.filter(pedido => {
    if (filtroTexto) {
      const t = filtroTexto.toLowerCase();
      const dni = pedido.clientes?.dni?.toLowerCase() || '';
      const nombre = pedido.clientes?.nombre?.toLowerCase() || '';
      if (!dni.includes(t) && !nombre.includes(t)) return false;
    }
    if (filtroCobro === 'pendiente') return (pedido.monto_pagado || 0) < (pedido.precio_total || 0);
    if (filtroCobro === 'completo') return (pedido.monto_pagado || 0) >= (pedido.precio_total || 0);
    return true;
  });

  const kpiTotal = pedidosFiltrados.length;
  const kpiFact = pedidosFiltrados.reduce((s, p) => s + (p.precio_total || 0), 0);
  const kpiCobr = pedidosFiltrados.reduce((s, p) => s + (p.monto_pagado || 0), 0);
  const kpiPend = kpiFact - kpiCobr;

  const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

  const toggleRow = async (pedidoId, fechaCreacion) => {
    if (expandedRows.includes(pedidoId)) {
      setExpandedRows(prev => prev.filter(id => id !== pedidoId));
      return;
    }
    if (!estadoLogs[pedidoId]) {
      const { data } = await supabase
        .from('pedido_estado_log')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('fecha', { ascending: true });
      const logCompleto = [
        { id: 'creacion', estado: 'Ingresado', fecha: fechaCreacion, empleado_username: '-' },
        ...(data || [])
      ];
      setEstadoLogs(prev => ({ ...prev, [pedidoId]: logCompleto }));
    }
    setExpandedRows(prev => [...prev, pedidoId]);
  };

  const registrarPago = async () => {
    if (!modalPago || !montoPago || Number(montoPago) <= 0) return;
    setGuardandoPago(true);
    const monto = Number(montoPago);
    const nuevoMonto = Math.min((modalPago.monto_pagado || 0) + monto, modalPago.precio_total || monto);
    const storedUser = JSON.parse(localStorage.getItem('priusUser') || '{}');

    let comprobanteUrl = null;
    if (comprobanteFileLM) {
      setUploadingComprobanteLM(true);
      const ext = comprobanteFileLM.name.split('.').pop();
      const path = 'comprobantes/' + modalPago.id + '_' + Date.now() + '.' + ext;
      const { error: upErr } = await supabase.storage.from('imagenes').upload(path, comprobanteFileLM, { contentType: comprobanteFileLM.type, upsert: true });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('imagenes').getPublicUrl(path);
        comprobanteUrl = urlData.publicUrl;
      }
      setUploadingComprobanteLM(false);
    }

    await supabase.from('pedidos').update({ monto_pagado: nuevoMonto }).eq('id', modalPago.id);
    await supabase.from('pagos_historial').insert({
      pedido_id: modalPago.id,
      monto,
      metodo_pago: metodoPago,
      empleado_username: storedUser.username || 'sistema',
      talonario: talonarioLM.trim() || null,
      comprobante_url: comprobanteUrl,
    });
    setPedidos(prev => prev.map(p => p.id === modalPago.id ? { ...p, monto_pagado: nuevoMonto } : p));
    setModalPago(null);
    setMontoPago('');
    setMetodoPago('efectivo');
    setTalonarioLM('');
    setComprobanteFileLM(null);
    setGuardandoPago(false);
  };

  const abrirHistorial = async (pedido) => {
    setModalHistorial(pedido);
    setHistorialData([]);
    setLoadingHistorial(true);
    const { data } = await supabase
      .from('pagos_historial')
      .select('*')
      .eq('pedido_id', pedido.id)
      .order('fecha', { ascending: false });
    setHistorialData(data || []);
    setLoadingHistorial(false);
  };

  const limpiarFiltros = () => {
    setFiltroInstitucion(''); setFiltroInstitucionInput('');
    setFiltroEstado(''); setFiltroTexto('');
    setFiltroGrado(''); setFiltroPrenda(''); setFiltroCobro('');
  };

  const ESTADO_COLORS = {
    'Ingresado': '#94A3B8', 'Pendiente': '#FACC15', 'Autorizado': '#60A5FA',
    'En Corte': '#A78BFA', 'Corte Finalizado': '#34D399',
    'En Confección': '#F97316', 'Confección Finalizada': '#10B981',
    'Bordado': '#EC4899', 'Terminado': '#10B981', 'Entregado': '#10B981'
  };

  return (
    <div>
      <h1 style={{ marginBottom: '0.25rem' }}>Libro Mayor</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Vista consolidada de todos los pedidos · {pedidosFiltrados.length} resultado{pedidosFiltrados.length !== 1 ? 's' : ''}
      </p>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Pedidos', value: kpiTotal, color: '#60A5FA', big: true },
          { label: 'Facturado', value: fmtMoney(kpiFact), color: 'var(--text-main)', big: false },
          { label: 'Cobrado', value: fmtMoney(kpiCobr), color: '#34D399', big: false },
          { label: 'Saldo pendiente', value: fmtMoney(kpiPend), color: '#FACC15', big: false },
        ].map(({ label, value, color, big }) => (
          <div key={label} style={{ padding: '1rem', background: 'var(--bg-sidebar)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: big ? '2rem' : '1.2rem', fontWeight: '700', color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-sidebar)', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
        <div style={{ flex: '2', minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Institución</label>
          <input type="text" className="form-control" list="escuelas-list-dash" placeholder="Escribe para buscar..." value={filtroInstitucionInput}
            onChange={(e) => {
              const val = e.target.value;
              setFiltroInstitucionInput(val);
              const c = instituciones.find(i => i.nombre.toLowerCase() === val.toLowerCase());
              setFiltroInstitucion(c ? c.id : '');
            }} />
          <datalist id="escuelas-list-dash">
            {instituciones.map(inst => <option key={inst.id} value={inst.nombre} />)}
          </datalist>
        </div>
        <div style={{ flex: '1', minWidth: '110px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Grado</label>
          <input type="text" className="form-control" placeholder="Ej: 3er A" value={filtroGrado} onChange={(e) => setFiltroGrado(e.target.value)} />
        </div>
        <div style={{ flex: '1', minWidth: '110px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Prenda</label>
          <select className="form-control" value={filtroPrenda} onChange={(e) => setFiltroPrenda(e.target.value)}>
            <option value="">Todas</option>
            <option value="Chomba">Chomba</option>
            <option value="Campera">Campera</option>
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '130px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Estado</label>
          <select className="form-control" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Autorizado">Autorizado</option>
            <option value="En Corte">En Corte</option>
            <option value="Corte Finalizado">Corte Finalizado</option>
            <option value="En Confección">En Confección</option>
            <option value="Confección Finalizada">Confección Finalizada</option>
            <option value="Bordado">Bordado</option>
            <option value="Terminado">Terminado</option>
            <option value="Entregado">Entregado</option>
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '120px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Cobro</label>
          <select className="form-control" value={filtroCobro} onChange={(e) => setFiltroCobro(e.target.value)}>
            <option value="">Todos</option>
            <option value="pendiente">Con deuda</option>
            <option value="completo">Pagado completo</option>
          </select>
        </div>
        <div style={{ flex: '2', minWidth: '180px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Buscar (nombre o DNI)</label>
          <input type="text" className="form-control" placeholder="Ej: 35123456 o Juan Pérez" value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button className="btn" style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }} onClick={limpiarFiltros}>Limpiar</button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '1rem' }}>
          Error al cargar datos: {error}
        </div>
      )}

      {/* Tabla */}
      <div style={{ background: 'var(--bg-sidebar)', borderRadius: '8px', border: '1px solid var(--border-color)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '0.75rem 1rem', width: '32px' }}></th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Institución / Grado</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prenda</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pagos</th>
              <th style={{ padding: '0.75rem 1rem', width: '90px' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</td></tr>
            ) : pedidosFiltrados.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron pedidos con esos filtros.</td></tr>
            ) : (
              pedidosFiltrados.map(pedido => {
                const pct = pedido.precio_total > 0 ? Math.min((pedido.monto_pagado / pedido.precio_total) * 100, 100) : 0;
                const isExpanded = expandedRows.includes(pedido.id);
                const logs = estadoLogs[pedido.id] || [];
                const deuda = (pedido.precio_total || 0) - (pedido.monto_pagado || 0);
                const estadoBg = pedido.estado === 'Pendiente' ? 'rgba(250,204,21,0.15)' : pedido.estado === 'Autorizado' ? 'rgba(96,165,250,0.15)' : 'rgba(52,211,153,0.15)';
                const estadoColor = pedido.estado === 'Pendiente' ? '#FACC15' : pedido.estado === 'Autorizado' ? '#60A5FA' : '#34D399';

                return (
                  <React.Fragment key={pedido.id}>
                    <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)', cursor: 'pointer' }}
                      onClick={() => toggleRow(pedido.id, pedido.fecha_creacion)}>
                      <td style={{ padding: '0.5rem 1rem' }}>
                        <button onClick={(e) => { e.stopPropagation(); toggleRow(pedido.id, pedido.fecha_creacion); }}
                          style={{ background: isExpanded ? 'var(--primary)' : 'rgba(255,255,255,0.07)', border: '1px solid var(--border-color)', borderRadius: '6px', color: isExpanded ? 'white' : 'var(--text-muted)', cursor: 'pointer', padding: '3px 7px', fontSize: '0.7rem' }}>
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem' }}>{pedido.clientes?.nombre || '—'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DNI: {pedido.clientes?.dni || '—'}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{pedido.instituciones?.nombre || '—'}</div>
                        {pedido.grado && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pedido.grado}</div>}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{pedido.tipo_prenda} · {pedido.talle}</div>
                        {pedido.nombre_bordado && <div style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>Bordar: {pedido.nombre_bordado}</div>}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '500', background: estadoBg, color: estadoColor }}>
                          {pedido.estado}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', minWidth: '160px' }}>
                        <div style={{ fontSize: '0.82rem', color: deuda > 0 ? '#FACC15' : '#34D399', fontVariantNumeric: 'tabular-nums', marginBottom: '4px' }}>
                          {fmtMoney(pedido.monto_pagado)} / {fmtMoney(pedido.precio_total)}
                          {deuda > 0 && <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>({fmtMoney(-deuda)})</span>}
                        </div>
                        <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px' }}>
                          <div style={{ width: pct + '%', height: '100%', background: pct >= 100 ? '#34D399' : 'var(--primary)', borderRadius: '3px', transition: 'width 0.3s ease' }}></div>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {deuda > 0 && (
                            <button className="btn" onClick={() => { setModalPago(pedido); setMontoPago(String(deuda)); setMetodoPago('efectivo'); }}
                              style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: '#34D399', fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' }}>
                              + Pago
                            </button>
                          )}
                          {(pedido.monto_pagado || 0) > 0 && (
                            <button className="btn" onClick={() => abrirHistorial(pedido)}
                              style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#60A5FA', fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Receipt size={12} /> Recibos
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={pedido.id + '-tl'} style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                        <td colSpan="7" style={{ padding: '1rem 1.5rem 1.5rem 3rem' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                            {logs.map((log, index) => {
                              const color = ESTADO_COLORS[log.estado] || '#94A3B8';
                              const isLast = index === logs.length - 1;
                              const nextColor = ESTADO_COLORS[logs[index + 1]?.estado] || '#94A3B8';
                              return (
                                <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '120px' }}>
                                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: color, flexShrink: 0, marginBottom: '6px', boxShadow: '0 0 0 3px ' + color + '30' }}></div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color, textAlign: 'center', lineHeight: 1.2, marginBottom: '4px' }}>{log.estado}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>{new Date(log.fecha).toLocaleDateString()}</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>{new Date(log.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {log.empleado_username !== '-' && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}><User size={10} />{log.empleado_username}</span>}
                                  </div>
                                  {!isLast && <div style={{ width: '40px', height: '2px', background: 'linear-gradient(to right, ' + color + ', ' + nextColor + ')', marginTop: '6px', flexShrink: 0 }}></div>}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Pago Rápido */}
      {modalPago && (
        <div onClick={() => setModalPago(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-sidebar)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '420px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)' }}>Registrar pago</h3>
            <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {modalPago.clientes?.nombre} · {modalPago.tipo_prenda} · {modalPago.instituciones?.nombre}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'rgba(250,204,21,0.07)', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Saldo pendiente:</span>
              <span style={{ color: '#FACC15', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney((modalPago.precio_total || 0) - (modalPago.monto_pagado || 0))}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Monto $</label>
                <input type="number" className="form-control" placeholder="0" value={montoPago} onChange={(e) => setMontoPago(e.target.value)} autoFocus />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Método</label>
                <select className="form-control" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
            </div>

            {/* Talonario */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                <Hash size={12} style={{ verticalAlign: 'middle', marginRight: '3px' }} />N° Talonario
              </label>
              <input type="text" className="form-control" placeholder="Ej: 00234" value={talonarioLM} onChange={(e) => setTalonarioLM(e.target.value)} />
            </div>

            {/* Comprobante (solo transferencia) */}
            {metodoPago === 'transferencia' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  <Paperclip size={12} style={{ verticalAlign: 'middle', marginRight: '3px' }} />
                  Comprobante <span style={{ opacity: 0.6 }}>(opcional)</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.45rem 0.9rem', borderRadius: '8px', border: '1px dashed var(--border-color)', cursor: 'pointer', fontSize: '0.82rem', color: comprobanteFileLM ? 'var(--accent)' : 'var(--text-muted)', background: comprobanteFileLM ? 'rgba(16,185,129,0.06)' : 'transparent', width: '100%', boxSizing: 'border-box' }}>
                  <Paperclip size={13} />
                  {comprobanteFileLM ? comprobanteFileLM.name : 'Seleccionar imagen o PDF'}
                  <input type="file" accept="image/*,.pdf" hidden onChange={(e) => setComprobanteFileLM(e.target.files[0] || null)} />
                </label>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalPago(null)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
              <button onClick={registrarPago} disabled={guardandoPago || uploadingComprobanteLM || !montoPago || Number(montoPago) <= 0}
                style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', background: '#34D399', color: '#052e16', cursor: guardandoPago ? 'default' : 'pointer', fontSize: '0.85rem', fontWeight: '600', opacity: (!montoPago || Number(montoPago) <= 0) ? 0.5 : 1 }}>
                {uploadingComprobanteLM ? 'Subiendo...' : guardandoPago ? 'Guardando...' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Historial de Pagos ── */}
      {modalHistorial && (
        <div onClick={() => setModalHistorial(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-sidebar)', borderRadius: '14px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.5rem 1.5rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem', fontWeight: '700' }}>Historial de pagos</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{modalHistorial.clientes?.nombre || '—'} · {modalHistorial.tipo_prenda} {modalHistorial.talle}</p>
              </div>
              <button onClick={() => setModalHistorial(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1, padding: '2px 6px' }}>×</button>
            </div>

            {/* Resumen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              {[{ label: 'Total', value: fmtMoney(modalHistorial.precio_total), color: 'var(--text-main)' }, { label: 'Abonado', value: fmtMoney(modalHistorial.monto_pagado), color: '#34D399' }, { label: 'Saldo', value: fmtMoney((modalHistorial.precio_total || 0) - (modalHistorial.monto_pagado || 0)), color: (modalHistorial.precio_total || 0) - (modalHistorial.monto_pagado || 0) > 0 ? '#FACC15' : '#34D399' }].map(item => (
                <div key={item.label} style={{ background: 'var(--bg-dark)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                  <div style={{ fontWeight: '700', fontSize: '1rem', color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Lista de movimientos */}
            <div style={{ padding: '1rem 1.5rem 1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <Clock size={13} /> Movimientos
              </div>
              {loadingHistorial ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cargando...</div>
              ) : historialData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sin movimientos registrados.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {historialData.map((pago, idx) => {
                    const metodoColor = pago.metodo_pago === 'Efectivo' ? '#34D399' : pago.metodo_pago === 'Transferencia' ? '#60A5FA' : '#A78BFA';
                    const metodoBg = pago.metodo_pago === 'Efectivo' ? 'rgba(52,211,153,0.1)' : pago.metodo_pago === 'Transferencia' ? 'rgba(96,165,250,0.1)' : 'rgba(167,139,250,0.1)';
                    return (
                      <div key={pago.id || idx} style={{ background: 'var(--bg-dark)', borderRadius: '10px', padding: '0.9rem 1rem', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        {/* Número de pago */}
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {historialData.length - idx}
                        </div>
                        {/* Monto */}
                        <div style={{ flex: 1, minWidth: '80px' }}>
                          <div style={{ fontWeight: '700', fontSize: '1.05rem', color: '#34D399', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(pago.monto)}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>{new Date(pago.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })} · {new Date(pago.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        {/* Método */}
                        <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', background: metodoBg, color: metodoColor, flexShrink: 0 }}>
                          {pago.metodo_pago}
                        </span>
                        {/* Talonario */}
                        {pago.talonario && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                            <Hash size={11} />#{pago.talonario}
                          </span>
                        )}
                        {/* Comprobante */}
                        {pago.comprobante_url && (
                          <a href={pago.comprobante_url} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#60A5FA', textDecoration: 'none', flexShrink: 0, padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(96,165,250,0.25)', background: 'rgba(96,165,250,0.07)' }}>
                            <Paperclip size={11} /> Comprobante <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import Login from './pages/Login';
import Home from './pages/Home';
import Recepcion from './pages/Recepcion';
import RecepcionLote from './pages/RecepcionLote';
import Escuelas from './pages/Escuelas';
import Empleados from './pages/Empleados';
import Pagos from './pages/Pagos';
import Corte from './pages/Corte';
import Confeccion from './pages/Confeccion';
import Bordado from './pages/Bordado';
import Listado from './pages/Listado';

function App() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('priusUser');
    if (stored) {
      const data = JSON.parse(stored);
      if (Date.now() > data.expiresAt) {
        localStorage.removeItem('priusUser');
        return null;
      }
      return data;
    }
    return null;
  });

  useEffect(() => {
    if (!user) return;
    
    // Actualiza la marca de tiempo en la actividad
    const handleActivity = () => {
      localStorage.setItem('priusUserActivity', Date.now().toString());
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    // Revisar inactividad cada minuto
    const interval = setInterval(() => {
      const lastActivity = parseInt(localStorage.getItem('priusUserActivity') || Date.now());
      if (Date.now() - lastActivity > 20 * 60 * 1000) { // 20 minutos de inactividad
        handleLogout();
      }
    }, 60000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(interval);
    };
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('priusUser');
    localStorage.removeItem('priusUserActivity');
    setUser(null);
    window.location.href = '/'; // Fuerza la redirección al home principal
  };

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}>
          <Route index element={<Home />} />
          <Route path="libro-mayor" element={<Dashboard />} />
          <Route path="pedidos" element={<Recepcion />} />
          <Route path="recepcion-lote" element={<RecepcionLote />} />
          <Route path="escuelas" element={<Escuelas />} />
          <Route path="empleados" element={<Empleados />} />
          <Route path="pagos" element={<Pagos />} />
          <Route path="corte" element={<Corte />} />
          <Route path="confeccion" element={<Confeccion />} />
          <Route path="bordado" element={<Bordado />} />
          <Route path="listado" element={<Listado />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
