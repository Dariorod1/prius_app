import { useState } from 'react';
import { supabase } from '../supabaseClient';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Autenticación contra la tabla 'empleados'
    const { data, error: fetchError } = await supabase
      .from('empleados')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (fetchError || !data) {
      setError("Usuario o contraseña incorrectos");
      setLoading(false);
      return;
    }

    if (!data.activo) {
      setError("Usuario inactivo. Contacte al administrador.");
      setLoading(false);
      return;
    }

    // Guardamos la sesión con expiración de 20 min
    const sessionData = {
      ...data,
      expiresAt: Date.now() + 20 * 60 * 1000
    };
    
    localStorage.setItem('priusUser', JSON.stringify(sessionData));
    localStorage.setItem('priusUserActivity', Date.now().toString());
    onLogin(sessionData);
  };

  return (
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      backgroundColor: 'var(--bg-dark)', padding: '1rem', zIndex: 9999 
    }}>
      <div style={{ 
        background: 'var(--bg-sidebar)', padding: '2.5rem 2rem', 
        borderRadius: '16px', width: '100%', maxWidth: '420px', 
        textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <img src="/img/prius_logo.jpg" alt="Prius Logo" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', marginBottom: '1.5rem', border: '3px solid var(--primary)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)' }} />
        <h2 style={{ color: 'white', marginBottom: '2rem', fontSize: '1.5rem', fontWeight: '700' }}>Ingreso al Sistema</h2>
        {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>Usuario</label>
            <input type="text" className="form-control" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Ej: admin" style={{ padding: '0.85rem', fontSize: '1rem' }} />
          </div>
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>Contraseña</label>
            <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '0.85rem', fontSize: '1rem' }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', fontSize: '1.1rem', fontWeight: '600', borderRadius: '8px' }} disabled={loading}>
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
