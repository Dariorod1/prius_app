import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useState, useEffect } from 'react';
import { Menu, LogOut, Share2 } from 'lucide-react';

// Detecta iOS (iPhone / iPad / iPod) — incluyendo iPad en modo desktop
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Detecta si YA está instalada como PWA
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const Layout = ({ user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);

  useEffect(() => {
    // Mostrar el banner solo en iOS, solo si no está ya instalada
    // y solo si el usuario no lo cerró antes
    if (isIOS() && !isStandalone() && !sessionStorage.getItem('iosBannerDismissed')) {
      setShowIOSBanner(true);
    }
  }, []);

  return (
    <div className="app-container">
      <Sidebar 
        currentRole={user.rol} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
      />
      
      <div className="main-content">
        {/* Banner de instalación para iOS */}
        {showIOSBanner && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem',
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            color: 'white', fontSize: '0.85rem', flexShrink: 0,
          }}>
            <Share2 size={18} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              Instalá la app: tocá <strong>Compartir</strong> <Share2 size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> y luego <strong>"Agregar a inicio"</strong>
            </span>
            <button
              onClick={() => { sessionStorage.setItem('iosBannerDismissed', '1'); setShowIOSBanner(false); }}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', flexShrink: 0, minHeight: '32px' }}
            >
              ✕
            </button>
          </div>
        )}
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
