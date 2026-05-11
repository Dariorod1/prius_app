import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const Empleados = () => {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    rol: 'operador'
  });

  useEffect(() => {
    fetchEmpleados();
  }, []);

  useEffect(() => {
    if (mensaje) {
      const timer = setTimeout(() => setMensaje(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [mensaje]);

  const fetchEmpleados = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('empleados').select('*').order('username');
    if (!error && data) setEmpleados(data);
    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEmailBlur = (e) => {
    // Si el usuario aún no escribió nada en 'username', lo autogeneramos
    if (!formData.username && e.target.value) {
      const suggestedUsername = e.target.value.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      setFormData(prev => ({ ...prev, username: suggestedUsername }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.email) return;

    setLoading(true);
    // Auto-generar contraseña: prius-[username]
    const defaultPassword = `prius-${formData.username}`;
    
    const { error } = await supabase.from('empleados').insert([{ 
      email: formData.email,
      username: formData.username,
      rol: formData.rol,
      password: defaultPassword, // Contraseña generada automáticamente
      activo: true
    }]);
    
    if (error) {
      setMensaje({ tipo: 'error', texto: "Error al crear: " + error.message });
    } else {
      setMensaje({ tipo: 'success', texto: `Empleado creado. Clave: ${defaultPassword}` });
      setFormData({ email: '', username: '', rol: 'operador' });
      fetchEmpleados();
    }
    setLoading(false);
  };

  const toggleActivo = async (id, estadoActual) => {
    const { error } = await supabase.from('empleados').update({ activo: !estadoActual }).eq('id', id);
    if (!error) fetchEmpleados();
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar a este empleado?")) return;
    const { error } = await supabase.from('empleados').delete().eq('id', id);
    if (error) setMensaje({ tipo: 'error', texto: "No se pudo eliminar." });
    else fetchEmpleados();
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Gestión de Empleados</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Da de alta nuevos usuarios y asigna sus roles. Las contraseñas se autogeneran.</p>

      {mensaje && (
        <div style={{ 
          padding: '1rem', marginBottom: '1.5rem', borderRadius: '6px',
          backgroundColor: mensaje.tipo === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)',
          border: `1px solid ${mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)'}`
        }}>
          {mensaje.texto}
        </div>
      )}

      {/* Formulario Agregar */}
      <div style={{ background: 'var(--bg-sidebar)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Alta de Empleado</h3>
        <form onSubmit={handleSubmit} className="form-grid" style={{ alignItems: 'flex-end' }}>
          <div className="form-group">
            <label>Correo Electrónico</label>
            <input type="email" name="email" className="form-control" value={formData.email} onChange={handleChange} onBlur={handleEmailBlur} required placeholder="ej: juan@prius.com" />
          </div>
          <div className="form-group">
            <label>Usuario (Login)</label>
            <input type="text" name="username" className="form-control" value={formData.username} onChange={handleChange} required placeholder="ej: juan" />
          </div>
          <div className="form-group">
            <label>Rol</label>
            <select name="rol" className="form-control" value={formData.rol} onChange={handleChange} required>
              <option value="admin">Administrador</option>
              <option value="operador">Operador (Oficina)</option>
              <option value="cortador">Mesa de Corte</option>
              <option value="confeccion">Confeccionista</option>
              <option value="bordador">Bordador</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: '42px', marginTop: 'auto', marginBottom: '0.5rem' }}>+ Crear Empleado</button>
        </form>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          La contraseña será <strong style={{ color: 'var(--accent)' }}>prius-[usuario]</strong> por defecto.
        </p>
      </div>

      {/* Tabla Empleados */}
      <div style={{ background: 'var(--bg-sidebar)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '1rem' }}>Usuario</th>
              <th style={{ padding: '1rem' }}>Correo</th>
              <th style={{ padding: '1rem' }}>Rol</th>
              <th style={{ padding: '1rem' }}>Estado</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && empleados.length === 0 ? (
              <tr><td colSpan="5" className="center-content">Cargando empleados...</td></tr>
            ) : empleados.length === 0 ? (
              <tr><td colSpan="5" className="center-content">No hay empleados cargados.</td></tr>
            ) : (
              empleados.map(emp => (
                <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td data-label="Usuario" style={{ padding: '1rem', fontWeight: 'bold' }}>{emp.username}</td>
                  <td data-label="Correo" style={{ padding: '1rem', color: 'var(--text-muted)' }}>{emp.email}</td>
                  <td data-label="Rol" style={{ padding: '1rem' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA' }}>
                      {emp.rol}
                    </span>
                  </td>
                  <td data-label="Estado" style={{ padding: '1rem' }}>
                    <span style={{ color: emp.activo ? 'var(--accent)' : 'var(--danger)' }}>{emp.activo ? 'Activo' : 'Suspendido'}</span>
                  </td>
                  <td data-label="Acciones" style={{ padding: '1rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button className="btn" style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.1)' }} onClick={() => toggleActivo(emp.id, emp.activo)}>
                      {emp.activo ? 'Suspender' : 'Activar'}
                    </button>
                    <button className="btn" style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }} onClick={() => handleEliminar(emp.id)}>
                      Borrar
                    </button>
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

export default Empleados;
