import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, DollarSign, Clock, User, CreditCard, ChevronDown, ChevronUp, PackageCheck, AlertTriangle, Paperclip, ExternalLink, Hash } from 'lucide-react';

const Pagos = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pedidosEncontrados, setPedidosEncontrados] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedCards, setExpandedCards] = useState([]);

  // Modal State
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [historialPagos, setHistorialPagos] = useState([]);
  const [loadingModal, setLoadingModal] = useState(false);
  
  // Payment Form State
  const [montoPagar, setMontoPagar] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [talonario, setTalonario] = useState('');
  const [comprobanteFile, setComprobanteFile] = useState(null);
  const [uploadingComprobante, setUploadingComprobante] = useState(false);
  const [uploadingComprobanteId, setUploadingComprobanteId] = useState(null);
  const [historialVisible, setHistorialVisible] = useState(false);
  const [pagoError, setPagoError] = useState(null);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  // Modal Confirmación Admin
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, pedidoId: null });

  const [currentUser, setCurrentUser] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('priusUser'));
    if (user) setCurrentUser(user);
  }, []);

  useEffect(() => {
    if (mensaje) {
      const timer = setTimeout(() => setMensaje(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [mensaje]);

  const handleBuscar = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoadingSearch(true);
    setHasSearched(true);

    const term = `%${searchQuery.trim()}%`;
    
    // 1. DNI y Nombre
    const { data: clientes } = await supabase.from('clientes').select('dni').ilike('nombre', term);
    const dnis = clientes?.map(c => c.dni) || [];
    if (!isNaN(searchQuery.trim())) dnis.push(searchQuery.trim()); 
    // También incluir búsqueda por DNI parcial (LIKE) en clientes
    const { data: clientesDni } = await supabase.from('clientes').select('dni').ilike('dni', term);
    if (clientesDni) clientesDni.forEach(c => { if(!dnis.includes(c.dni)) dnis.push(c.dni); });

    // 2. Instituciones
    const { data: inst } = await supabase.from('instituciones').select('id').ilike('nombre', term);
    const instIds = inst?.map(i => i.id) || [];

    if (dnis.length === 0 && instIds.length === 0) {
      setPedidosEncontrados([]);
      setLoadingSearch(false);
      return;
    }

    let orParts = [];
    if (dnis.length > 0) orParts.push(`cliente_dni.in.(${dnis.join(',')})`);
    if (instIds.length > 0) orParts.push(`institucion_id.in.(${instIds.join(',')})`);

    const { data, error } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, dni), instituciones(nombre), pagos_historial(*)')
      .or(orParts.join(','))
      .order('fecha_creacion', { ascending: false });

    if (!error && data) {
      console.log('[BUSCAR] Resultados de DB:', data.map(p => ({ id: p.id, estado: p.estado, cliente: p.clientes?.nombre })));
      setPedidosEncontrados(data);
    } else console.error(error);
    
    setLoadingSearch(false);
  };

  // REALTIME: Escuchar cambios en la tabla pedidos
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // UPDATE, INSERT, DELETE
          schema: 'public',
          table: 'pedidos',
        },
        (payload) => {
          console.log('[REALTIME] Evento recibido:', payload.eventType, payload);
          console.log('[REALTIME] payload.new:', payload.new);
          // Actualizar el pedido directamente desde el payload — sin stale closure
          if (payload.eventType === 'UPDATE' && payload.new?.id) {
            console.log('[REALTIME] Actualizando pedido id:', payload.new.id, '-> estado:', payload.new.estado);
            setPedidosEncontrados(prev => {
              const existe = prev.some(p => p.id === payload.new.id);
              console.log('[REALTIME] ¿El pedido existe en pantalla?', existe, '| total en pantalla:', prev.length);
              return prev.map(p =>
                p.id === payload.new.id
                  ? { ...p, estado: payload.new.estado, monto_pagado: payload.new.monto_pagado, precio_total: payload.new.precio_total }
                  : p
              );
            });
          } else {
            console.log('[REALTIME] Evento ignorado (no es UPDATE o falta id)');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const abrirModalPago = async (pedido) => {
    setSelectedPedido(pedido);
    setMontoPagar('');
    setMetodoPago('Efectivo');
    setTalonario('');
    setComprobanteFile(null);
    setHistorialVisible(false);
    setPagoError(null);
    setLoadingModal(true);
    
    const { data, error } = await supabase
      .from('pagos_historial')
      .select('*')
      .eq('pedido_id', pedido.id)
      .order('fecha', { ascending: false });
      
    if (!error && data) {
      setHistorialPagos(data);
    } else {
      setHistorialPagos([]);
    }
    setLoadingModal(false);
  };

  const handlePagar = async (e) => {
    e.preventDefault();
    setPagoError(null);
    const monto = parseFloat(montoPagar);
    if (!monto || monto <= 0) return;
    const saldoMax = parseFloat(selectedPedido.precio_total) - parseFloat(selectedPedido.monto_pagado);
    if (monto > saldoMax) {
      setPagoError('El monto ingresado ($' + monto.toFixed(2) + ') supera el saldo pendiente de $' + saldoMax.toFixed(2) + '.');
      return;
    }

    setProcesandoPago(true);

    const nuevoMontoPagado = parseFloat(selectedPedido.monto_pagado) + monto;
    const faltante = parseFloat(selectedPedido.precio_total) - nuevoMontoPagado;

    try {
      // 1. Subir comprobante si hay archivo
      let comprobanteUrl = null;
      if (comprobanteFile) {
        setUploadingComprobante(true);
        const ext = comprobanteFile.name.split('.').pop();
        const path = 'comprobantes/' + selectedPedido.id + '_' + Date.now() + '.' + ext;
        const { error: upErr } = await supabase.storage.from('imagenes').upload(path, comprobanteFile, { contentType: comprobanteFile.type, upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('imagenes').getPublicUrl(path);
          comprobanteUrl = urlData.publicUrl;
        }
        setUploadingComprobante(false);
      }

      // 2. Insertar el historial
      const { error: insertError } = await supabase.from('pagos_historial').insert([{
        pedido_id: selectedPedido.id,
        monto: monto,
        metodo_pago: metodoPago,
        empleado_username: currentUser?.username || 'Desconocido',
        talonario: talonario.trim() || null,
        comprobante_url: comprobanteUrl,
      }]);

      if (insertError) throw insertError;

      // 3. Actualizar el pedido (cambiar estado si estaba pendiente y llega al 50%)
      let nuevoEstado = selectedPedido.estado;
      const porcentajePagado = (nuevoMontoPagado / parseFloat(selectedPedido.precio_total)) * 100;
      const pasaAAutorizado = nuevoEstado === 'Pendiente' && porcentajePagado >= 50;
      
      if (pasaAAutorizado) {
        nuevoEstado = 'Autorizado';
      }

      const { error: updateError } = await supabase.from('pedidos')
        .update({ monto_pagado: nuevoMontoPagado, estado: nuevoEstado })
        .eq('id', selectedPedido.id);

      if (updateError) throw updateError;

      // 4. Loguear el cambio a Autorizado para que aparezca en el timeline
      if (pasaAAutorizado) {
        await supabase.from('pedido_estado_log').insert([{
          pedido_id: selectedPedido.id,
          estado: 'Autorizado',
          empleado_username: currentUser?.username || 'Desconocido'
        }]);
      }

      setMensaje({ tipo: 'success', texto: pasaAAutorizado ? 'Pago registrado — ¡Pedido AUTORIZADO a corte!' : 'Pago registrado con éxito' });
      setSelectedPedido(null);
      // Refrescar resultados de búsqueda para mostrar los montos actualizados
      document.getElementById('form-busqueda').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setProcesandoPago(false);
    }
  };

  const toggleCard = (id) => {
    setExpandedCards(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]);
  };

  const adjuntarComprobanteAPago = async (pagoId, pedidoId, file) => {
    if (!file) return;
    setUploadingComprobanteId(pagoId);
    const ext = file.name.split('.').pop();
    const path = 'comprobantes/' + pedidoId + '_' + pagoId + '_' + Date.now() + '.' + ext;
    const { error: upErr } = await supabase.storage.from('imagenes').upload(path, file, { contentType: file.type, upsert: true });
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('imagenes').getPublicUrl(path);
      const url = urlData.publicUrl;
      await supabase.from('pagos_historial').update({ comprobante_url: url }).eq('id', pagoId);
      // Actualizar estado local del modal
      setHistorialPagos(prev => prev.map(p => p.id === pagoId ? { ...p, comprobante_url: url } : p));
      // Actualizar estado local de las cards inline
      setPedidosEncontrados(prev => prev.map(p => p.id === pedidoId
        ? { ...p, pagos_historial: (p.pagos_historial || []).map(h => h.id === pagoId ? { ...h, comprobante_url: url } : h) }
        : p
      ));
    }
    setUploadingComprobanteId(null);
  };

  const confirmarForzarAutorizacion = (pedidoId) => {
    setConfirmModal({ isOpen: true, pedidoId });
  };

  const ejecutarForzarAutorizacion = async () => {
    const pedidoId = confirmModal.pedidoId;
    setConfirmModal({ isOpen: false, pedidoId: null });
    
    try {
      // 1. Dejar registro (Trazabilidad estricta) en el historial
      const { error: insertError } = await supabase.from('pagos_historial').insert([{
        pedido_id: pedidoId,
        monto: 0,
        metodo_pago: 'AUTORIZACIÓN EXCEPCIONAL',
        empleado_username: currentUser?.username || 'Desconocido'
      }]);

      if (insertError) throw insertError;

      // 2. Cambiar el estado
      const { error } = await supabase.from('pedidos')
        .update({ estado: 'Autorizado' })
        .eq('id', pedidoId);
        
      if (error) throw error;
      
      setMensaje({ tipo: 'success', texto: 'Pedido forzado a Autorizado y auditado correctamente.' });
      document.getElementById('form-busqueda').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  const finalizarEntrega = async (pedidoId) => {
    setProcesandoPago(true);
    const user = JSON.parse(localStorage.getItem('priusUser'));
    
    try {
      const { error } = await supabase.from('pedidos')
        .update({ estado: 'Entregado' })
        .eq('id', pedidoId);

      if (error) throw error;

      await supabase.from('pedido_estado_log').insert([{
        pedido_id: pedidoId,
        estado: 'Entregado',
        empleado_username: user?.username || 'Desconocido'
      }]);

      setMensaje({ tipo: 'success', texto: '¡Pedido entregado y finalizado con éxito!' });
      document.getElementById('form-busqueda').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setProcesandoPago(false);
    }
  };

  const renderProgressBar = (porcentaje) => {
    const color = porcentaje >= 100 ? 'var(--accent)' : porcentaje >= 50 ? '#60A5FA' : porcentaje >= 25 ? '#FACC15' : 'var(--danger)';
    return (
      <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
          <span>Pago del total</span>
          <span style={{ color, fontWeight: 'bold' }}>{porcentaje.toFixed(0)}%</span>
        </div>
        <div style={{ width: '100%', height: '8px', background: 'var(--track-color)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(porcentaje, 100)}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.3s' }}></div>
        </div>
      </div>
    );
  };

  const renderStatusBar = (estadoActual) => {
    console.log('[STATUS BAR] estadoActual recibido:', estadoActual);
    const steps = [
      { id: 'Ingresado',             labels: ['Pendiente', 'Autorizado'] },
      { id: 'En Corte',              labels: ['En Corte'] },
      { id: 'Corte Finalizado',      labels: ['Corte Finalizado'] },
      { id: 'En Confección',         labels: ['En Confección'] },
      { id: 'Confec. Finalizada',    labels: ['Confección Finalizada'] },
      { id: 'En Bordado',            labels: ['En Bordado'] },
      { id: 'Bord. Finalizado',      labels: ['Bordado Finalizado'] },
      { id: 'Entregado',             labels: ['Entregado'] }
    ];

    let currentStepIndex = 0;
    steps.forEach((step, index) => {
      if (step.labels.includes(estadoActual)) {
        currentStepIndex = index;
      }
    });
    console.log('[STATUS BAR] currentStepIndex calculado:', currentStepIndex, '| paso:', steps[currentStepIndex]?.id);

    if (isMobile) {
      return (
        <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-dark)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estado actual:</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 'bold', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
              {estadoActual}
            </span>
          </div>
          <div style={{ height: '4px', background: 'var(--track-color)', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ 
              position: 'absolute', left: 0, top: 0, bottom: 0, 
              width: `${((currentStepIndex + 1) / steps.length) * 100}%`, 
              background: 'var(--primary)', transition: 'width 0.5s ease' 
            }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <span>Inicio</span>
            <span>{steps[currentStepIndex].id}</span>
            <span>Fin</span>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
        {steps.map((step, index) => {
          const isCompleted = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;
          return (
            <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
              {/* Línea conectora */}
              {index !== 0 && (
                <div style={{ position: 'absolute', left: '-50%', top: '10px', right: '50%', height: '2px', background: isCompleted ? 'var(--primary)' : 'var(--track-color)', zIndex: 0 }}></div>
              )}
              {/* Círculo */}
              <div style={{ 
                width: '20px', height: '20px', borderRadius: '50%', zIndex: 1,
                background: isCurrent ? 'var(--accent)' : (isCompleted ? 'var(--primary)' : 'var(--bg-sidebar)'),
                border: `2px solid ${isCompleted ? (isCurrent ? 'var(--accent)' : 'var(--primary)') : 'var(--border-color)'}`,
                marginBottom: '4px'
              }}></div>
              <span style={{ fontSize: '0.7rem', color: isCurrent ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: isCurrent ? 'bold' : 'normal', textAlign: 'center' }}>
                {step.id}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Gestión de Cobranzas</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Busca un pedido por DNI, Nombre o Escuela para registrar un pago parcial o total.</p>

      {/* Toast Notification flotante */}
      {mensaje && (
        <div style={{ 
          position: 'fixed', bottom: '20px', right: '20px', padding: '1rem 2rem', 
          borderRadius: '8px', backgroundColor: mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)',
          color: 'white', fontWeight: '500', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', zIndex: 10000
        }}>
          {mensaje.texto}
        </div>
      )}

      {/* Buscador Central */}
      <div style={{ background: 'var(--bg-sidebar)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '2rem', textAlign: 'center' }}>
        <form id="form-busqueda" onSubmit={handleBuscar} style={{ display: 'flex', gap: '1rem', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Ingresa DNI, Nombre o Escuela..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              style={{ paddingLeft: '45px', height: '50px', fontSize: '1.1rem', borderRadius: '8px' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loadingSearch} style={{ padding: '0 2rem', height: '50px', borderRadius: '8px' }}>
            {loadingSearch ? 'Buscando...' : 'Buscar'}
          </button>
        </form>
      </div>

      {/* Resultados */}
      {hasSearched && (
        <div>
          <h3 style={{ marginBottom: '1rem' }}>Resultados ({pedidosEncontrados.length})</h3>
          {pedidosEncontrados.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', color: 'var(--text-muted)' }}>
              No se encontraron pedidos con ese término. Revisa la ortografía o intenta con el DNI exacto.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {pedidosEncontrados.map(pedido => {
                const total = parseFloat(pedido.precio_total);
                const pagado = parseFloat(pedido.monto_pagado);
                const faltante = total - pagado;
                const estaPagado = faltante <= 0;
                
                const porcentaje = total > 0 ? (pagado / total) * 100 : 0;
                const alcanzaCorte = porcentaje >= 50 || pedido.estado !== 'Pendiente';
                const isExpanded = expandedCards.includes(pedido.id);
                
                // Ordenar pagos del más reciente al más antiguo
                const pagosHistorial = pedido.pagos_historial ? 
                  [...pedido.pagos_historial].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)) : [];

                return (
                  <div key={pedido.id} style={{ 
                    display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-sidebar)', padding: isMobile ? '1rem' : '1.5rem', 
                    borderRadius: '8px', border: `1px solid ${estaPagado ? 'var(--accent)' : 'var(--border-color)'}`
                  }}>
                    {/* Encabezado: Info del cliente y botón de historial */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '4px' }}>{pedido.clientes?.nombre} <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>({pedido.clientes?.dni})</span></h4>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          {pedido.instituciones?.nombre} • {pedido.tipo_prenda} ({pedido.talle})
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleCard(pedido.id)}
                        style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.5rem 0.75rem', flexShrink: 0 }}
                      >
                        {isExpanded ? <><ChevronUp size={18} /> <span className="hide-on-mobile">Ocultar Historial</span></> : <><ChevronDown size={18} /> <span className="hide-on-mobile">Ver Historial</span></>}
                      </button>
                    </div>

                    {/* Fila del progreso y estado */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ width: '100%' }}>
                        {renderProgressBar(porcentaje)}
                        {isMobile ? (
                          renderStatusBar(pedido.estado)
                        ) : (
                          <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
                            <div style={{ minWidth: '600px' }}>
                              {renderStatusBar(pedido.estado)}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div style={{ 
                        width: '100%', display: 'flex', flexDirection: isMobile ? 'column' : 'row', 
                        alignItems: isMobile ? 'stretch' : 'center', 
                        justifyContent: 'space-between', gap: '1.25rem', marginTop: '0.5rem',
                        borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Saldo Pendiente</div>
                            <div style={{ fontSize: isMobile ? '1.75rem' : '1.5rem', fontWeight: 'bold', color: estaPagado ? 'var(--accent)' : 'var(--danger)' }}>
                              ${faltante.toFixed(2)}
                            </div>
                          </div>
                          
                          {estaPagado && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                              TOTALMENTE PAGADO
                            </div>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: isMobile ? 'none' : 1, maxWidth: isMobile ? 'none' : '300px', marginLeft: isMobile ? 0 : 'auto' }}>
                          <button 
                            className="btn btn-primary" 
                            style={{ 
                              background: estaPagado ? 'rgba(255, 255, 255, 0.05)' : 'var(--primary)', 
                              color: estaPagado ? 'var(--text-muted)' : 'white',
                              border: estaPagado ? '1px solid var(--border-color)' : 'none',
                              width: '100%',
                              padding: '0.8rem'
                            }}
                            onClick={() => abrirModalPago(pedido)}
                          >
                            {estaPagado ? 'Ver Recibos / Detalles' : 'Registrar Nuevo Pago'}
                          </button>

                          {/* Botón de Entrega: Solo si está pagado y terminó producción */}
                          {estaPagado && pedido.estado === 'Bordado Finalizado' && (
                            <button 
                              className="btn"
                              onClick={() => finalizarEntrega(pedido.id)}
                              disabled={procesandoPago}
                              style={{ 
                                background: 'var(--accent)', color: 'white', 
                                width: '100%', fontWeight: 'bold', border: 'none',
                                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                              }}
                            >
                              <PackageCheck size={16} /> Entregar Pedido
                            </button>
                          )}

                          {/* Botón exclusivo de Administrador para forzar corte si no alcanza el 50% */}
                          {!alcanzaCorte && currentUser?.rol === 'admin' && (
                            <button 
                              onClick={() => confirmarForzarAutorizacion(pedido.id)}
                              style={{ 
                                background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', 
                                border: '1px solid var(--danger)', borderRadius: '6px', padding: '0.75rem 1rem', 
                                fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold', width: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                              }}
                            >
                              <AlertTriangle size={16} /> Forzar Autorización Excepcional
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Fila de Historial de Pagos (Colapsable) */}
                    {isExpanded && pagosHistorial.length > 0 && (
                      <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)' }}>
                        <h5 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Historial de Movimientos</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {pagosHistorial.map(pago => {
                            const esExcepcion = pago.metodo_pago === 'AUTORIZACIÓN EXCEPCIONAL';
                            return (
                              <div key={pago.id} style={{ 
                                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', 
                                background: esExcepcion ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.02)', 
                                padding: '0.5rem 0.8rem', borderRadius: '4px', fontSize: '0.85rem',
                                border: esExcepcion ? '1px solid rgba(239, 68, 68, 0.3)' : 'none'
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 'bold', color: esExcepcion ? 'var(--danger)' : 'var(--accent)' }}>
                                      {esExcepcion ? <><AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> EXCEPCIÓN</> : '+ $' + pago.monto}
                                    </span>
                                    {!esExcepcion && (
                                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <CreditCard size={12} /> {pago.metodo_pago}
                                      </span>
                                    )}
                                  </div>
                                  {pago.talonario && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      <Hash size={10} /> Tal. <strong style={{ color: 'var(--text-main)' }}>{pago.talonario}</strong>
                                    </span>
                                  )}
                                  {pago.comprobante_url ? (
                                    <a href={pago.comprobante_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none' }}>
                                      <ExternalLink size={10} /> Ver comprobante
                                    </a>
                                  ) : !esExcepcion && pago.metodo_pago === 'Transferencia' && (
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', color: uploadingComprobanteId === pago.id ? 'var(--text-muted)' : 'var(--primary)', cursor: 'pointer', textDecoration: 'underline dotted' }}>
                                      <Paperclip size={10} /> {uploadingComprobanteId === pago.id ? 'Subiendo...' : 'Adjuntar comprobante'}
                                      <input type="file" accept="image/*,.pdf" hidden onChange={(e) => adjuntarComprobanteAPago(pago.id, pedido.id, e.target.files[0])} />
                                    </label>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', color: esExcepcion ? 'var(--danger)' : 'var(--text-muted)', alignItems: 'center', flexShrink: 0, marginLeft: '0.5rem' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {new Date(pago.fecha).toLocaleDateString()} {new Date(pago.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}><User size={12} /> {pago.empleado_username}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Pago / Historial */}
      {selectedPedido && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-dark)', padding: '2rem', borderRadius: '12px', 
            maxWidth: '600px', width: '100%', border: '1px solid var(--border-color)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ color: 'var(--text-main)', margin: 0 }}>Estado de Cuenta</h3>
              <button className="btn" style={{ padding: '0.5rem', background: 'transparent', color: 'var(--text-muted)' }} onClick={() => setSelectedPedido(null)}>Cerrar</button>
            </div>

            <div style={{ background: 'var(--bg-dark)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Precio Total:</span>
                <span style={{ fontWeight: 'bold' }}>${selectedPedido.precio_total}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Abonado hasta ahora:</span>
                <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>${selectedPedido.monto_pagado}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>Saldo Pendiente:</span>
                <span style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '1.2rem' }}>
                  ${(parseFloat(selectedPedido.precio_total) - parseFloat(selectedPedido.monto_pagado)).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Formulario de Nuevo Pago — siempre arriba */}
            {(parseFloat(selectedPedido.precio_total) - parseFloat(selectedPedido.monto_pagado)) > 0 && (
              <form onSubmit={handlePagar} style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Registrar Nuevo Pago</h4>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Monto a Pagar ($)</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      required 
                      min="1" 
                      value={montoPagar} 
                      onChange={e => { setMontoPagar(e.target.value); if (pagoError) setPagoError(null); }} 
                      style={pagoError ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 3px rgba(239,68,68,0.15)' } : {}}
                    />
                    {pagoError && (
                      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '8px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                        <AlertTriangle size={14} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '1px' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--danger)', lineHeight: '1.4' }}>{pagoError}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Método de Pago</label>
                    <select className="form-control" value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Tarjeta">Tarjeta / Posnet</option>
                    </select>
                  </div>
                </div>

                {/* Talonario */}
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    <Hash size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />N° Talonario
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej: 00234"
                    value={talonario}
                    onChange={e => setTalonario(e.target.value)}
                  />
                </div>

                {/* Comprobante (solo transferencia) */}
                {metodoPago === 'Transferencia' && (
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      <Paperclip size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      Comprobante de transferencia <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>(opcional)</span>
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px dashed var(--border-color)', cursor: 'pointer', fontSize: '0.85rem', color: comprobanteFile ? 'var(--accent)' : 'var(--text-muted)', background: comprobanteFile ? 'rgba(16,185,129,0.06)' : 'transparent', width: '100%', boxSizing: 'border-box' }}>
                      <Paperclip size={14} />
                      {comprobanteFile ? comprobanteFile.name : 'Seleccionar imagen o PDF'}
                      <input type="file" accept="image/*,.pdf" hidden onChange={(e) => setComprobanteFile(e.target.files[0] || null)} />
                    </label>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', height: '45px' }} disabled={procesandoPago || uploadingComprobante}>
                  {uploadingComprobante ? 'Subiendo comprobante...' : procesandoPago ? 'Procesando...' : 'Confirmar Pago de $' + (montoPagar || '0')}
                </button>
              </form>
            )}

            {/* Historial de Pagos — colapsable, cerrado por defecto */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button
                onClick={() => setHistorialVisible(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem 0', marginBottom: historialVisible ? '1rem' : 0 }}
              >
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Historial de movimientos {historialPagos.length > 0 && '(' + historialPagos.length + ')'}
                </span>
                {historialVisible ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
              </button>

              {historialVisible && (
                loadingModal ? (
                  <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>Cargando recibos...</p>
                ) : historialPagos.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-sidebar)', borderRadius: '6px', color: 'var(--text-muted)' }}>No hay pagos registrados para este pedido.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {historialPagos.map(pago => {
                      const esExcepcion = pago.metodo_pago === 'AUTORIZACIÓN EXCEPCIONAL';
                      return (
                        <div key={pago.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: esExcepcion ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-sidebar)', padding: '1rem', borderRadius: '6px', border: esExcepcion ? '1px solid rgba(239, 68, 68, 0.3)' : 'none' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: esExcepcion ? 'var(--danger)' : 'var(--accent)' }}>
                              {esExcepcion ? <><AlertTriangle size={16} style={{ verticalAlign: 'middle' }} /> AUTORIZACIÓN MANUAL (SIN PAGO)</> : <><DollarSign size={16} /> ${pago.monto}</>}
                            </div>
                            {!esExcepcion && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                <CreditCard size={12} /> {pago.metodo_pago}
                              </div>
                            )}
                            {pago.talonario && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                <Hash size={11} /> Tal. <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{pago.talonario}</span>
                              </div>
                            )}
                            {pago.comprobante_url ? (
                              <a href={pago.comprobante_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--primary)', marginTop: '4px', textDecoration: 'none' }}>
                                <ExternalLink size={11} /> Ver comprobante
                              </a>
                            ) : !esExcepcion && pago.metodo_pago === 'Transferencia' && (
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: uploadingComprobanteId === pago.id ? 'var(--text-muted)' : 'var(--primary)', marginTop: '4px', cursor: 'pointer', textDecoration: 'underline dotted' }}>
                                <Paperclip size={11} /> {uploadingComprobanteId === pago.id ? 'Subiendo...' : 'Adjuntar comprobante'}
                                <input type="file" accept="image/*,.pdf" hidden onChange={(e) => adjuntarComprobanteAPago(pago.id, selectedPedido?.id, e.target.files[0])} />
                              </label>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '0.8rem', color: esExcepcion ? 'var(--danger)' : 'var(--text-muted)', flexShrink: 0, marginLeft: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                              <Clock size={12} /> {new Date(pago.fecha).toLocaleString()}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontWeight: 'bold' }}>
                              <User size={12} /> {pago.empleado_username}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Forzar Autorización */}
      {confirmModal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-sidebar)', padding: '2.5rem', borderRadius: '12px', 
            maxWidth: '450px', width: '100%', border: '1px solid var(--danger)', textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)'
          }}>
            <h2 style={{ color: 'var(--danger)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><AlertTriangle size={22} /> Advertencia de Seguridad</h2>
            <p style={{ color: 'var(--text-main)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Estás a punto de saltarte la barrera financiera del 50%. El pedido pasará a la mesa de corte a pesar de no haber cumplido con el pago estipulado.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
              Esta acción quedará registrada permanentemente en el historial bajo tu nombre ({currentUser?.username}).
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn" 
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'white' }}
                onClick={() => setConfirmModal({ isOpen: false, pedidoId: null })}
              >
                Cancelar
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, background: 'var(--danger)', color: 'white' }}
                onClick={ejecutarForzarAutorizacion}
              >
                Sí, Forzar Autorización
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Pagos;
