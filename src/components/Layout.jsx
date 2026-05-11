import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useState } from 'react';
import { Menu, LogOut } from 'lucide-react';

const Layout = ({ user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="app-container">
      <Sidebar 
        currentRole={user.rol} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
      />
      
      <div className="main-content">
        <header className="topbar">
          <button 
            className="menu-toggle-btn" 
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={28} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginLeft: 'auto' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{user.username}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.rol.toUpperCase()}</div>
            </div>
            <img src="/img/prius_logo.jpg" alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid var(--primary)', objectFit: 'cover' }} />
            <button onClick={onLogout} title="Cerrar Sesión" style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '5px' }}>
              <LogOut size={20} />
            </button>
          </div>
        </header>
        
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
