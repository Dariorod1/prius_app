import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { CheckCircle, XCircle, Users, Plus, Trash2, Upload, Image, Send, Pencil, X } from 'lucide-react';

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

const RecepcionLote = () => {
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
  const [modalEliminar, setModalEliminar] = useState(null); // 'chomba' | 'campera' | null
  const [editandoPedido, setEditandoPedido] = useState(null); // { id, talle, nombre_bordado }
  const [guardandoEdit, setGuardandoEdit] = useState(false);
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
    chomba_obs_bordado: '',
    quiereCampera: false,
    campera_talle: '',
    campera_bordado: '',
    campera_precio: '',
    campera_observaciones: '',
    campera_obs_bordado: '',
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

  // Buscar cliente por DNI
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

  // Cargar lote existente de la DB
  const cargarLoteConValores = useCallback(async (instId, gr, anioVal) => {
    if (!instId || !gr) return;
    const anioFinal = anioVal || anio;
    setInstitucionId(instId);
    setGrado(gr);
    setAnio(anioFinal);
    setLoading(true);

    let currentLoteId = null;

    const { data: loteData } = await supabase
      .from('lotes')
      .select('*')
      .eq('institucion_id', instId)
      .eq('grado', gr)
      .eq('anio', anioFinal)
      .single();

    if (loteData) {
      currentLoteId = loteData.id;
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
      if (nuevoLote) { currentLoteId = nuevoLote.id; setLoteId(nuevoLote.id); }
    }

    const { data, error } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, dni)')
      .eq('lote_id', currentLoteId)
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
      quiereChomba: true, chomba_talle: '', chomba_bordado: '', chomba_precio: precioLoteChomba, chomba_observaciones: '', chomba_obs_bordado: '',
      quiereCampera: false, campera_talle: '', campera_bordado: '', campera_precio: precioLoteCampera, campera_observaciones: '', campera_obs_bordado: '',
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
      // 1. Upsert cliente
      const { error: clienteError } = await supabase
        .from('clientes')
        .upsert({ dni: form.dni.trim(), nombre: form.nombre.trim(), telefono: form.telefono.trim() || null });
      if (clienteError) throw new Error('Error al guardar cliente: ' + clienteError.message);

      // 2. Calcular distribución proporcional del pago
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
          lote_id: loteId,
          tipo_prenda: 'Chomba',
          talle: form.chomba_talle,
          nombre_bordado: form.chomba_bordado || null,
          observaciones: form.chomba_observaciones || null,
          observaciones_bordado: form.chomba_obs_bordado || null,
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
          lote_id: loteId,
          tipo_prenda: 'Campera',
          talle: form.campera_talle,
          nombre_bordado: form.campera_bordado || null,
          observaciones: form.campera_observaciones || null,
          observaciones_bordado: form.campera_obs_bordado || null,
          precio_total: precioCampera,
          monto_pagado: pagoCampera,
          estado: 'Pendiente'
        });
      }

      // 3. Insertar pedidos
      const { data: nuevos, error: pedidoError } = await supabase
        .from('pedidos')
        .insert(pedidosAInsertar)
        .select('*, clientes(nombre, dni)');
      if (pedidoError) throw new Error('Error al guardar pedido: ' + pedidoError.message);

      // 4. Registrar pagos en historial si hubo pago
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

      // 5. Actualizar lista local
      setPedidosLote(prev => [...prev, ...(nuevos || [])]);
      setMensaje({ tipo: 'success', texto: `${form.nombre} agregado al lote correctamente.` });
      resetForm();

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
    const { error } = await supabase
      .from('pedidos')
      .update({ estado: 'Autorizado' })
      .in('id', selectedPedidos);
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al enviar a corte.' });
      return;
    }
    // Log de estado
    const logs = selectedPedidos.map(id => ({
      pedido_id: id,
      estado: 'Autorizado',
      empleado_username: user?.username || 'Desconocido'
    }));
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
    if (uploadError) {
      setMensaje({ tipo: 'error', texto: 'Error al subir imagen: ' + uploadError.message });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('imagenes').getPublicUrl(path);
    const url = urlData.publicUrl + '?t=' + Date.now();
    const campo = tipo === 'chomba' ? 'imagen_chomba_url' : 'imagen_campera_url';
    await supabase.from('lotes').update({ [campo]: url }).eq('id', loteId);
    if (tipo === 'chomba') setImagenChomba(url);
    else setImagenCampera(url);
    setMensaje({ tipo: 'success', texto: 'Imagen subida correctamente.' });
    setUploading(false);
  };

  const eliminarImagen = async (tipo) => {
    if (!loteId) return;
    const campo = tipo === 'chomba' ? 'imagen_chomba_url' : 'imagen_campera_url';
    const url = tipo === 'chomba' ? imagenChomba : imagenCampera;
    if (url) {
      // Extraer path del archivo desde la URL (sin query params)
      const cleanUrl = url.split('?')[0];
      const parts = cleanUrl.split('/imagenes/');
      if (parts[1]) {
        await supabase.storage.from('imagenes').remove([decodeURIComponent(parts[1])]);
      }
    }
    await supabase.from('lotes').update({ [campo]: null }).eq('id', loteId);
    if (tipo === 'chomba') setImagenChomba('');
    else setImagenCampera('');
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

  // ========== RENDER ==========

  // Selector de Lote (escuela + grado)
  if (!loteActivo) {
    const tieneRecientes = recientesLotes.length > 0;
    return (
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Recepción por Lote</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Seleccioná la escuela y el grado para comenzar o continuar la carga de un lote.</p>

        <div style={{ display: 'grid', gridTemplateColumns: tieneRecientes ? '1fr 1fr' : '1fr', gap: '2rem', alignItems: 'start' }}>
          {/* Columna izquierda: formulario de búsqueda */}
          <div style={{ background: 'var(--bg-sidebar)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Escuela / Institución</label>
              <select
                className="form-control"
                value={institucionId}
                onChange={(e) => setInstitucionId(e.target.value)}
              >
                <option value="">-- Seleccioná una escuela --</option>
                {instituciones.map(i => (
                  <option key={i.id} value={i.id}>{i.nombre}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Grado / División</label>
              <select
                className="form-control"
                value={grado}
                onChange={(e) => setGrado(e.target.value)}
              >
                <option value="">-- Seleccioná un grado --</option>
                {GRADOS.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Año</label>
              <select
                className="form-control"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
              >
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

          {/* Columna derecha: lotes recientes */}
          {tieneRecientes && (
            <div>
              <h3 style={{ color: 'var(--text-main)', margin: '0 0 1rem 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1rem' }}>🕐</span> Vistos recientemente
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recientesLotes.map((r) => (
                  <button
                    key={r.institucionId + '_' + r.grado + '_' + (r.anio || '')}
                    onClick={() => cargarLoteConValores(r.institucionId, r.grado, r.anio || new Date().getFullYear())}
                    disabled={loading}
                    style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem 1.25rem', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--bg-dark)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'var(--bg-sidebar)'; }}
                  >
                    <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '2px' }}>{r.nombre}</div>
                    <div style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: '600' }}>{r.grado} · {r.anio || ''}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                      {new Date(r.ts).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', opacity: 0.6 }}>Un click abre el lote directo</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista principal del lote
  const institucionNombre = instituciones.find(i => i.id === institucionId)?.nombre || '';

  const renderLista = () => {
    const lista = tabActiva === 'Chomba' ? chombas : camperas;
    const pendientes = lista.filter(p => p.estado === 'Pendiente');
    const seleccionadosTab = selectedPedidos.filter(id => lista.some(p => p.id === id && p.estado === 'Pendiente'));
    const todosSeleccionados = pendientes.length > 0 && pendientes.every(p => selectedPedidos.includes(p.id));
    const tipoPrioridad = tabActiva === 'Chomba' ? 'chomba' : 'campera';
    const currentPrioridad = tabActiva === 'Chomba' ? prioridadChomba : prioridadCampera;
    const PRIORIDAD_DOT = { urgente: '#EF4444', alta: '#10B981', media: '#FACC15', baja: '#94A3B8' };
    const priorityHeader = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '0.75rem', gap: '6px' }}>
        {PRIORIDAD_DOT[currentPrioridad] && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: PRIORIDAD_DOT[currentPrioridad], flexShrink: 0, display: 'inline-block' }} />}
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Prioridad {tabActiva}:</label>
        <select
          className="form-control"
          value={currentPrioridad}
          onChange={(e) => cambiarPrioridadTipo(tipoPrioridad, e.target.value)}
          style={{ width: '115px', fontSize: '0.8rem' }}
        >
          <option value="ninguna">Sin prioridad</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
      </div>
    );

    if (lista.length === 0) {
      return (
        <div>
          {priorityHeader}
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
            No hay {tabActiva === 'Chomba' ? 'chombas' : 'camperas'} cargadas aún.
          </div>
        </div>
      );
    }
    return (
      <div>
        {priorityHeader}
        {/* Barra de acciones */}
        {pendientes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={todosSeleccionados}
                onChange={() => {
                  if (todosSeleccionados) {
                    setSelectedPedidos(prev => prev.filter(id => !pendientes.some(p => p.id === id)));
                  } else {
                    const ids = pendientes.map(p => p.id);
                    setSelectedPedidos(prev => [...new Set([...prev, ...ids])]);
                  }
                }}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
              />
              Seleccionar todos ({pendientes.length})
            </label>
            {seleccionadosTab.length > 0 && (
              <button
                onClick={enviarACorte}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#10B981', color: 'white', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
              >
                <Send size={13} /> Enviar a Corte ({seleccionadosTab.length})
              </button>
            )}
          </div>
        )}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
          {lista.map((p, idx) => {
            const porcentaje = p.precio_total > 0 ? (p.monto_pagado / p.precio_total) * 100 : 0;
            const isPendiente = p.estado === 'Pendiente';
            const isSelected = selectedPedidos.includes(p.id);
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', background: isSelected ? 'rgba(16,185,129,0.08)' : 'var(--bg-dark)',
                borderBottom: idx < lista.length - 1 ? '1px solid var(--border-color)' : 'none'
              }}>
                {isPendiente ? (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      setSelectedPedidos(prev => isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                    }}
                    style={{ width: '16px', height: '16px', flexShrink: 0, accentColor: 'var(--primary)' }}
                  />
                ) : (
                  <CheckCircle size={16} style={{ color: '#10B981', flexShrink: 0 }} />
                )}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', width: '24px', flexShrink: 0 }}>{idx + 1}.</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.clientes?.nombre || p.cliente_dni}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span>Talle: <strong style={{ color: 'var(--accent)' }}>{p.talle}</strong></span>
                    {p.nombre_bordado && <span>Bordado: <strong style={{ color: 'var(--text-main)' }}>{p.nombre_bordado}</strong></span>}
                    {p.observaciones && <span style={{ fontStyle: 'italic' }}>Obs: {p.observaciones}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>${p.monto_pagado}/${p.precio_total}</div>
                  <div style={{ width: '60px', height: '4px', background: 'var(--track-color)', borderRadius: '2px', marginTop: '4px' }}>
                    <div style={{ width: Math.min(porcentaje, 100) + '%', height: '100%', background: porcentaje >= 100 ? 'var(--accent)' : 'var(--primary)', borderRadius: '2px' }}></div>
                  </div>
                </div>
                {ESTADOS_EDITABLE.includes(p.estado) && (
                  <button
                    onClick={() => setEditandoPedido({ id: p.id, talle: p.talle, nombre_bordado: p.nombre_bordado || '' })}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                    title="Editar talle y bordado"
                  >
                    <Pencil size={15} />
                  </button>
                )}
                <button
                  onClick={() => eliminarAlumno(p.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderForm = () => (
    <div style={{ background: 'var(--bg-sidebar)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
      <h3 style={{ color: 'var(--text-main)', margin: '0 0 1rem 0', fontSize: '1rem' }}>
        <Plus size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
        Agregar Alumno
      </h3>

      {/* DNI + Nombre */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>DNI</label>
          <input
            type="text" className="form-control" placeholder="Ej: 35123456"
            value={form.dni}
            onChange={(e) => setForm(prev => ({ ...prev, dni: e.target.value }))}
          />
          {clienteExistente && (
            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--accent)' }}>
              <CheckCircle size={12} /> Ya dado de alta
            </div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Nombre</label>
          <input
            type="text" className="form-control" placeholder="Nombre completo"
            value={form.nombre}
            onChange={(e) => setForm(prev => ({ ...prev, nombre: e.target.value }))}
          />
        </div>
      </div>

      {/* Chomba */}
      <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: form.quiereChomba ? 'rgba(0, 158, 227, 0.05)' : 'transparent', opacity: form.quiereChomba ? 1 : 0.5 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: form.quiereChomba ? '0.75rem' : 0 }}>
          <input
            type="checkbox"
            checked={form.quiereChomba}
            onChange={(e) => setForm(prev => ({ ...prev, quiereChomba: e.target.checked }))}
            style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
          />
          <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>Chomba</span>
          {form.quiereChomba && form.chomba_precio && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>${form.chomba_precio}</span>}
        </label>
        {form.quiereChomba && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Talle</label>
              <select className="form-control" value={form.chomba_talle} onChange={(e) => setForm(prev => ({ ...prev, chomba_talle: e.target.value }))}>
                <option value="">--</option>
                {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Bordado</label>
              <input type="text" className="form-control" placeholder="Nombre" value={form.chomba_bordado} onChange={(e) => setForm(prev => ({ ...prev, chomba_bordado: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Precio $</label>
              <input type="number" className="form-control" placeholder="0" value={form.chomba_precio} onChange={(e) => setForm(prev => ({ ...prev, chomba_precio: e.target.value }))} />
            </div>
            <div style={{ gridColumn: isMobile ? 'span 2' : 'auto' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Observaciones</label>
              <input type="text" className="form-control" placeholder="Confección (ruedos, puños...)" value={form.chomba_observaciones} onChange={(e) => setForm(prev => ({ ...prev, chomba_observaciones: e.target.value }))} />
            </div>
            <div style={{ gridColumn: isMobile ? 'span 2' : 'auto' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#A78BFA', marginBottom: '3px' }}>Obs. Bordado</label>
              <input type="text" className="form-control" placeholder="Ej: No bordar promo 26" value={form.chomba_obs_bordado} onChange={(e) => setForm(prev => ({ ...prev, chomba_obs_bordado: e.target.value }))} />
            </div>
          </div>
        )}
      </div>

      {/* Campera */}
      <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: form.quiereCampera ? 'rgba(0, 158, 227, 0.05)' : 'transparent', opacity: form.quiereCampera ? 1 : 0.5 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: form.quiereCampera ? '0.75rem' : 0 }}>
          <input
            type="checkbox"
            checked={form.quiereCampera}
            onChange={(e) => setForm(prev => ({ ...prev, quiereCampera: e.target.checked }))}
            style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
          />
          <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>Campera</span>
          {form.quiereCampera && form.campera_precio && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>${form.campera_precio}</span>}
        </label>
        {form.quiereCampera && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Talle</label>
              <select className="form-control" value={form.campera_talle} onChange={(e) => setForm(prev => ({ ...prev, campera_talle: e.target.value }))}>
                <option value="">--</option>
                {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Bordado</label>
              <input type="text" className="form-control" placeholder="Nombre" value={form.campera_bordado} onChange={(e) => setForm(prev => ({ ...prev, campera_bordado: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Precio $</label>
              <input type="number" className="form-control" placeholder="0" value={form.campera_precio} onChange={(e) => setForm(prev => ({ ...prev, campera_precio: e.target.value }))} />
            </div>
            <div style={{ gridColumn: isMobile ? 'span 2' : 'auto' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Observaciones</label>
              <input type="text" className="form-control" placeholder="Confección (ruedos, puños...)" value={form.campera_observaciones} onChange={(e) => setForm(prev => ({ ...prev, campera_observaciones: e.target.value }))} />
            </div>
            <div style={{ gridColumn: isMobile ? 'span 2' : 'auto' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#A78BFA', marginBottom: '3px' }}>Obs. Bordado</label>
              <input type="text" className="form-control" placeholder="Ej: No bordar promo 26" value={form.campera_obs_bordado} onChange={(e) => setForm(prev => ({ ...prev, campera_obs_bordado: e.target.value }))} />
            </div>
          </div>
        )}
      </div>

      {/* Seña */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Seña / Pago del alumno $</label>
        <input
          type="number" className="form-control" placeholder="0 (opcional)"
          value={form.monto_pagado}
          onChange={(e) => setForm(prev => ({ ...prev, monto_pagado: e.target.value }))}
        />
      </div>

      {/* Botón Guardar */}
      <button
        className="btn btn-primary"
        onClick={guardarAlumno}
        disabled={guardando}
        style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem' }}
      >
        {guardando ? 'Guardando...' : 'Guardar Alumno'}
      </button>
    </div>
  );

  const renderResumen = () => (
    <div style={{
      display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr',
      gap: '0.75rem', padding: '1rem', background: 'var(--bg-sidebar)',
      borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1rem'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{alumnosUnicos}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Alumnos</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{totalPrendas}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prendas</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>${totalMonto.toLocaleString()}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: porcentajeCobrado >= 50 ? 'var(--accent)' : 'var(--danger)' }}>
          {porcentajeCobrado.toFixed(0)}%
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cobrado</div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Modal editar pedido */}
      {editandoPedido && (
        <div
          onClick={() => setEditandoPedido(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-sidebar)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '400px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Pencil size={16} style={{ color: 'var(--primary)' }} /> Editar prenda
              </h3>
              <button onClick={() => setEditandoPedido(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Talle</label>
                <select
                  className="form-control"
                  value={editandoPedido.talle}
                  onChange={e => setEditandoPedido(prev => ({ ...prev, talle: e.target.value }))}>
                  <option value="">--</option>
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2', '4', '6', '8', '10', '12', '14', '16'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Texto a bordar</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nombre o texto"
                  value={editandoPedido.nombre_bordado}
                  onChange={e => setEditandoPedido(prev => ({ ...prev, nombre_bordado: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => setEditandoPedido(null)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                disabled={guardandoEdit || !editandoPedido.talle}
                style={{ flex: 2, padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: '700', cursor: 'pointer', opacity: guardandoEdit ? 0.6 : 1 }}>
                {guardandoEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {mensaje && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', padding: '1rem 2rem',
          borderRadius: '8px', backgroundColor: mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)',
          color: 'white', fontWeight: '500', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', zIndex: 10000,
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          {mensaje.tipo === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {mensaje.texto}
        </div>
      )}

      {/* Modal confirmar eliminación de imagen */}
      {modalEliminar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }} onClick={() => setModalEliminar(null)}>
          <div style={{ background: 'var(--bg-sidebar)', borderRadius: '12px', padding: '2rem', maxWidth: '380px', width: '90%', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: 'var(--text-main)', margin: '0 0 0.75rem 0', fontSize: '1.1rem' }}>Eliminar imagen</h3>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 1.5rem 0', fontSize: '0.9rem' }}>
              ¿Estás seguro de que querés eliminar la imagen de <strong>{modalEliminar === 'chomba' ? 'Chomba' : 'Campera'}</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalEliminar(null)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
              <button onClick={() => eliminarImagen(modalEliminar)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', background: '#EF4444', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ color: 'var(--primary)', margin: 0, fontSize: isMobile ? '1.2rem' : '1.5rem' }}>
            {institucionNombre}
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>{grado} · {anio}</p>
        </div>
        <button
          className="btn"
          style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}
          onClick={() => { setLoteActivo(false); setPedidosLote([]); }}
        >
          Cambiar Lote
        </button>
      </div>

      {/* Precios del lote */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-sidebar)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Precios:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chomba $</label>
          <input type="number" className="form-control" placeholder="0" value={precioLoteChomba} onChange={(e) => { setPrecioLoteChomba(e.target.value); setForm(prev => ({ ...prev, chomba_precio: e.target.value })); }} onBlur={(e) => guardarPrecioLote('precio_chomba', e.target.value)} style={{ width: '100px' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Campera $</label>
          <input type="number" className="form-control" placeholder="0" value={precioLoteCampera} onChange={(e) => { setPrecioLoteCampera(e.target.value); setForm(prev => ({ ...prev, campera_precio: e.target.value })); }} onBlur={(e) => guardarPrecioLote('precio_campera', e.target.value)} style={{ width: '100px' }} />
        </div>
      </div>

      {/* Imágenes del lote */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Imagen Chomba */}
        <div style={{ padding: '1rem', background: 'var(--bg-sidebar)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '600' }}>Chomba</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '6px', background: 'var(--primary)', color: 'white', fontSize: '0.8rem', cursor: 'pointer' }}>
              <Upload size={13} /> {uploadingChomba ? 'Subiendo...' : 'Subir imagen'}
              <input type="file" accept="image/*" hidden onChange={(e) => { if (e.target.files[0]) subirImagen(e.target.files[0], 'chomba'); }} />
            </label>
          </div>
          {imagenChomba ? (
            <div style={{ position: 'relative' }}>
              <img src={imagenChomba} alt="Chomba" style={{ width: '100%', height: '117px', objectFit: 'contain', borderRadius: '8px', background: 'var(--bg-dark)', display: 'block' }} />
              <button onClick={() => setModalEliminar('chomba')} title="Eliminar imagen" style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '6px', padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={14} color="white" />
              </button>
            </div>
          ) : (
            <div style={{ width: '100%', height: '117px', borderRadius: '8px', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
              <Image size={32} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin imagen</span>
            </div>
          )}
        </div>
        {/* Imagen Campera */}
        <div style={{ padding: '1rem', background: 'var(--bg-sidebar)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '600' }}>Campera</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '6px', background: 'var(--primary)', color: 'white', fontSize: '0.8rem', cursor: 'pointer' }}>
              <Upload size={13} /> {uploadingCampera ? 'Subiendo...' : 'Subir imagen'}
              <input type="file" accept="image/*" hidden onChange={(e) => { if (e.target.files[0]) subirImagen(e.target.files[0], 'campera'); }} />
            </label>
          </div>
          {imagenCampera ? (
            <div style={{ position: 'relative' }}>
              <img src={imagenCampera} alt="Campera" style={{ width: '100%', height: '117px', objectFit: 'contain', borderRadius: '8px', background: 'var(--bg-dark)', display: 'block' }} />
              <button onClick={() => setModalEliminar('campera')} title="Eliminar imagen" style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '6px', padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={14} color="white" />
              </button>
            </div>
          ) : (
            <div style={{ width: '100%', height: '117px', borderRadius: '8px', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
              <Image size={32} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin imagen</span>
            </div>
          )}
        </div>
      </div>
      {/* Botón Guardar Imágenes */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          className="btn btn-primary"
          onClick={async () => {
            if (!loteId) return;
            await supabase.from('lotes').update({ imagen_chomba_url: imagenChomba || null, imagen_campera_url: imagenCampera || null }).eq('id', loteId);
            setMensaje({ tipo: 'success', texto: 'Imágenes guardadas.' });
          }}
          style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem' }}
        >
          <CheckCircle size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Guardar Imágenes
        </button>
      </div>

      {/* Resumen */}
      {renderResumen()}

      {/* Layout Principal */}
      {isMobile ? (
        // MOBILE: Form arriba, lista abajo
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {renderForm()}
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {['Chomba', 'Campera'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setTabActiva(tab)}
                  style={{
                    flex: 1, padding: '0.7rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: tabActiva === tab ? 'var(--primary)' : 'var(--bg-sidebar)',
                    color: tabActiva === tab ? 'white' : 'var(--text-muted)',
                    fontWeight: tabActiva === tab ? 'bold' : 'normal',
                    fontSize: '0.9rem', transition: 'all 0.2s'
                  }}
                >
                  {tab} ({tab === 'Chomba' ? chombas.length : camperas.length})
                </button>
              ))}
            </div>
            {renderLista()}
          </div>
        </div>
      ) : (
        // DESKTOP: Side by side
        <div style={{ display: 'grid', gridTemplateColumns: '480px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {renderForm()}
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {['Chomba', 'Campera'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setTabActiva(tab)}
                  style={{
                    padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: tabActiva === tab ? 'var(--primary)' : 'var(--bg-sidebar)',
                    color: tabActiva === tab ? 'white' : 'var(--text-muted)',
                    fontWeight: tabActiva === tab ? 'bold' : 'normal',
                    fontSize: '0.9rem', transition: 'all 0.2s'
                  }}
                >
                  {tab} ({tab === 'Chomba' ? chombas.length : camperas.length})
                </button>
              ))}
            </div>
            {renderLista()}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecepcionLote;
