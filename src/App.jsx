import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { User } from 'lucide-react';
import Layout from './components/Layout';

// Componente Dashboard modificado para mostrar Pedidos con el esquema relacional en español y Filtros
const Dashboard = () => {
  const [pedidos, setPedidos] = useState([]);
  const [instituciones, setInstituciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filtroInstitucion, setFiltroInstitucion] = useState('');
  const [filtroInstitucionInput, setFiltroInstitucionInput] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTexto, setFiltroTexto] = useState('');

  // Estado para filas expandidas del timeline
  const [expandedRows, setExpandedRows] = useState([]);
  const [estadoLogs, setEstadoLogs] = useState({});

  // Cargar lista de instituciones para el select
  useEffect(() => {
    async function fetchInstituciones() {
      const { data } = await supabase.from('instituciones').select('*').order('nombre');
      if (data) setInstituciones(data);
    }
    fetchInstituciones();
  }, []);

  // Cargar pedidos y aplicar filtros desde la base de datos
  useEffect(() => {
    async function fetchPedidos() {
      setLoading(true);
      try {
        let query = supabase
          .from('pedidos')
          .select(`
            *,
            clientes (nombre, dni),
            instituciones (nombre)
          `)
          .order('fecha_creacion', { ascending: false });

        // Filtros en el servidor (Base de datos)
        if (filtroInstitucion) {
          query = query.eq('institucion_id', filtroInstitucion);
        }
        if (filtroEstado) {
          query = query.eq('estado', filtroEstado);
        }

        const { data, error } = await query;
        if (error) throw error;
        setPedidos(data || []);
      } catch (err) {
        console.error("Error fetching pedidos:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPedidos();
  }, [filtroInstitucion, filtroEstado]); // Se ejecuta al cambiar institución o estado

  const pedidosFiltrados = pedidos.filter(pedido => {
    if (!filtroTexto) return true;
    const termino = filtroTexto.toLowerCase();
    const dni = pedido.clientes?.dni?.toLowerCase() || '';
    const nombre = pedido.clientes?.nombre?.toLowerCase() || '';
    return dni.includes(termino) || nombre.includes(termino);
  });

  const toggleRow = async (pedidoId, fechaCreacion) => {
    if (expandedRows.includes(pedidoId)) {
      setExpandedRows(prev => prev.filter(id => id !== pedidoId));
      return;
    }
    // Si no tiene logs cargados, los busca
    if (!estadoLogs[pedidoId]) {
      const { data } = await supabase
        .from('pedido_estado_log')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('fecha', { ascending: true });
      // Prepend el estado inicial de creación
      const logCompleto = [
        { id: 'creacion', estado: 'Ingresado', fecha: fechaCreacion, empleado_username: '-' },
        ...(data || [])
      ];
      setEstadoLogs(prev => ({ ...prev, [pedidoId]: logCompleto }));
    }
    setExpandedRows(prev => [...prev, pedidoId]);
  };

  const ESTADO_COLORS = {
    'Ingresado': '#94A3B8', 'Pendiente': '#FACC15', 'Autorizado': '#60A5FA',
    'En Corte': '#A78BFA', 'Corte Finalizado': '#34D399',
    'En Confección': '#F97316', 'Confección Finalizada': '#10B981',
    'Bordado': '#EC4899', 'Terminado': '#10B981', 'Entregado': '#10B981'
  };

  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Dashboard de Producción</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Vista general de todos los pedidos activos filtrables.</p>
      
      {/* Barra de Filtros */}
      <div style={{ 
        display: 'flex', gap: '1rem', marginBottom: '2rem', padding: '1rem', 
        background: 'var(--bg-sidebar)', borderRadius: '8px', border: '1px solid var(--border-color)',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: '1', minWidth: '150px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Institución:</label>
          <input 
            type="text" 
            className="form-control" 
            list="escuelas-list-dash"
            placeholder="Escribe para buscar..."
            value={filtroInstitucionInput} 
            onChange={(e) => {
              const val = e.target.value;
              setFiltroInstitucionInput(val);
              // Buscar si lo que escribió coincide exactamente con una escuela
              const coincidencia = instituciones.find(i => i.nombre.toLowerCase() === val.toLowerCase());
              setFiltroInstitucion(coincidencia ? coincidencia.id : '');
            }}
          />
          <datalist id="escuelas-list-dash">
            {instituciones.map(inst => (
              <option key={inst.id} value={inst.nombre} />
            ))}
          </datalist>
        </div>
        <div style={{ flex: '1', minWidth: '150px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Estado:</label>
          <select 
            className="form-control" 
            value={filtroEstado} 
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="Pendiente">Pendiente (Pago incompleto)</option>
            <option value="Autorizado">Autorizado (Listo para corte)</option>
            <option value="Cortado">Cortado</option>
            <option value="Confeccionado">Confeccionado</option>
            <option value="Bordado">Bordado</option>
            <option value="Terminado">Terminado</option>
            <option value="Entregado">Entregado</option>
          </select>
        </div>
        <div style={{ flex: '1.5', minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Buscar Cliente (DNI o Nombre):</label>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Ej: 35123456 o Juan Pérez" 
            value={filtroTexto} 
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button 
            className="btn" 
            style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
            onClick={() => { setFiltroInstitucion(''); setFiltroInstitucionInput(''); setFiltroEstado(''); setFiltroTexto(''); }}
          >
            Limpiar
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '1rem' }}>
          Error al cargar datos: {error}.
        </div>
      )}

      <div style={{ background: 'var(--bg-sidebar)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '1rem', width: '30px' }}></th>
              <th style={{ padding: '1rem', width: 'auto' }}>Cliente (DNI)</th>
              <th style={{ padding: '1rem', width: '20%' }}>Institución</th>
              <th style={{ padding: '1rem', width: '25%' }}>Prenda</th>
              <th style={{ padding: '1rem', width: '15%' }}>Estado</th>
              <th style={{ padding: '1rem', width: '200px' }}>Pagos</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="center-content">Cargando pedidos...</td></tr>
            ) : pedidosFiltrados.length === 0 ? (
              <tr><td colSpan="6" className="center-content" style={{ color: 'var(--text-muted)' }}>No se encontraron pedidos con esos filtros.</td></tr>
            ) : (
              pedidosFiltrados.map(pedido => {
                const percentagePaid = pedido.precio_total > 0 ? (pedido.monto_pagado / pedido.precio_total) * 100 : 0;
                const isExpanded = expandedRows.includes(pedido.id);
                const logs = estadoLogs[pedido.id] || [];

                return (
                  <React.Fragment key={pedido.id}>
                    <tr 
                      style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)', cursor: 'pointer' }}
                      onClick={() => toggleRow(pedido.id, pedido.fecha_creacion)}
                    >
                      <td style={{ padding: '0.5rem 1rem', width: '44px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleRow(pedido.id, pedido.fecha_creacion); }}
                          style={{ 
                            background: isExpanded ? 'var(--primary)' : 'rgba(255,255,255,0.07)',
                            border: '1px solid var(--border-color)', borderRadius: '6px',
                            color: isExpanded ? 'white' : 'var(--text-muted)',
                            cursor: 'pointer', padding: '4px 8px', fontSize: '0.75rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      </td>
                      <td data-label="Cliente" style={{ padding: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{pedido.clientes?.nombre || 'Sin Nombre'}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>DNI: {pedido.clientes?.dni}</div>
                        </div>
                      </td>
                      <td data-label="Institución" style={{ padding: '1rem' }}>
                        <span style={{ color: 'var(--text-main)' }}>{pedido.instituciones?.nombre || 'Sin Institución'}</span>
                      </td>
                      <td data-label="Prenda" style={{ padding: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: '500' }}>{pedido.tipo_prenda} - Talle: {pedido.talle}</div>
                          {pedido.nombre_bordado && <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--accent)' }}>Bordar: {pedido.nombre_bordado}</span>}
                        </div>
                      </td>
                      <td data-label="Estado" style={{ padding: '1rem' }}>
                        <span style={{ 
                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '500',
                          backgroundColor: pedido.estado === 'Pendiente' ? 'rgba(234, 179, 8, 0.2)' : 
                                           pedido.estado === 'Autorizado' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: pedido.estado === 'Pendiente' ? '#FACC15' : 
                                 pedido.estado === 'Autorizado' ? '#60A5FA' : '#34D399'
                        }}>
                          {pedido.estado}
                        </span>
                      </td>
                      <td data-label="Pagos" className="full-width-mobile" style={{ padding: '1rem' }}>
                        <div style={{ width: '100%' }}>
                          <div style={{ fontSize: '0.9rem' }}>${pedido.monto_pagado} / ${pedido.precio_total}</div>
                          <div style={{ width: '100%', height: '6px', background: 'var(--track-color)', borderRadius: '3px', marginTop: '4px' }}>
                            <div style={{ width: `${Math.min(percentagePaid, 100)}%`, height: '100%', background: percentagePaid >= 100 ? 'var(--accent)' : 'var(--primary)', borderRadius: '3px' }}></div>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Fila expandida: Timeline de estados */}
                    {isExpanded && (
                      <tr key={`${pedido.id}-timeline`} style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                        <td colSpan="6" style={{ padding: '1rem 1.5rem 1.5rem 3rem' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: '0.5rem' }}>
                            {logs.map((log, index) => {
                              const color = ESTADO_COLORS[log.estado] || '#94A3B8';
                              const isLast = index === logs.length - 1;
                              return (
                                <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '120px' }}>
                                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: color, flexShrink: 0, marginBottom: '6px', boxShadow: `0 0 0 3px ${color}30` }}></div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color, textAlign: 'center', lineHeight: 1.2, marginBottom: '4px' }}>{log.estado}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>{new Date(log.fecha).toLocaleDateString()}</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>{new Date(log.fecha).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                    {log.empleado_username !== '-' && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}><User size={10} />{log.empleado_username}</span>}
                                  </div>
                                  {!isLast && <div style={{ width: '40px', height: '2px', background: `linear-gradient(to right, ${color}, ${ESTADO_COLORS[logs[index+1]?.estado] || '#94A3B8'})`, marginTop: '6px', flexShrink: 0 }}></div>}
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
    </div>
  );
};

import Login from './pages/Login';
import Recepcion from './pages/Recepcion';
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
          <Route index element={<Dashboard />} />
          <Route path="pedidos" element={<Recepcion />} />
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
