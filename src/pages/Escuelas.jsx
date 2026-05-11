import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const Escuelas = () => {
  const [escuelas, setEscuelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nombreNueva, setNombreNueva] = useState('');
  const [mensaje, setMensaje] = useState(null);

  // Modo edición
  const [editandoId, setEditandoId] = useState(null);
  const [nombreEdicion, setNombreEdicion] = useState('');

  useEffect(() => {
    fetchEscuelas();
  }, []);

  // Mostrar mensaje flotante (Toast)
  useEffect(() => {
    if (mensaje) {
      const timer = setTimeout(() => setMensaje(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [mensaje]);

  const fetchEscuelas = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('instituciones').select('*').order('nombre');
    if (!error && data) setEscuelas(data);
    setLoading(false);
  };

  const handleAgregar = async (e) => {
    e.preventDefault();
    if (!nombreNueva.trim()) return;

    setLoading(true);
    const { error } = await supabase.from('instituciones').insert([{ nombre: nombreNueva.trim() }]);
    
    if (error) {
      setMensaje({ tipo: 'error', texto: error.message });
    } else {
      setMensaje({ tipo: 'success', texto: 'Escuela agregada' });
      setNombreNueva('');
      fetchEscuelas();
    }
    setLoading(false);
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar esta escuela? Esto puede fallar si hay pedidos asociados.")) return;
    
    setLoading(true);
    const { error } = await supabase.from('instituciones').delete().eq('id', id);
    
    if (error) {
      setMensaje({ tipo: 'error', texto: "No se puede eliminar: Probablemente haya pedidos usando esta escuela." });
    } else {
      setMensaje({ tipo: 'success', texto: 'Escuela eliminada' });
      fetchEscuelas();
    }
    setLoading(false);
  };

  const iniciarEdicion = (escuela) => {
    setEditandoId(escuela.id);
    setNombreEdicion(escuela.nombre);
  };

  const guardarEdicion = async () => {
    if (!nombreEdicion.trim()) return;
    setLoading(true);
    
    const { error } = await supabase.from('instituciones').update({ nombre: nombreEdicion.trim() }).eq('id', editandoId);
    
    if (error) {
      setMensaje({ tipo: 'error', texto: error.message });
    } else {
      setMensaje({ tipo: 'success', texto: 'Escuela actualizada' });
      setEditandoId(null);
      fetchEscuelas();
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Gestión de Escuelas</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Añade, edita o elimina las instituciones disponibles en el sistema.</p>

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

      {/* Formulario Agregar */}
      <div style={{ background: 'var(--bg-sidebar)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Agregar Nueva</h3>
        <form onSubmit={handleAgregar} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Nombre de la Institución</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Ej: Colegio San Martín" 
              value={nombreNueva} 
              onChange={(e) => setNombreNueva(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" className="btn btn-primary btn-desktop-h" disabled={loading}>+ Guardar</button>
        </form>
      </div>

      {/* Lista de Escuelas */}
      <div style={{ background: 'var(--bg-sidebar)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '1rem', width: 'auto' }}>Nombre de la Escuela</th>
              <th style={{ padding: '1rem', width: '200px', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && escuelas.length === 0 ? (
              <tr><td colSpan="2" className="center-content">Cargando escuelas...</td></tr>
            ) : escuelas.length === 0 ? (
              <tr><td colSpan="2" className="center-content">No hay escuelas cargadas.</td></tr>
            ) : (
              escuelas.map(escuela => (
                <tr key={escuela.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td data-label="Nombre" style={{ padding: '1rem' }}>
                    {editandoId === escuela.id ? (
                      <input 
                        type="text" 
                        className="form-control" 
                        value={nombreEdicion} 
                        onChange={(e) => setNombreEdicion(e.target.value)} 
                        autoFocus
                      />
                    ) : (
                      <strong style={{ color: 'var(--text-main)' }}>{escuela.nombre}</strong>
                    )}
                  </td>
                  <td data-label="Acciones" style={{ padding: '1rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    {editandoId === escuela.id ? (
                      <>
                        <button className="btn" style={{ padding: '0.5rem 1rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }} onClick={() => setEditandoId(null)}>Cancelar</button>
                        <button className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={guardarEdicion}>✔ Guardar</button>
                      </>
                    ) : (
                      <>
                        <button className="btn" style={{ padding: '0.5rem 1rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA' }} onClick={() => iniciarEdicion(escuela)}>Editar</button>
                        <button className="btn" style={{ padding: '0.5rem 1rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }} onClick={() => handleEliminar(escuela.id)}>Borrar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Escuelas;
