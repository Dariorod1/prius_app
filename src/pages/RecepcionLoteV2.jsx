import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { CheckCircle, XCircle, Users, Plus, Trash2, Upload, Image, Send, Pencil, X, ChevronDown, ChevronUp, Clock } from 'lucide-react';

const GRADOS = [
  '1er Grado A', '1er Grado B', '1er Grado C',
  '2do Grado A', '2do Grado B', '2do Grado C',
  '3er Grado A', '3er Grado B', '3er Grado C',
  '4to Grado A', '4to Grado B', '4to Grado C',
  '5to Grado A', '5to Grado B', '5to Grado C',
  '6to Grado A', '6to Grado B', '6to Grado C',
  '1er Año A', '1er Año B', '1er Año C',
  '2do Año A', '2do Año B', '2do Año C',
  '3er Año A', '3er Año B', '3er Año C',
  '4to Año A', '4to Año B', '4to Año C',
  '5to Año A', '5to Año B', '5to Año C',
  '6to Año A', '6to Año B', '6to Año C',
];

const RecepcionLoteV2 = () => {
  const [instituciones, setInstituciones] = useState([]);
  const [institucionId, setInstitucionId] = useState('');
  const [grado, setGrado] = useState('');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [loteActivo, setLoteActivo] = useState(false);
  const [pedidosLote, setPedidosLote] = useState([]);
  const [tabActiva, setTabActiva] = useState('Chomba');
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [clienteExistente, setClienteExistente] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [precioLoteChomba, setPrecioLoteChomba] = useState('');
  const [precioLoteCampera, setPrecioLoteCampera] = useState('');
  const [loteId, setLoteId] = useState(null);
  const [imagenChomba, setImagenChomba] = useState('');
  const [imagenCampera, setImagenCampera] = useState('');
  const [prioridadChomba, setPrioridadChomba] = useState('ninguna');
  const [prioridadCampera, setPrioridadCampera] = useState('ninguna');
  const [uploadingChomba, setUploadingChomba] = useState(false);
  const [uploadingCampera, setUploadingCampera] = useState(false);
  const [selectedPedidos, setSelectedPedidos] = useState([]);
  const [modalEliminar, setModalEliminar] = useState(null);
  const [editandoPedido, setEditandoPedido] = useState(null);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [showModalAlumno, setShowModalAlumno] = useState(false);
  const [imagenesAbiertas, setImagenesAbiertas] = useState(false);
  const [recientesLotes, setRecientesLotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('prius_lotes_recientes') || '[]'); } catch { return []; }
  });

  const ESTADOS_EDITABLE = ['Pendiente', 'Autorizado'];

  const guardarEdicion = async () => {
    if (!editandoPedido) return;
    setGuardandoEdit(true);
    const { error } = await supabase
      .from('pedidos')
      .update({ talle: editandoPedido.talle, nombre_bordado: editandoPedido.nombre_bordado })
      .eq('id', editandoPedido.id);
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar.' });
    } else {
      setPedidosLote(prev => prev.map(p => p.id === editandoPedido.id ? { ...p, talle: editandoPedido.talle, nombre_bordado: editandoPedido.nombre_bordado } : p));
      setMensaje({ tipo: 'success', texto: 'Pedido actualizado.' });
      setEditandoPedido(null);
    }
    setGuardandoEdit(false);
  };

  const [form, setForm] = useState({
    dni: '',
    nombre: '',
    telefono: '',
    quiereChomba: true,
    chomba_talle: '',
    chomba_bordado: '',
    chomba_precio: '',
    chomba_observaciones: '',
    quiereCampera: false,
    campera_talle: '',
    campera_bordado: '',
    campera_precio: '',
    campera_observaciones: '',
    monto_pagado: ''
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    async function fetchInstituciones() {
      const { data } = await supabase.from('instituciones').select('*').order('nombre');
      if (data) setInstituciones(data);
    }
    fetchInstituciones();
  }, []);

  useEffect(() => {
    if (mensaje) {
      const timer = setTimeout(() => setMensaje(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [mensaje]);

  useEffect(() => {
    const dni = form.dni.trim();
    if (dni.length < 7) { setClienteExistente(false); return; }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('nombre, telefono')
        .eq('dni', dni)
        .single();
      if (data) {
        setForm(prev => ({ ...prev, nombre: data.nombre || '', telefono: data.telefono || '' }));
        setClienteExistente(true);
      } else {
        setClienteExistente(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [form.dni]);

  const cargarLoteConValores = useCallback(async (instId, gr, anioVal) => {
    if (!instId || !gr) return;
    const anioFinal = anioVal || anio;
    setInstitucionId(instId);
    setGrado(gr);
    setAnio(anioFinal);
    setLoading(true);

    const { data: loteData } = await supabase
      .from('lotes')
      .select('*')
      .eq('institucion_id', instId)
      .eq('grado', gr)
      .eq('anio', anioFinal)
      .single();

    if (loteData) {
      setLoteId(loteData.id);
      setImagenChomba(loteData.imagen_chomba_url || '');
      setImagenCampera(loteData.imagen_campera_url || '');
      setPrioridadChomba(loteData.prioridad_chomba || loteData.prioridad || 'ninguna');
      setPrioridadCampera(loteData.prioridad_campera || loteData.prioridad || 'ninguna');
      setPrecioLoteChomba(loteData.precio_chomba != null ? String(loteData.precio_chomba) : '');
      setPrecioLoteCampera(loteData.precio_campera != null ? String(loteData.precio_campera) : '');
    } else {
      const { data: nuevoLote } = await supabase
        .from('lotes')
        .insert({ institucion_id: instId, grado: gr, anio: anioFinal, prioridad_chomba: 'ninguna', prioridad_campera: 'ninguna' })
        .select()
        .single();
      if (nuevoLote) setLoteId(nuevoLote.id);
    }

    const { data, error } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, dni)')
      .eq('institucion_id', instId)
      .eq('grado', gr)
      .order('fecha_creacion', { ascending: true });

    if (!error && data) setPedidosLote(data);
    setLoading(false);
    setLoteActivo(true);

    const nombreInstitucion = instituciones.find(i => i.id === instId)?.nombre || '';
    const entrada = { institucionId: instId, grado: gr, anio: anioFinal, nombre: nombreInstitucion, ts: Date.now() };
    setRecientesLotes(prev => {
      const filtrado = prev.filter(r => !(r.institucionId === instId && r.grado === gr && r.anio === anioFinal));
      const nuevos = [entrada, ...filtrado].slice(0, 3);
      localStorage.setItem('prius_lotes_recientes', JSON.stringify(nuevos));
      return nuevos;
    });
  }, [instituciones, anio]);

  const cargarLote = useCallback(() => cargarLoteConValores(institucionId, grado, anio), [cargarLoteConValores, institucionId, grado, anio]);

  const guardarPrecioLote = async (campo, valor) => {
    if (!loteId) return;
    await supabase.from('lotes').update({ [campo]: valor !== '' ? Number(valor) : null }).eq('id', loteId);
  };

  const resetForm = () => {
    setForm({
      dni: '', nombre: '', telefono: '',
      quiereChomba: true, chomba_talle: '', chomba_bordado: '', chomba_precio: precioLoteChomba, chomba_observaciones: '',
      quiereCampera: false, campera_talle: '', campera_bordado: '', campera_precio: precioLoteCampera, campera_observaciones: '',
      monto_pagado: ''
    });
    setClienteExistente(false);
  };

  const guardarAlumno = async () => {
    if (!form.dni.trim() || !form.nombre.trim()) {
      setMensaje({ tipo: 'error', texto: 'DNI y Nombre son obligatorios.' });
      return;
    }
    if (!form.quiereChomba && !form.quiereCampera) {
      setMensaje({ tipo: 'error', texto: 'Seleccioná al menos una prenda.' });
      return;
    }
    if (form.quiereChomba && (!form.chomba_talle || !form.chomba_precio)) {
      setMensaje({ tipo: 'error', texto: 'Completá talle y precio de la Chomba.' });
      return;
    }
    if (form.quiereCampera && (!form.campera_talle || !form.campera_precio)) {
      setMensaje({ tipo: 'error', texto: 'Completá talle y precio de la Campera.' });
      return;
    }

    setGuardando(true);
    try {
      const { error: clienteError } = await supabase
        .from('clientes')
        .upsert({ dni: form.dni.trim(), nombre: form.nombre.trim(), telefono: form.telefono.trim() || null });
      if (clienteError) throw new Error('Error al guardar cliente: ' + clienteError.message);

      const precioChomba = form.quiereChomba ? parseFloat(form.chomba_precio) || 0 : 0;
      const precioCampera = form.quiereCampera ? parseFloat(form.campera_precio) || 0 : 0;
      const totalPrendas = precioChomba + precioCampera;
      const montoPagado = parseFloat(form.monto_pagado) || 0;
      const pagoChomba = totalPrendas > 0 ? Math.round((precioChomba / totalPrendas) * montoPagado * 100) / 100 : 0;
      const pagoCampera = totalPrendas > 0 ? Math.round((precioCampera / totalPrendas) * montoPagado * 100) / 100 : 0;

      const pedidosAInsertar = [];
      if (form.quiereChomba) {
        pedidosAInsertar.push({
          cliente_dni: form.dni.trim(),
          institucion_id: institucionId,
          grado: grado,
          tipo_prenda: 'Chomba',
          talle: form.chomba_talle,
          nombre_bordado: form.chomba_bordado || null,
          observaciones: form.chomba_observaciones || null,
          precio_total: precioChomba,
          monto_pagado: pagoChomba,
          estado: 'Pendiente'
        });
      }
      if (form.quiereCampera) {
        pedidosAInsertar.push({
          cliente_dni: form.dni.trim(),
          institucion_id: institucionId,
          grado: grado,
          tipo_prenda: 'Campera',
          talle: form.campera_talle,
          nombre_bordado: form.campera_bordado || null,
          observaciones: form.campera_observaciones || null,
          precio_total: precioCampera,
          monto_pagado: pagoCampera,
          estado: 'Pendiente'
        });
      }

      const { data: nuevos, error: pedidoError } = await supabase
        .from('pedidos')
        .insert(pedidosAInsertar)
        .select('*, clientes(nombre, dni)');
      if (pedidoError) throw new Error('Error al guardar pedido: ' + pedidoError.message);

      const user = JSON.parse(localStorage.getItem('priusUser'));
      if (montoPagado > 0 && nuevos) {
        const pagosHistorial = nuevos.map(p => ({
          pedido_id: p.id,
          monto: p.monto_pagado,
          metodo_pago: 'Efectivo',
          empleado_username: user?.username || 'Desconocido'
        }));
        await supabase.from('pagos_historial').insert(pagosHistorial);
      }

      setPedidosLote(prev => [...prev, ...(nuevos || [])]);
      setMensaje({ tipo: 'success', texto: form.nombre + ' agregado al lote.' });
      resetForm();
      setShowModalAlumno(false);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const eliminarAlumno = async (pedidoId) => {
    const { error } = await supabase.from('pedidos').delete().eq('id', pedidoId);
    if (!error) {
      setPedidosLote(prev => prev.filter(p => p.id !== pedidoId));
      setSelectedPedidos(prev => prev.filter(id => id !== pedidoId));
      setMensaje({ tipo: 'success', texto: 'Pedido eliminado.' });
    }
  };

  const enviarACorte = async () => {
    if (selectedPedidos.length === 0) return;
    const user = JSON.parse(localStorage.getItem('priusUser'));
    const { error } = await supabase.from('pedidos').update({ estado: 'Autorizado' }).in('id', selectedPedidos);
    if (error) { setMensaje({ tipo: 'error', texto: 'Error al enviar a corte.' }); return; }
    const logs = selectedPedidos.map(id => ({ pedido_id: id, estado: 'Autorizado', empleado_username: user?.username || 'Desconocido' }));
    await supabase.from('pedido_estado_log').insert(logs);
    setPedidosLote(prev => prev.map(p => selectedPedidos.includes(p.id) ? { ...p, estado: 'Autorizado' } : p));
    setSelectedPedidos([]);
    setMensaje({ tipo: 'success', texto: selectedPedidos.length + ' prenda(s) enviadas a corte.' });
  };

  const subirImagen = async (file, tipo) => {
    if (!loteId || !file) return;
    const setUploading = tipo === 'chomba' ? setUploadingChomba : setUploadingCampera;
    setUploading(true);
    const ext = file.name.split('.').pop().toLowerCase();
    const path = 'lotes/' + loteId + '_' + tipo + '.' + ext;
    const { error: uploadError } = await supabase.storage.from('imagenes').upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) { setMensaje({ tipo: 'error', texto: 'Error al subir imagen: ' + uploadError.message }); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('imagenes').getPublicUrl(path);
    const url = urlData.publicUrl + '?t=' + Date.now();
    const campo = tipo === 'chomba' ? 'imagen_chomba_url' : 'imagen_campera_url';
    await supabase.from('lotes').update({ [campo]: url }).eq('id', loteId);
    if (tipo === 'chomba') setImagenChomba(url); else setImagenCampera(url);
    setMensaje({ tipo: 'success', texto: 'Imagen subida.' });
    setUploading(false);
  };

  const eliminarImagen = async (tipo) => {
    if (!loteId) return;
    const campo = tipo === 'chomba' ? 'imagen_chomba_url' : 'imagen_campera_url';
    const url = tipo === 'chomba' ? imagenChomba : imagenCampera;
    if (url) {
      const cleanUrl = url.split('?')[0];
      const parts = cleanUrl.split('/imagenes/');
      if (parts[1]) await supabase.storage.from('imagenes').remove([decodeURIComponent(parts[1])]);
    }
    await supabase.from('lotes').update({ [campo]: null }).eq('id', loteId);
    if (tipo === 'chomba') setImagenChomba(''); else setImagenCampera('');
    setModalEliminar(null);
    setMensaje({ tipo: 'success', texto: 'Imagen eliminada.' });
  };

  const cambiarPrioridadTipo = async (tipo, valor) => {
    if (!loteId) return;
    if (tipo === 'chomba') {
      setPrioridadChomba(valor);
      await supabase.from('lotes').update({ prioridad_chomba: valor }).eq('id', loteId);
    } else {
      setPrioridadCampera(valor);
      await supabase.from('lotes').update({ prioridad_campera: valor }).eq('id', loteId);
    }
  };

  // Datos derivados
  const chombas = pedidosLote.filter(p => p.tipo_prenda === 'Chomba');
  const camperas = pedidosLote.filter(p => p.tipo_prenda === 'Campera');
  const alumnosUnicos = [...new Set(pedidosLote.map(p => p.cliente_dni))].length;
  const totalPrendas = pedidosLote.length;
  const totalMonto = pedidosLote.reduce((s, p) => s + (p.precio_total || 0), 0);
  const totalCobrado = pedidosLote.reduce((s, p) => s + (p.monto_pagado || 0), 0);
  const porcentajeCobrado = totalMonto > 0 ? (totalCobrado / totalMonto) * 100 : 0;

  // Última modificación
  const ultimaModificacion = pedidosLote.length > 0
    ? pedidosLote.reduce((max, p) => {
        const f = new Date(p.fecha_creacion);
        return f > max ? f : max;
      }, new Date(0))
    : null;

  // ======= SELECTOR DE LOTE =======
  if (!loteActivo) {
    const tieneRecientes = recientesLotes.length > 0;
    return (
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Alta de Lotes</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Seleccioná la escuela, grado y año para abrir o crear un lote.</p>

        <div style={{ display: 'grid', gridTemplateColumns: tieneRecientes ? '1fr 1fr' : '1fr', gap: '2rem', alignItems: 'start' }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Escuela / Institución</label>
              <select className="form-control" value={institucionId} onChange={(e) => setInstitucionId(e.target.value)}>
                <option value="">-- Seleccioná una escuela --</option>
                {instituciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Grado / División</label>
              <select className="form-control" value={grado} onChange={(e) => setGrado(e.target.value)}>
                <option value="">-- Seleccioná un grado --</option>
                {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Año</label>
              <select className="form-control" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                {[...Array(5)].map((_, i) => {
                  const y = new Date().getFullYear() - 2 + i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
            <button
              className="btn btn-primary"
              disabled={!institucionId || !grado}
              onClick={cargarLote}
              style={{ width: '100%', padding: '1rem', fontSize: '1rem', opacity: (!institucionId || !grado) ? 0.5 : 1 }}
            >
              <Users size={18} style={{ marginRight: '8px' }} />
              {loading ? 'Cargando...' : 'Abrir Lote'}
            </button>
          </div>

          {tieneRecientes && (
            <div>
              <h3 style={{ color: 'var(--text-main)', margin: '0 0 1rem 0', fontSize: '0.95rem' }}>Recientes</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recientesLotes.map((r) => (
                  <button
                    key={r.institucionId + '_' + r.grado + '_' + (r.anio || '')}
                    onClick={() => cargarLoteConValores(r.institucionId, r.grado, r.anio || new Date().getFullYear())}
                    disabled={loading}
                    style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem 1.25rem', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                  >
                    <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '2px' }}>{r.nombre}</div>
                    <div style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: '600' }}>{r.grado} · {r.anio || ''}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ======= VISTA DEL LOTE ACTIVO =======
  const institucionNombre = instituciones.find(i => i.id === institucionId)?.nombre || '';
  const user = JSON.parse(localStorage.getItem('priusUser'));

  const renderLista = () => {
    const lista = tabActiva === 'Chomba' ? chombas : camperas;
    const pendientes = lista.filter(p => p.estado === 'Pendiente');
    const seleccionadosTab = selectedPedidos.filter(id => lista.some(p => p.id === id && p.estado === 'Pendiente'));
    const todosSeleccionados = pendientes.length > 0 && pendientes.every(p => selectedPedidos.includes(p.id));
    const tipoPrioridad = tabActiva === 'Chomba' ? 'chomba' : 'campera';
    const currentPrioridad = tabActiva === 'Chomba' ? prioridadChomba : prioridadCampera;
    const PRIORIDAD_DOT = { urgente: '#EF4444', alta: '#10B981', media: '#FACC15', baja: '#94A3B8' };

    return (
      <div>
        {/* Prioridad + acciones inline */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {PRIORIDAD_DOT[currentPrioridad] && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: PRIORIDAD_DOT[currentPrioridad], display: 'inline-block' }} />}
            <select
              className="form-control"
              value={currentPrioridad}
              onChange={(e) => cambiarPrioridadTipo(tipoPrioridad, e.target.value)}
              style={{ width: '115px', fontSize: '0.78rem' }}
            >
              <option value="ninguna">Sin prioridad</option>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          {pendientes.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={() => {
                    if (todosSeleccionados) setSelectedPedidos(prev => prev.filter(id => !pendientes.some(p => p.id === id)));
                    else setSelectedPedidos(prev => [...new Set([...prev, ...pendientes.map(p => p.id)])]);
                  }}
                  style={{ width: '14px', height: '14px', accentColor: 'var(--primary)' }}
                />
                Todos
              </label>
              {seleccionadosTab.length > 0 && (
                <button
                  onClick={enviarACorte}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: 'none', background: '#10B981', color: 'white', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                >
                  <Send size={11} /> Corte ({seleccionadosTab.length})
                </button>
              )}
            </div>
          )}
        </div>

        {lista.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px', fontSize: '0.9rem' }}>
            No hay {tabActiva === 'Chomba' ? 'chombas' : 'camperas'} cargadas.
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
            {lista.map((p, idx) => {
              const porcentaje = p.precio_total > 0 ? (p.monto_pagado / p.precio_total) * 100 : 0;
              const isPendiente = p.estado === 'Pendiente';
              const isSelected = selectedPedidos.includes(p.id);
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.7rem 0.9rem', background: isSelected ? 'rgba(16,185,129,0.06)' : (idx % 2 === 0 ? 'var(--bg-dark)' : 'var(--bg-sidebar)'),
                  borderBottom: idx < lista.length - 1 ? '1px solid var(--border-color)' : 'none'
                }}>
                  {isPendiente ? (
                    <input type="checkbox" checked={isSelected}
                      onChange={() => setSelectedPedidos(prev => isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                      style={{ width: '15px', height: '15px', flexShrink: 0, accentColor: 'var(--primary)' }}
                    />
                  ) : (
                    <CheckCircle size={15} style={{ color: '#10B981', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.clientes?.nombre || p.cliente_dni}
                    </div>
                    <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span>T: <strong style={{ color: 'var(--accent)' }}>{p.talle}</strong></span>
                      {p.nombre_bordado && <span>{p.nombre_bordado}</span>}
                      {p.observaciones && <span style={{ color: '#FACC15', fontStyle: 'italic' }}>{p.observaciones}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ${p.monto_pagado}/{p.precio_total}
                  </div>
                  {ESTADOS_EDITABLE.includes(p.estado) && (
                    <button onClick={() => setEditandoPedido({ id: p.id, talle: p.talle, nombre_bordado: p.nombre_bordado || '' })}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '3px', flexShrink: 0 }} title="Editar">
                      <Pencil size={14} />
                    </button>
                  )}
                  <button onClick={() => eliminarAlumno(p.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px', flexShrink: 0 }} title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Toast */}
      {mensaje && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', padding: '0.9rem 1.5rem', borderRadius: '8px', backgroundColor: mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)', color: 'white', fontWeight: '500', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
          {mensaje.tipo === 'success' ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {mensaje.texto}
        </div>
      )}

      {/* Modal eliminar imagen */}
      {modalEliminar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }} onClick={() => setModalEliminar(null)}>
          <div style={{ background: 'var(--bg-sidebar)', borderRadius: '12px', padding: '2rem', maxWidth: '380px', width: '90%', border: '1px solid var(--border-color)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: 'var(--text-main)', margin: '0 0 0.75rem 0' }}>Eliminar imagen</h3>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 1.5rem 0', fontSize: '0.9rem' }}>
              ¿Seguro? Se borra la imagen de <strong>{modalEliminar === 'chomba' ? 'Chomba' : 'Campera'}</strong>.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalEliminar(null)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
              <button onClick={() => eliminarImagen(modalEliminar)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', background: '#EF4444', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar pedido */}
      {editandoPedido && (
        <div onClick={() => setEditandoPedido(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-sidebar)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '400px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem' }}><Pencil size={15} style={{ marginRight: '6px', verticalAlign: 'middle', color: 'var(--primary)' }} />Editar prenda</h3>
              <button onClick={() => setEditandoPedido(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Talle</label>
                <select className="form-control" value={editandoPedido.talle} onChange={e => setEditandoPedido(prev => ({ ...prev, talle: e.target.value }))}>
                  <option value="">--</option>
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2', '4', '6', '8', '10', '12', '14', '16'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Texto a bordar</label>
                <input type="text" className="form-control" placeholder="Nombre" value={editandoPedido.nombre_bordado} onChange={e => setEditandoPedido(prev => ({ ...prev, nombre_bordado: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setEditandoPedido(null)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardarEdicion} disabled={guardandoEdit || !editandoPedido.talle} style={{ flex: 2, padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: '700', cursor: 'pointer', opacity: guardandoEdit ? 0.6 : 1 }}>{guardandoEdit ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar Alumno */}
      {showModalAlumno && (
        <div onClick={() => setShowModalAlumno(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-sidebar)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '520px', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem' }}>Agregar alumno al lote</h3>
              <button onClick={() => setShowModalAlumno(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {/* DNI + Nombre */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>DNI</label>
                <input type="text" className="form-control" placeholder="35123456" value={form.dni} onChange={(e) => setForm(prev => ({ ...prev, dni: e.target.value }))} />
                {clienteExistente && <div style={{ marginTop: '3px', fontSize: '0.72rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '3px' }}><CheckCircle size={11} /> Existente</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Nombre</label>
                <input type="text" className="form-control" placeholder="Nombre completo" value={form.nombre} onChange={(e) => setForm(prev => ({ ...prev, nombre: e.target.value }))} />
              </div>
            </div>

            {/* Chomba */}
            <div style={{ marginBottom: '0.75rem', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: form.quiereChomba ? 'rgba(0,158,227,0.04)' : 'transparent', opacity: form.quiereChomba ? 1 : 0.5 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: form.quiereChomba ? '0.6rem' : 0 }}>
                <input type="checkbox" checked={form.quiereChomba} onChange={(e) => setForm(prev => ({ ...prev, quiereChomba: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
                <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.88rem' }}>Chomba</span>
                {form.quiereChomba && form.chomba_precio && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>${form.chomba_precio}</span>}
              </label>
              {form.quiereChomba && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Talle</label>
                    <select className="form-control" value={form.chomba_talle} onChange={(e) => setForm(prev => ({ ...prev, chomba_talle: e.target.value }))} style={{ fontSize: '0.85rem' }}>
                      <option value="">--</option>
                      {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Bordado</label>
                    <input type="text" className="form-control" placeholder="Nombre" value={form.chomba_bordado} onChange={(e) => setForm(prev => ({ ...prev, chomba_bordado: e.target.value }))} style={{ fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Precio $</label>
                    <input type="number" className="form-control" placeholder="0" value={form.chomba_precio} onChange={(e) => setForm(prev => ({ ...prev, chomba_precio: e.target.value }))} style={{ fontSize: '0.85rem' }} />
                  </div>
                  <div style={{ gridColumn: 'span 3' }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Observaciones</label>
                    <input type="text" className="form-control" placeholder="Opcional" value={form.chomba_observaciones} onChange={(e) => setForm(prev => ({ ...prev, chomba_observaciones: e.target.value }))} style={{ fontSize: '0.85rem' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Campera */}
            <div style={{ marginBottom: '0.75rem', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: form.quiereCampera ? 'rgba(0,158,227,0.04)' : 'transparent', opacity: form.quiereCampera ? 1 : 0.5 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: form.quiereCampera ? '0.6rem' : 0 }}>
                <input type="checkbox" checked={form.quiereCampera} onChange={(e) => setForm(prev => ({ ...prev, quiereCampera: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
                <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.88rem' }}>Campera</span>
                {form.quiereCampera && form.campera_precio && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>${form.campera_precio}</span>}
              </label>
              {form.quiereCampera && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Talle</label>
                    <select className="form-control" value={form.campera_talle} onChange={(e) => setForm(prev => ({ ...prev, campera_talle: e.target.value }))} style={{ fontSize: '0.85rem' }}>
                      <option value="">--</option>
                      {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Bordado</label>
                    <input type="text" className="form-control" placeholder="Nombre" value={form.campera_bordado} onChange={(e) => setForm(prev => ({ ...prev, campera_bordado: e.target.value }))} style={{ fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Precio $</label>
                    <input type="number" className="form-control" placeholder="0" value={form.campera_precio} onChange={(e) => setForm(prev => ({ ...prev, campera_precio: e.target.value }))} style={{ fontSize: '0.85rem' }} />
                  </div>
                  <div style={{ gridColumn: 'span 3' }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Observaciones</label>
                    <input type="text" className="form-control" placeholder="Opcional" value={form.campera_observaciones} onChange={(e) => setForm(prev => ({ ...prev, campera_observaciones: e.target.value }))} style={{ fontSize: '0.85rem' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Seña */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Seña $</label>
              <input type="number" className="form-control" placeholder="0" value={form.monto_pagado} onChange={(e) => setForm(prev => ({ ...prev, monto_pagado: e.target.value }))} />
            </div>

            <button className="btn btn-primary" onClick={guardarAlumno} disabled={guardando} style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem' }}>
              {guardando ? 'Guardando...' : 'Agregar al lote'}
            </button>
          </div>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ color: 'var(--primary)', margin: 0, fontSize: isMobile ? '1.15rem' : '1.4rem', fontWeight: '800' }}>
            {institucionNombre}
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '2px 0 0', fontSize: '0.88rem' }}>{grado} · {anio}</p>
        </div>
        <button
          style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
          onClick={() => { setLoteActivo(false); setPedidosLote([]); }}
        >
          Cambiar
        </button>
      </div>

      {/* ===== RESUMEN COMPACTO ===== */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', padding: '0.8rem 1rem', background: 'var(--bg-sidebar)', borderRadius: '10px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--primary)' }}>{alumnosUnicos}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>alumnos</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main)' }}>{totalPrendas}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>prendas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main)' }}>${totalMonto.toLocaleString()}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>total</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '1.3rem', fontWeight: '800', color: porcentajeCobrado >= 50 ? 'var(--accent)' : '#EF4444' }}>{porcentajeCobrado.toFixed(0)}%</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>cobrado</span>
        </div>
        {/* Precios inline */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ch $</span>
            <input type="number" className="form-control" placeholder="0" value={precioLoteChomba}
              onChange={(e) => { setPrecioLoteChomba(e.target.value); setForm(prev => ({ ...prev, chomba_precio: e.target.value })); }}
              onBlur={(e) => guardarPrecioLote('precio_chomba', e.target.value)}
              style={{ width: '75px', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ca $</span>
            <input type="number" className="form-control" placeholder="0" value={precioLoteCampera}
              onChange={(e) => { setPrecioLoteCampera(e.target.value); setForm(prev => ({ ...prev, campera_precio: e.target.value })); }}
              onBlur={(e) => guardarPrecioLote('precio_campera', e.target.value)}
              style={{ width: '75px', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }} />
          </div>
        </div>
      </div>

      {/* ===== TABS + BOTÓN AGREGAR ===== */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        {['Chomba', 'Campera'].map(tab => (
          <button
            key={tab}
            onClick={() => setTabActiva(tab)}
            style={{
              padding: '0.55rem 1.2rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: tabActiva === tab ? 'var(--primary)' : 'var(--bg-sidebar)',
              color: tabActiva === tab ? 'white' : 'var(--text-muted)',
              fontWeight: tabActiva === tab ? '700' : '500',
              fontSize: '0.88rem', transition: 'all 0.15s'
            }}
          >
            {tab} ({tab === 'Chomba' ? chombas.length : camperas.length})
          </button>
        ))}
        <button
          onClick={() => { resetForm(); setShowModalAlumno(true); }}
          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', background: '#10B981', color: 'white', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <Plus size={15} /> Agregar alumno
        </button>
      </div>

      {/* ===== LISTA PRINCIPAL ===== */}
      {renderLista()}

      {/* ===== IMÁGENES (COLAPSABLE) ===== */}
      <div style={{ marginTop: '1.5rem' }}>
        <button
          onClick={() => setImagenesAbiertas(!imagenesAbiertas)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', padding: '0.5rem 0' }}
        >
          {imagenesAbiertas ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          Imágenes del lote
          {(imagenChomba || imagenCampera) && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />}
        </button>
        {imagenesAbiertas && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', marginTop: '0.75rem', padding: '1rem', background: 'var(--bg-sidebar)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            {/* Chomba */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: '600' }}>Chomba</span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', background: 'var(--primary)', color: 'white', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <Upload size={12} /> {uploadingChomba ? '...' : 'Subir'}
                  <input type="file" accept="image/*" hidden onChange={(e) => { if (e.target.files[0]) subirImagen(e.target.files[0], 'chomba'); }} />
                </label>
              </div>
              {imagenChomba ? (
                <div style={{ position: 'relative' }}>
                  <img src={imagenChomba} alt="Chomba" style={{ width: '100%', height: '120px', objectFit: 'contain', borderRadius: '8px', background: 'var(--bg-dark)' }} />
                  <button onClick={() => setModalEliminar('chomba')} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '5px', padding: '3px 5px', cursor: 'pointer' }}><Trash2 size={12} color="white" /></button>
                </div>
              ) : (
                <div style={{ width: '100%', height: '90px', borderRadius: '8px', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Image size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                </div>
              )}
            </div>
            {/* Campera */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: '600' }}>Campera</span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', background: 'var(--primary)', color: 'white', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <Upload size={12} /> {uploadingCampera ? '...' : 'Subir'}
                  <input type="file" accept="image/*" hidden onChange={(e) => { if (e.target.files[0]) subirImagen(e.target.files[0], 'campera'); }} />
                </label>
              </div>
              {imagenCampera ? (
                <div style={{ position: 'relative' }}>
                  <img src={imagenCampera} alt="Campera" style={{ width: '100%', height: '120px', objectFit: 'contain', borderRadius: '8px', background: 'var(--bg-dark)' }} />
                  <button onClick={() => setModalEliminar('campera')} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '5px', padding: '3px 5px', cursor: 'pointer' }}><Trash2 size={12} color="white" /></button>
                </div>
              ) : (
                <div style={{ width: '100%', height: '90px', borderRadius: '8px', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Image size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== ÚLTIMA MODIFICACIÓN ===== */}
      {ultimaModificacion && (
        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <Clock size={13} />
          Última carga: {ultimaModificacion.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })} a las {ultimaModificacion.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          {user && <span style={{ marginLeft: '4px' }}>por <strong style={{ color: 'var(--text-main)' }}>{user.username}</strong></span>}
        </div>
      )}
    </div>
  );
};

export default RecepcionLoteV2;
