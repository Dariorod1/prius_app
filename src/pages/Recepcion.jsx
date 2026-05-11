import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CheckCircle, XCircle } from 'lucide-react';

const Recepcion = () => {
  const [instituciones, setInstituciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [confirmModal, setConfirmModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    dni: '',
    nombre_cliente: '',
    telefono: '',
    institucion_nombre: '',
    institucion_id: '',
    tipo_prenda: '',
    talle: '',
    nombre_bordado: '',
    observaciones: '',
    precio_total: '',
    monto_pagado: ''
  });

  useEffect(() => {
    // Cargar las escuelas para el selector
    async function fetchInstituciones() {
      const { data } = await supabase.from('instituciones').select('*').order('nombre');
      if (data) setInstituciones(data);
    }
    fetchInstituciones();
  }, []);

  // Auto-ocultar la notificación toast después de 4 segundos
  useEffect(() => {
    if (mensaje) {
      const timer = setTimeout(() => {
        setMensaje(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [mensaje]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setConfirmModal(true); // En lugar de guardar, abrimos el modal
  };

  const confirmarPedido = async () => {
    setLoading(true);
    setMensaje(null);

    try {
      // 1. Intentar crear o actualizar el cliente (Upsert por DNI)
      const { error: clienteError } = await supabase
        .from('clientes')
        .upsert({ 
          dni: formData.dni, 
          nombre: formData.nombre_cliente, 
          telefono: formData.telefono 
        });

      if (clienteError) throw new Error("Error al guardar cliente: " + clienteError.message);

      // 2. Crear el pedido
      const precioTotal  = parseFloat(formData.precio_total) || 0;
      const montoPagado  = parseFloat(formData.monto_pagado) || 0;
      const alcanza50    = precioTotal > 0 && montoPagado >= precioTotal * 0.5;

      const nuevoPedido = {
        cliente_dni: formData.dni,
        institucion_id: formData.institucion_id || null,
        tipo_prenda: formData.tipo_prenda,
        talle: formData.talle,
        nombre_bordado: formData.nombre_bordado || null,
        observaciones: formData.observaciones || null,
        precio_total: precioTotal,
        monto_pagado: montoPagado,
        estado: alcanza50 ? 'Autorizado' : 'Pendiente'
      };

      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .insert([nuevoPedido])
        .select('id')
        .single();

      if (pedidoError) throw new Error("Error al crear pedido: " + pedidoError.message);

      // 3. Registrar el pago inicial en historial y loguear estado si corresponde
      const user = JSON.parse(localStorage.getItem('priusUser'));
      if (montoPagado > 0) {
        await supabase.from('pagos_historial').insert([{
          pedido_id: pedidoData.id,
          monto: montoPagado,
          metodo_pago: 'Efectivo',
          empleado_username: user?.username || 'Recepción'
        }]);
      }

      // Si nació directamente como Autorizado, registrarlo en el log de estados
      if (alcanza50) {
        await supabase.from('pedido_estado_log').insert([{
          pedido_id: pedidoData.id,
          estado: 'Autorizado',
          empleado_username: user?.username || 'Recepción'
        }]);
      }

      setMensaje({ tipo: 'success', texto: '¡Pedido creado con éxito!' });
      
      // Limpiar formulario por completo para el siguiente cliente
      setFormData({
        dni: '',
        nombre_cliente: '',
        telefono: '',
        institucion_nombre: '',
        institucion_id: '',
        tipo_prenda: '',
        talle: '',
        nombre_bordado: '',
        observaciones: '',
        precio_total: '',
        monto_pagado: ''
      });

    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setLoading(false);
      setConfirmModal(false);
      
      // Hacemos scroll hacia arriba pero apuntando al contenedor correcto (.main-content)
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--primary)', margin: 0 }}>Nueva Recepción</h1>
        <button className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.85rem' }}>
          + Importar CSV (Excel)
        </button>
      </div>
      
      {/* Toast Notification (Pop-up) flotante */}
      {mensaje && (
        <div style={{ 
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '1rem 2rem', 
          borderRadius: '8px',
          backgroundColor: mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)',
          color: 'white',
          fontWeight: '500',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {mensaje.tipo === 'success' ? <CheckCircle size={18} style={{ flexShrink: 0 }} /> : <XCircle size={18} style={{ flexShrink: 0 }} />} {mensaje.texto}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-container" style={{ background: 'var(--bg-sidebar)', padding: '2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        
        <div className="recepcion-form-layout">
          {/* Columna 1: Cliente */}
          <div className="form-section">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>1. Datos del Cliente</h3>
            <div className="form-group">
              <label>DNI</label>
              <input type="text" name="dni" required className="form-control" value={formData.dni} onChange={handleChange} placeholder="Ej: 35123456" />
            </div>
            <div className="form-group">
              <label>Nombre Completo</label>
              <input type="text" name="nombre_cliente" required className="form-control" value={formData.nombre_cliente} onChange={handleChange} placeholder="Ej: Juan Pérez" />
            </div>
            <div className="form-group">
              <label>Teléfono (Opcional)</label>
              <input type="text" name="telefono" className="form-control" value={formData.telefono} onChange={handleChange} placeholder="Ej: 351-555-0000" />
            </div>
          </div>

          {/* Columna 2: Prenda */}
          <div className="form-section">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>2. Detalles de Prenda</h3>
            <div className="form-group">
              <label>Institución / Escuela</label>
              <input 
                type="text" 
                required 
                className="form-control" 
                list="escuelas-recepcion-list"
                placeholder="Escribe para buscar..."
                value={formData.institucion_nombre}
                onChange={(e) => {
                  const val = e.target.value;
                  const coincidencia = instituciones.find(i => i.nombre.toLowerCase() === val.toLowerCase());
                  setFormData({
                    ...formData,
                    institucion_nombre: val,
                    institucion_id: coincidencia ? coincidencia.id : ''
                  });
                }}
              />
              {/* Mensaje de validación visual si la escuela no existe en BD */}
              {formData.institucion_nombre && !formData.institucion_id && (
                <span style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '4px', display: 'block' }}>
                  Debe seleccionar una escuela válida de la lista.
                </span>
              )}
              <datalist id="escuelas-recepcion-list">
                {instituciones.map(inst => (
                  <option key={inst.id} value={inst.nombre} />
                ))}
              </datalist>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Prenda</label>
                <input type="text" name="tipo_prenda" required className="form-control" value={formData.tipo_prenda} onChange={handleChange} placeholder="Ej: Chomba" />
              </div>
              <div className="form-group">
                <label>Talle</label>
                <select name="talle" required className="form-control" value={formData.talle} onChange={handleChange}>
                  <option value="">-- Talle --</option>
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                  <option value="A Medida">A Medida</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Nombre a Bordar (Opcional)</label>
              <input type="text" name="nombre_bordado" className="form-control" value={formData.nombre_bordado} onChange={handleChange} placeholder="Ej: MERY" />
            </div>
          </div>

          {/* Columna 3: Pagos y Obs */}
          <div className="form-section">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>3. Pagos y Notas</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Precio Total ($)</label>
                <input type="number" name="precio_total" required className="form-control" value={formData.precio_total} onChange={handleChange} min="0" />
              </div>
              <div className="form-group">
                <label>Monto Pagado ($)</label>
                <input type="number" name="monto_pagado" required className="form-control" value={formData.monto_pagado} onChange={handleChange} min="0" />
              </div>
            </div>
            <div className="form-group">
              <label>Observaciones</label>
              <textarea name="observaciones" className="form-control" value={formData.observaciones} onChange={handleChange} placeholder="Ej: Puño extra ajustado..."></textarea>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'right', padding: '1rem', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '8px' }}>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', maxWidth: '300px', fontSize: '1.1rem' }}>
            Revisar y Confirmar
          </button>
        </div>
      </form>

      {/* Modal de Confirmación */}
      {confirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-sidebar)', padding: '2rem', borderRadius: '8px', 
            maxWidth: '500px', width: '100%', border: '1px solid var(--border-color)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
             <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Confirmar Nuevo Pedido</h3>
             <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Verifica los datos antes de cargarlos al sistema:</p>
             
             <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', color: 'var(--text-main)', display: 'grid', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '6px' }}>
               <li><strong>Cliente:</strong> {formData.nombre_cliente} ({formData.dni})</li>
               <li><strong>Prenda:</strong> {formData.tipo_prenda} - Talle: {formData.talle}</li>
               <li><strong>Pagado:</strong> ${formData.monto_pagado} de ${formData.precio_total}</li>
             </ul>

             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
               <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} onClick={() => setConfirmModal(false)}>
                 Cancelar
               </button>
               <button type="button" className="btn btn-primary" onClick={confirmarPedido} disabled={loading}>
                 {loading ? 'Guardando...' : 'Sí, Crear Pedido'}
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recepcion;
