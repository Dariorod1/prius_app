import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Scissors, 
  Shirt, 
  PenTool, 
  CreditCard,
  School,
  Users,
  X,
  FileText,
  Layers
} from 'lucide-react';

const Sidebar = ({ currentRole, isOpen, setIsOpen }) => {
  const routes = [
    { path: '/', name: 'Dashboard', icon: <LayoutDashboard className="nav-icon" />, roles: ['admin', 'operador', 'cortador', 'confeccion', 'bordador'] },
    { path: '/pedidos', name: 'Recepción', icon: <ClipboardList className="nav-icon" />, roles: ['admin', 'operador'] },
    { path: '/recepcion-lote', name: 'Lotes', icon: <Layers className="nav-icon" />, roles: ['admin', 'operador'] },
    { path: '/escuelas', name: 'Escuelas', icon: <School className="nav-icon" />, roles: ['admin', 'operador'] },
    { path: '/empleados', name: 'Empleados', icon: <Users className="nav-icon" />, roles: ['admin'] },
    { path: '/pagos', name: 'Pagos/Cuotas', icon: <CreditCard className="nav-icon" />, roles: ['admin', 'operador'] },
    { path: '/corte', name: 'Sección: Corte', icon: <Scissors className="nav-icon" />, roles: ['admin', 'cortador'] },
    { path: '/confeccion', name: 'Sección: Confección', icon: <Shirt className="nav-icon" />, roles: ['admin', 'confeccion'] },
    { path: '/bordado', name: 'Sección: Bordado', icon: <PenTool className="nav-icon" />, roles: ['admin', 'bordador'] },
    { path: '/listado', name: 'Listado', icon: <FileText className="nav-icon" />, roles: ['admin'] },
  ];

  const allowedRoutes = routes.filter(route => route.roles.includes(currentRole));

  return (
    <>
      <div 
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`} 
        onClick={() => setIsOpen(false)}
      ></div>

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src="/img/prius_logo.jpg" alt="Prius App" style={{ height: '32px', borderRadius: '4px', marginRight: '8px' }} />
          <h2>PRIUS APP</h2>
          <button className="close-sidebar-btn" onClick={() => setIsOpen(false)}>
            <X size={24} />
          </button>
        </div>
        
        <nav className="sidebar-nav">
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
