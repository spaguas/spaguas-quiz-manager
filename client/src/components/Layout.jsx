import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import useOnlineStatus from '../hooks/useOnlineStatus.js';
import api from '../services/api.js';
import {
  QUEUE_UPDATED_EVENT,
  getPendingSubmissionCount,
  preCacheOfflineRoutes,
  subscribeOfflineCacheProgress,
  syncPendingSubmissions,
} from '../services/offlineService.js';
import { useEffect, useState } from 'react';
import { ChevronDown, CloudDownload, LogOut, Menu, User, Wifi, WifiOff, X } from 'lucide-react';
import logo from '../assets/sp-aguas-logo-branco.png';

const adminLinks = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/quizzes', label: 'Quizzes' },
  { to: '/admin/quizzes/new', label: 'Novo Quiz' },
  { to: '/admin/users', label: 'Usuários' },
  { to: '/admin/gamification', label: 'Gamificação' },
];

const participantLinks = [
  { to: '/play', label: 'Quizzes Ativos' },
  { to: '/leaderboard', label: 'Ranking Global' },
];

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin: isAdminUser, logout } = useAuth();
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(getPendingSubmissionCount());
  const [cacheProgress, setCacheProgress] = useState(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isPlayerFullScreen = location.pathname.startsWith('/play/quiz');
  const cachePercent = cacheProgress?.total
    ? Math.min(100, Math.round((cacheProgress.completed / cacheProgress.total) * 100))
    : 0;

  useEffect(() => {
    const refreshPendingCount = () => setPendingCount(getPendingSubmissionCount());
    window.addEventListener(QUEUE_UPDATED_EVENT, refreshPendingCount);
    return () => window.removeEventListener(QUEUE_UPDATED_EVENT, refreshPendingCount);
  }, []);

  useEffect(() => {
    preCacheOfflineRoutes([location.pathname]);
    setIsNavOpen(false);
    setOpenDropdown(null);
  }, [location.pathname]);

  useEffect(() => {
    let hideTimer;
    const unsubscribe = subscribeOfflineCacheProgress((progress) => {
      window.clearTimeout(hideTimer);
      setCacheProgress(progress);

      if (progress.status === 'completed') {
        hideTimer = window.setTimeout(() => setCacheProgress(null), 2500);
      }
    });

    return () => {
      window.clearTimeout(hideTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      if (!isOnline) {
        return;
      }
      await syncPendingSubmissions(api);
      if (!cancelled) {
        setPendingCount(getPendingSubmissionCount());
      }
    };

    sync();
    window.addEventListener('online', sync);

    return () => {
      cancelled = true;
      window.removeEventListener('online', sync);
    };
  }, [isOnline]);

  const handleLogout = () => {
    logout();
    setOpenDropdown(null);
    navigate('/admin/login');
  };

  const toggleDropdown = (dropdown) => {
    setOpenDropdown((current) => (current === dropdown ? null : dropdown));
  };

  const renderDropdown = ({ id, label, links }) => (
    <div className={`nav-dropdown ${openDropdown === id ? 'open' : ''}`}>
      <button
        className="nav-dropdown-trigger"
        type="button"
        onClick={() => toggleDropdown(id)}
        aria-expanded={openDropdown === id}
      >
        {label}
        <ChevronDown size={16} />
      </button>
      <div className="nav-dropdown-menu">
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`app-shell ${isPlayerFullScreen ? 'app-shell--bare' : ''}`}>
      {!isPlayerFullScreen && (
        <header className="topbar">
          <div className="brand">
            <img src={logo} alt="SP Águas" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-title">Painel {isAdminRoute ? 'Administrativo' : 'Participante'}</span>
              <span className="brand-subtitle"></span>
            </div>
          </div>

          <button
            className="nav-toggle"
            type="button"
            onClick={() => setIsNavOpen((current) => !current)}
            aria-label={isNavOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={isNavOpen}
          >
            {isNavOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <nav className={`topnav ${isNavOpen ? 'open' : ''}`}>
            {isAdminUser && renderDropdown({ id: 'admin', label: 'Admin', links: adminLinks })}
            {renderDropdown({ id: 'participant', label: 'Participante', links: participantLinks })}
          </nav>

          <div className="auth-actions">
            {user ? (
              <div className={`nav-dropdown account-dropdown ${openDropdown === 'account' ? 'open' : ''}`}>
                <button
                  className="user-chip"
                  type="button"
                  onClick={() => toggleDropdown('account')}
                  aria-expanded={openDropdown === 'account'}
                >
                  <User size={16} />
                  {user.name} <span className="user-chip-role">{user.role}</span>
                  <ChevronDown size={16} />
                </button>
                <div className="nav-dropdown-menu align-right">
                  <NavLink to="/account/profile" className="nav-link">
                    Meu perfil
                  </NavLink>
                  <button className="nav-link nav-link-button" type="button" onClick={handleLogout}>
                    <LogOut size={16} />
                    Sair
                  </button>
                </div>
              </div>
            ) : (
              <NavLink to="/admin/login" className="button ghost">
                Login admin
              </NavLink>
            )}
          </div>
        </header>
      )}
      <main className={`main-content ${isPlayerFullScreen ? 'main-content--bare' : ''}`}>
        <Outlet />
      </main>
      <div className="status-bar">
        <div className={`status-item ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        <div className="status-item">
          <CloudDownload size={16} />
          <span>{pendingCount} pendente(s)</span>
        </div>
        {cacheProgress && cacheProgress.total > 0 ? (
          <div className="status-cache-progress" title="Preparando telas para uso offline">
            <div className="status-cache-label">
              <span>Cache offline</span>
              <strong>{cacheProgress.completed}/{cacheProgress.total}</strong>
            </div>
            <div className="status-cache-track">
              <span style={{ width: `${cachePercent}%` }} />
            </div>
            {cacheProgress.failed > 0 && <small>{cacheProgress.failed} falha(s)</small>}
          </div>
        ) : (
          <div className="status-item muted">
            <CloudDownload size={16} />
            <span>Cache offline pronto</span>
          </div>
        )}
      </div>
      {!isPlayerFullScreen && (
        <footer className="footer">
          <span>© {new Date().getFullYear()} Spaguas Quiz</span>
        </footer>
      )}
    </div>
  );
};

export default Layout;
