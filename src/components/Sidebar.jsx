import { NavLink } from 'react-router-dom';
import { 
  Home,
  BookOpen,
  ClipboardList, 
  Scissors, 
  Shirt, 
  PenTool, 
  CreditCard,
  School,
  Users,
  X,
  FileText,
  Layers,
  Truck
} from 'lucide-react';

const Sidebar = ({ currentRole, isOpen, setIsOpen }) => {
  const routes = [
    { path: '/', name: 'Inicio', icon: <Home className="nav-icon" aria-hidden="true" />, roles: ['admin', 'operador', 'cortador', 'confeccion', 'bordador'] },
    { path: '/libro-mayor', name: 'Libro Mayor', icon: <BookOpen className="nav-icon" aria-hidden="true" />, roles: ['admin', 'operador'] },
    // { path: '/pedidos', name: 'Recepción', icon: <ClipboardList className="nav-icon" aria-hidden="true" />, roles: ['admin', 'operador'] }, // desactivado temporalmente
    { path: '/recepcion-lote', name: 'Lotes', icon: <Layers className="nav-icon" aria-hidden="true" />, roles: ['admin', 'operador'] },
    { path: '/escuelas', name: 'Escuelas', icon: <School className="nav-icon" aria-hidden="true" />, roles: ['admin', 'operador'] },
    { path: '/empleados', name: 'Empleados', icon: <Users className="nav-icon" aria-hidden="true" />, roles: ['admin'] },
    { path: '/pagos', name: 'Pagos/Cuotas', icon: <CreditCard className="nav-icon" aria-hidden="true" />, roles: ['admin', 'operador'] },
    { path: '/corte', name: 'Sección: Corte', icon: <Scissors className="nav-icon" aria-hidden="true" />, roles: ['admin', 'cortador'] },
    { path: '/confeccion', name: 'Sección: Confección', icon: <Shirt className="nav-icon" aria-hidden="true" />, roles: ['admin', 'confeccion'] },
    { path: '/bordado', name: 'Sección: Bordado', icon: <PenTool className="nav-icon" aria-hidden="true" />, roles: ['admin', 'bordador'] },
    { path: '/entrega', name: 'Sección: Entrega', icon: <Truck className="nav-icon" aria-hidden="true" />, roles: ['admin', 'operador', 'entrega'] },
    { path: '/listado', name: 'Listado', icon: <FileText className="nav-icon" aria-hidden="true" />, roles: ['admin'] },
  ];

  const allowedRoutes = routes.filter(route => route.roles.includes(currentRole));

  return (
    <>
      <div 
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`} 
        onClick={() => setIsOpen(false)}
      ></div>

      <aside className={`sidebar ${isOpen ? 'open' : ''}`} aria-label="Navegación principal">
        <div className="sidebar-header">
          <img src="/img/prius_logo.jpg" alt="Prius App" style={{ height: '32px', borderRadius: '4px', marginRight: '8px' }} />
          <h2>PRIUS APP</h2>
          <button className="close-sidebar-btn" onClick={() => setIsOpen(false)} aria-label="Cerrar menú">
            <X size={24} aria-hidden="true" />
          </button>
        </div>
        
        <nav className="sidebar-nav" aria-label="Menú de secciones">
          {allowedRoutes.map((route) => (
            <NavLink 
              key={route.path} 
              to={route.path}
              className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
              onClick={() => setIsOpen(false)}
            >
              {route.icon}
              <span>{route.name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
