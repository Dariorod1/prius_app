import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useState, useEffect } from 'react';
import { Menu, LogOut, Share2, Sun, Moon } from 'lucide-react';

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
  const [theme, setTheme] = useState(() => localStorage.getItem('priusTheme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('priusTheme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

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
            background: 'linear-gradient(135deg, #009EE3, #0074B8)',
            color: 'white', fontSize: '0.85rem', flexShrink: 0,
          }}>
            <Share2 size={18} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              Instalá la app: tocá <strong>Compartir</strong> <Share2 size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> y luego <strong>"Agregar a inicio"</strong>
            </span>
            <button
              onClick={() => { sessionStorage.setItem('iosBannerDismissed', '1'); setShowIOSBanner(false); }}
              aria-label="Cerrar banner de instalación"
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
            aria-label="Abrir menú"
          >
            <Menu size={28} aria-hidden="true" />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginLeft: 'auto' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{user.username}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.rol.toUpperCase()}</div>
            </div>
            <img src="/img/prius_logo.jpg" alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid var(--primary)', objectFit: 'cover' }} />
            <button onClick={toggleTheme} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '6px', transition: 'color var(--dur-fast) ease' }}>
              {theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
            </button>
            <button onClick={onLogout} title="Cerrar Sesión" aria-label="Cerrar Sesión" style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}>
              <LogOut size={20} aria-hidden="true" />
            </button>
          </div>
        </header>
        
        <main className="page-content" style={{ flex: 1 }}>
          <Outlet />
        </main>

        <footer style={{ textAlign: 'center', padding: '0.6rem', fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.45, borderTop: '1px solid var(--border-color)', userSelect: 'none', letterSpacing: '0.03em' }}>
          Desarrollado por DRS para PRIUS &mdash; &copy; 2026 Todos los derechos reservados
        </footer>
      </div>
    </div>
  );
};

export default Layout;
