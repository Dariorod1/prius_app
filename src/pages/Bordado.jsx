import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Sparkles, User, Clock, CheckCircle, PlayCircle, RefreshCw, AlertTriangle } from 'lucide-react';

const ESTADOS_COLA = ['Confección Finalizada'];
const ESTADOS_EN_PROGRESO = ['En Bordado'];
const ESTADOS_TERMINADO = ['Bordado Finalizado'];

const Bordado = () => {
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
  const draggedIdRef = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);

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

  // REALTIME: Escuchar cambios en la tabla pedidos para actualizar la mesa automáticamente
  useEffect(() => {
    const channel = supabase
      .channel('bordado-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // UPDATE, INSERT, DELETE
          schema: 'public',
          table: 'pedidos',
        },
        (payload) => {
          console.log('Realtime Bordado:', payload);
          cargarPedidos(); // Recargar todo para mantener las columnas sincronizadas
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    <div
      draggable={!isMobile}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; draggedIdRef.current = pedido.id; }}
      onDragEnd={() => { draggedIdRef.current = null; setDragOverCol(null); }}
      style={{
      background: '#1E293B', borderRadius: '12px', padding: '1.5rem',
      border: '2px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
      cursor: !isMobile ? 'grab' : 'default'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ color: 'white', margin: 0, fontSize: '1.4rem', fontWeight: '800' }}>{pedido.clientes?.nombre}</h2>
          <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>DNI: {pedido.clientes?.dni}</span>
        </div>
        <Sparkles size={32} style={{ color: '#FACC15', flexShrink: 0 }} />
      </div>

      <div style={{ background: 'rgba(250, 204, 21, 0.05)', borderRadius: '10px', padding: '1rem', border: '1px solid rgba(250, 204, 21, 0.2)', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '1.2rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Prenda:</span> <strong style={{ color: 'white' }}>{pedido.tipo_prenda}</strong>
          </div>
          <div style={{ fontSize: '1.2rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Talle:</span> <strong style={{ color: '#FACC15', fontSize: '1.5rem' }}>{pedido.talle}</strong>
          </div>
          {pedido.nombre_bordado && (
            <div style={{ background: '#FACC15', color: '#000', padding: '0.75rem', borderRadius: '6px', marginTop: '0.5rem', textAlign: 'center' }}>
               <span style={{ fontWeight: 'bold', fontSize: '0.9rem', display: 'block', textTransform: 'uppercase' }}>Texto a Bordar:</span>
               <strong style={{ fontSize: '1.6rem', letterSpacing: '1px' }}>{pedido.nombre_bordado}</strong>
            </div>
          )}
        </div>
        {pedido.observaciones && (
          <div style={{ marginTop: '1rem', color: '#F87171', fontSize: '1.1rem', fontWeight: 'bold', borderTop: '1px dashed rgba(248, 113, 113, 0.3)', paddingTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} /> {pedido.observaciones}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <User size={16} /> {pedido.instituciones?.nombre}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={16} /> {new Date(pedido.fecha_creacion).toLocaleDateString()}
        </span>
      </div>

      {acciones.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {acciones.map(accion => (
            <button
              key={accion.label}
              onClick={() => cambiarEstado(pedido.id, accion.nextEstado)}
              disabled={actualizando === pedido.id}
              style={{
                width: '100%',
                padding: '1.25rem', borderRadius: '12px',
                border: accion.outlined ? '2px solid var(--border-color)' : 'none',
                cursor: 'pointer',
                background: accion.outlined ? 'transparent' : accion.color,
                color: accion.outlined ? 'var(--text-muted)' : 'white',
                fontWeight: '900',
                fontSize: '1.2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                opacity: actualizando === pedido.id ? 0.6 : 1,
                boxShadow: accion.outlined ? 'none' : '0 4px 14px 0 rgba(0,0,0,0.3)'
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
      titulo: 'Cola de Bordado',
      color: '#3B82F6',
      dropEstado: 'Confección Finalizada',
      pedidos: cola,
      acciones: [
        { label: 'Iniciar Bordado', nextEstado: 'En Bordado', color: '#7C3AED', icon: <PlayCircle size={24} /> }
      ]
    },
    {
      titulo: 'En Bordado',
      color: '#7C3AED',
      dropEstado: 'En Bordado',
      pedidos: enProgreso,
      acciones: [
        { label: 'Finalizar Bordado', nextEstado: 'Bordado Finalizado', color: '#10B981', icon: <CheckCircle size={24} /> },
        { label: 'Volver a Cola', nextEstado: 'Confección Finalizada', color: 'rgba(255,255,255,0.08)', icon: <RefreshCw size={24} />, outlined: true }
      ]
    },
    {
      titulo: 'Terminados (Hoy)',
      color: '#10B981',
      dropEstado: 'Bordado Finalizado',
      pedidos: terminadosHoy,
      acciones: [
        { label: 'Reabrir Bordado', nextEstado: 'En Bordado', color: 'rgba(255,255,255,0.08)', icon: <RefreshCw size={24} />, outlined: true }
      ]
    }
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {mensaje && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', padding: '1.5rem 2.5rem',
          borderRadius: '12px', backgroundColor: mensaje.tipo === 'success' ? 'var(--accent)' : 'var(--danger)',
          color: 'white', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 10000, fontSize: '1.2rem'
        }}>
          {mensaje.texto}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ color: '#FACC15', marginBottom: '0.25rem', fontSize: '2.5rem' }}>Mesa de Bordado</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1.2rem' }}>Interfaz de alta visibilidad para bordadores</p>
        </div>
        <button
          onClick={cargarPedidos}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem 1.5rem', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.1rem' }}
        >
          <RefreshCw size={20} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', fontSize: '1.5rem' }}>Cargando trabajos de bordado...</div>
      ) : (
        <>
          {isMobile ? (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--bg-sidebar)', padding: '0.5rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                {columnas.map((col, idx) => (
                  <button
                    key={col.titulo}
                    onClick={() => setActiveTab(idx)}
                    style={{
                      flex: 1, padding: '1rem 0.5rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                      background: activeTab === idx ? col.color : 'transparent',
                      color: activeTab === idx ? 'white' : 'var(--text-muted)',
                      fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <span>{col.titulo}</span>
                    <span style={{ background: activeTab === idx ? 'rgba(255,255,255,0.3)' : col.color + '40', color: activeTab === idx ? 'white' : col.color, borderRadius: '10px', padding: '2px 10px', fontSize: '0.8rem' }}>
                      {col.pedidos.length}
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {columnas[activeTab].pedidos.length === 0 ? (
                  <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '2px dashed var(--border-color)', fontSize: '1.3rem' }}>
                    Sin trabajos pendientes en esta etapa
                  </div>
                ) : (
                  columnas[activeTab].pedidos.map(pedido => (
                    <CardPedido key={pedido.id} pedido={pedido} acciones={columnas[activeTab].acciones} />
                  ))
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 2rem' }}>
              {columnas.map((col, colIdx) => (
                <div
                  key={col.titulo}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol(colIdx); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedIdRef.current) {
                      const actual = [...cola, ...enProgreso, ...terminadosHoy].find(p => p.id === draggedIdRef.current);
                      if (actual && actual.estado !== col.dropEstado) cambiarEstado(draggedIdRef.current, col.dropEstado);
                      draggedIdRef.current = null; setDragOverCol(null);
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem',
                    padding: '0.4rem 0.5rem', borderRadius: '8px',
                    background: dragOverCol === colIdx ? col.color + '18' : 'transparent',
                    transition: 'background 0.15s'
                  }}
                >
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: col.color, flexShrink: 0 }}></div>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-main)' }}>
                    {col.titulo}
                    <span style={{ marginLeft: '1rem', background: col.color + '30', color: col.color, padding: '4px 12px', borderRadius: '14px', fontSize: '1.1rem' }}>
                      {col.pedidos.length}
                    </span>
                  </h3>
                </div>
              ))}
              
              {(() => {
                const maxRows = Math.max(cola.length, enProgreso.length, terminadosHoy.length, 1);
                return Array.from({ length: maxRows }, (_, rowIndex) =>
                  columnas.map((col, colIdx) => {
                    const pedido = col.pedidos[rowIndex];
                    const dropHandlers = {
                      onDragOver: (e) => { e.preventDefault(); setDragOverCol(colIdx); },
                      onDragLeave: () => setDragOverCol(null),
                      onDrop: (e) => {
                        e.preventDefault();
                        if (draggedIdRef.current) {
                          const actual = [...cola, ...enProgreso, ...terminadosHoy].find(p => p.id === draggedIdRef.current);
                          if (actual && actual.estado !== col.dropEstado) cambiarEstado(draggedIdRef.current, col.dropEstado);
                          draggedIdRef.current = null; setDragOverCol(null);
                        }
                      }
                    };
                    return pedido ? (
                      <div key={`${col.titulo}-${rowIndex}`} {...dropHandlers} style={{ marginBottom: '1.5rem', borderRadius: '12px', outline: dragOverCol === colIdx ? `2px dashed ${col.color}` : '2px dashed transparent', transition: 'outline 0.12s' }}>
                        <CardPedido pedido={pedido} acciones={col.acciones} />
                      </div>
                    ) : (
                      <div key={`empty-${col.titulo}-${rowIndex}`} {...dropHandlers} style={{ marginBottom: '1.5rem', borderRadius: '12px', outline: dragOverCol === colIdx ? `2px dashed ${col.color}` : '2px dashed transparent', transition: 'outline 0.12s' }}>
                        {rowIndex === 0 && (
                          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '2px dashed var(--border-color)', fontSize: '1.2rem' }}>
                            Vacío
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
            <div style={{ marginTop: '4rem', borderTop: '2px solid var(--border-color)', paddingTop: '2rem' }}>
              <button
                onClick={() => setMostrarAnteriores(prev => !prev)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.2rem', padding: 0, marginBottom: '2rem' }}
              >
                <RefreshCw size={20} />
                {mostrarAnteriores ? 'Ocultar historial antiguo' : `Ver ${terminadosAnteriores.length} bordados de días anteriores`}
              </button>
              {mostrarAnteriores && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', opacity: 0.7 }}>
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

export default Bordado;
