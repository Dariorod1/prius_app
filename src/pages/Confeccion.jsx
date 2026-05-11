import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Scissors, User, Clock, CheckCircle, PlayCircle, RefreshCw, Shirt, AlertTriangle } from 'lucide-react';

const ESTADOS_COLA = ['Corte Finalizado'];
const ESTADOS_EN_PROGRESO = ['En Confección'];
const ESTADOS_TERMINADO = ['Confección Finalizada'];

const Confeccion = () => {
  const [cola, setCola] = useState([]);
  const [enProgreso, setEnProgreso] = useState([]);
  const [terminadosHoy, setTerminadosHoy] = useState([]);
  const [terminadosAnteriores, setTerminadosAnteriores] = useState([]);
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0); // Para mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [actualizando, setActualizando] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    if (mensaje) {
      const t = setTimeout(() => setMensaje(null), 3500);
      return () => clearTimeout(t);
    }
  }, [mensaje]);

  const cargarPedidos = useCallback(async () => {
    setLoading(true);
    const todosEstados = [...ESTADOS_COLA, ...ESTADOS_EN_PROGRESO, ...ESTADOS_TERMINADO];

    const { data, error } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, dni), instituciones(nombre)')
      .in('estado', todosEstados)
      .order('fecha_creacion', { ascending: true });

    if (!error && data) {
      const hoyStr = new Date().toDateString();
      setCola(data.filter(p => ESTADOS_COLA.includes(p.estado)));
      setEnProgreso(data.filter(p => ESTADOS_EN_PROGRESO.includes(p.estado)));
      const terminados = data.filter(p => ESTADOS_TERMINADO.includes(p.estado));
      setTerminadosHoy(terminados.filter(p => new Date(p.fecha_creacion).toDateString() === hoyStr));
      setTerminadosAnteriores(terminados.filter(p => new Date(p.fecha_creacion).toDateString() !== hoyStr));
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargarPedidos(); }, [cargarPedidos]);

  useEffect(() => {
    const channel = supabase
      .channel('confeccion-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => cargarPedidos())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cargarPedidos]);

  const cambiarEstado = async (pedidoId, nuevoEstado) => {
    setActualizando(pedidoId);
    const user = JSON.parse(localStorage.getItem('priusUser'));

    const { error } = await supabase
      .from('pedidos')
      .update({ estado: nuevoEstado })
      .eq('id', pedidoId);

    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al actualizar el estado.' });
    } else {
      await supabase.from('pedido_estado_log').insert([{
        pedido_id: pedidoId,
        estado: nuevoEstado,
        empleado_username: user?.username || 'Desconocido'
      }]);
      setMensaje({ tipo: 'success', texto: `Pedido movido a "${nuevoEstado}"` });
      cargarPedidos();
    }
    setActualizando(null);
  };

  const CardPedido = ({ pedido, acciones }) => (
    <div style={{
      background: 'var(--bg-sidebar)', borderRadius: '10px', padding: '1.25rem',
      border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem',
      minHeight: '220px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h4 style={{ color: 'var(--text-main)', margin: 0, fontSize: '1rem' }}>{pedido.clientes?.nombre}</h4>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DNI: {pedido.clientes?.dni}</span>
        </div>
        <Shirt size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
      </div>

      <div style={{ background: 'var(--bg-dark)', borderRadius: '6px', padding: '0.75rem', fontSize: '0.9rem', flex: 1 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem' }}>
          <span><span style={{ color: 'var(--text-muted)' }}>Prenda:</span> <strong style={{ color: 'var(--text-main)' }}>{pedido.tipo_prenda}</strong></span>
          <span><span style={{ color: 'var(--text-muted)' }}>Talle:</span> <strong style={{ color: 'var(--accent)' }}>{pedido.talle}</strong></span>
          {pedido.nombre_bordado && (
            <span><span style={{ color: 'var(--text-muted)' }}>Bordado:</span> <strong style={{ color: 'var(--text-main)' }}>{pedido.nombre_bordado}</strong></span>
          )}
        </div>
        {pedido.observaciones && (
          <div style={{ marginTop: '0.5rem', color: '#FACC15', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {pedido.observaciones}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <User size={12} /> {pedido.instituciones?.nombre}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={12} /> {new Date(pedido.fecha_creacion).toLocaleDateString()}
        </span>
      </div>

      {acciones.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {acciones.map(accion => (
            <button
              key={accion.label}
              onClick={() => cambiarEstado(pedido.id, accion.nextEstado)}
              disabled={actualizando === pedido.id}
              style={{
                flex: accion.outlined ? '0 0 auto' : 1,
                padding: '0.6rem 1rem', borderRadius: '6px',
                border: accion.outlined ? '1px solid var(--border-color)' : 'none',
                cursor: 'pointer',
                background: accion.outlined ? 'transparent' : accion.color,
                color: accion.outlined ? 'var(--text-muted)' : 'white',
                fontWeight: accion.outlined ? 'normal' : 'bold',
                fontSize: '0.85rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                opacity: actualizando === pedido.id ? 0.6 : 1
              }}
            >
              {accion.icon} {actualizando === pedido.id ? '...' : accion.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const columnas = [
    {
      titulo: 'Cola de Confección',
      subtitle: 'Prendas cortadas listas para armar',
      color: '#3B82F6',
      pedidos: cola,
      acciones: [
        { label: 'Iniciar Confección', nextEstado: 'En Confección', color: '#7C3AED', icon: <PlayCircle size={16} /> }
      ]
    },
    {
      titulo: 'En Confección',
      subtitle: 'Prendas siendo armadas ahora',
      color: '#7C3AED',
      pedidos: enProgreso,
      acciones: [
        { label: 'Finalizar Confección', nextEstado: 'Confección Finalizada', color: '#10B981', icon: <CheckCircle size={16} /> },
        { label: 'Volver a Cola', nextEstado: 'Corte Finalizado', color: 'rgba(255,255,255,0.08)', icon: <RefreshCw size={16} />, outlined: true }
      ]
    },
    {
      titulo: 'Confección Finalizada',
      subtitle: 'Finalizadas hoy — listas para Bordado',
      color: '#10B981',
      pedidos: terminadosHoy,
      acciones: [
        { label: 'Reabrir Confección', nextEstado: 'En Confección', color: 'rgba(255,255,255,0.08)', icon: <RefreshCw size={16} />, outlined: true }
      ]
    }
  ];

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
      {mensaje && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', padding: '1rem 2rem',
          borderRadius: '8px', backgroundColor: mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)',
          color: 'white', fontWeight: '500', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', zIndex: 10000
        }}>
          {mensaje.texto}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ color: 'var(--primary)', marginBottom: '0.25rem' }}>Mesa de Confección</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Prendas cortadas listas para ser armadas</p>
        </div>
        <button
          onClick={cargarPedidos}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 1rem', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Cargando pedidos...</div>
      ) : (
        <>
          {isMobile ? (
            /* ===== MOBILE: Tabs ===== */
            <>
              {/* Tab bar */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', background: 'var(--bg-sidebar)', padding: '0.4rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                {columnas.map((col, idx) => (
                  <button
                    key={col.titulo}
                    onClick={() => setActiveTab(idx)}
                    style={{
                      flex: 1, padding: '0.6rem 0.25rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                      background: activeTab === idx ? col.color : 'transparent',
                      color: activeTab === idx ? 'white' : 'var(--text-muted)',
                      fontWeight: activeTab === idx ? 'bold' : 'normal',
                      fontSize: '0.8rem', transition: 'all 0.2s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px'
                    }}
                  >
                    <span>{col.titulo.replace('Confección', 'Conf.')}</span>
                    <span style={{
                      background: activeTab === idx ? 'rgba(255,255,255,0.3)' : col.color + '40',
                      color: activeTab === idx ? 'white' : col.color,
                      borderRadius: '10px', padding: '1px 6px', fontSize: '0.7rem'
                    }}>
                      {col.pedidos.length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Columna activa */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {columnas[activeTab].pedidos.length === 0 ? (
                  <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                    Sin pedidos en esta etapa
                  </div>
                ) : (
                  columnas[activeTab].pedidos.map(pedido => (
                    <CardPedido key={pedido.id} pedido={pedido} acciones={columnas[activeTab].acciones} />
                  ))
                )}
              </div>
            </>
          ) : (
            /* ===== DESKTOP: Kanban 3 columnas sincronizadas ===== */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 1.5rem' }}>
              {/* Headers */}
              {columnas.map(col => (
                <div key={col.titulo} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: col.color, flexShrink: 0 }}></div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>
                      {col.titulo}
                      <span style={{ marginLeft: '0.5rem', background: col.color + '30', color: col.color, padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                        {col.pedidos.length}
                      </span>
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{col.subtitle}</p>
                  </div>
                </div>
              ))}
              
              {/* Cards sincronizadas por fila */}
              {(() => {
                const maxRows = Math.max(cola.length, enProgreso.length, terminadosHoy.length, 1);
                return Array.from({ length: maxRows }, (_, rowIndex) =>
                  columnas.map((col) => {
                    const pedido = col.pedidos[rowIndex];
                    return pedido ? (
                      <div key={`${col.titulo}-${rowIndex}`} style={{ marginBottom: '1rem' }}>
                        <CardPedido pedido={pedido} acciones={col.acciones} />
                      </div>
                    ) : (
                      <div key={`empty-${col.titulo}-${rowIndex}`} style={{ marginBottom: '1rem' }}>
                        {rowIndex === 0 && (
                          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border-color)', height: '100%', boxSizing: 'border-box' }}>
                            Sin pedidos
                          </div>
                        )}
                      </div>
                    );
                  })
                );
              })()}
            </div>
          )}

          {terminadosAnteriores.length > 0 && (
            <div style={{ marginTop: '3rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <button
                onClick={() => setMostrarAnteriores(prev => !prev)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', padding: 0, marginBottom: '1rem' }}
              >
                <RefreshCw size={15} />
                {mostrarAnteriores ? 'Ocultar historial de jornadas anteriores' : `Ver ${terminadosAnteriores.length} confecciones finalizadas en jornadas anteriores`}
              </button>
              {mostrarAnteriores && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', opacity: 0.6 }}>
                  {terminadosAnteriores.map(pedido => (
                    <CardPedido key={pedido.id} pedido={pedido} acciones={[]} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Confeccion;
