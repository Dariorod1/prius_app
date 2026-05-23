import { useNavigate } from 'react-router-dom';
import {
  BookOpen, ClipboardList, Layers, School, Users,
  CreditCard, Scissors, Shirt, PenTool, FileText
} from 'lucide-react';

const SECTIONS = [
  {
    path: '/libro-mayor',
    name: 'Libro Mayor',
    description: 'Vista completa de todos los pedidos activos con filtros y timeline.',
    icon: BookOpen,
    color: '#009EE3',
    roles: ['admin', 'operador'],
  },
  {
    path: '/pedidos',
    name: 'Recepción',
    description: 'Ingresá pedidos individuales de clientes.',
    icon: ClipboardList,
    color: '#7C3AED',
    roles: ['admin', 'operador'],
  },
  {
    path: '/recepcion-lote',
    name: 'Lotes',
    description: 'Carga masiva de pedidos por escuela y grado.',
    icon: Layers,
    color: '#0EA5E9',
    roles: ['admin', 'operador'],
  },
  {
    path: '/corte',
    name: 'Sección: Corte',
    description: 'Kanban de prendas autorizadas para cortar.',
    icon: Scissors,
    color: '#F97316',
    roles: ['admin', 'cortador'],
  },
  {
    path: '/confeccion',
    name: 'Sección: Confección',
    description: 'Cola de prendas listas para confeccionar.',
    icon: Shirt,
    color: '#10B981',
    roles: ['admin', 'confeccion'],
  },
  {
    path: '/bordado',
    name: 'Sección: Bordado',
    description: 'Prendas en espera de bordado.',
    icon: PenTool,
    color: '#EC4899',
    roles: ['admin', 'bordador'],
  },
  {
    path: '/pagos',
    name: 'Pagos / Cuotas',
    description: 'Cobranzas, historial de pagos y entregas.',
    icon: CreditCard,
    color: '#00C896',
    roles: ['admin', 'operador'],
  },
  {
    path: '/escuelas',
    name: 'Escuelas',
    description: 'Gestión de instituciones y organizaciones.',
    icon: School,
    color: '#FACC15',
    roles: ['admin', 'operador'],
  },
  {
    path: '/empleados',
    name: 'Empleados',
    description: 'Alta y administración de usuarios del sistema.',
    icon: Users,
    color: '#94A3B8',
    roles: ['admin'],
  },
  {
    path: '/listado',
    name: 'Listado',
    description: 'Reporte exportable a PDF de todos los pedidos.',
    icon: FileText,
    color: '#A78BFA',
    roles: ['admin'],
  },
];

const Home = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('priusUser'));
  const role = user?.rol || '';

  const visible = SECTIONS.filter(s => s.roles.includes(role));
  const hora = new Date().getHours();
  const saludo = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--text-main)', fontSize: '1.6rem', fontWeight: '700', margin: 0 }}>
          {saludo}, <span style={{ color: 'var(--primary)' }}>{user?.username || 'usuario'}</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem', fontSize: '0.95rem' }}>
          ¿A qué sección vas hoy?
        </p>
      </div>

      {/* Card grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '1rem',
      }}>
        {visible.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.path}
              onClick={() => navigate(section.path)}
              aria-label={'Ir a ' + section.name}
              style={{
                background: 'var(--bg-sidebar)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '1.5rem 1.25rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'transform var(--dur-fast) ease, box-shadow var(--dur-fast) ease, border-color var(--dur-fast) ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                e.currentTarget.style.borderColor = section.color + '60';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              {/* Icon container */}
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: section.color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={24} style={{ color: section.color }} aria-hidden="true" />
              </div>

              {/* Text */}
              <div>
                <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: 1.3 }}>
                  {section.name}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.4 }}>
                  {section.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Home;
