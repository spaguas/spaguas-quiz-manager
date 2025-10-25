import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import logo from '../assets/sp-aguas-logo-branco.png';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin: isAdminUser, logout } = useAuth();
  const isAdminRoute = location.pathname.startsWith('/admin');

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img src={logo} alt="SP Águas" className="brand-logo" />
          <div className="brand-text">
            <span className="brand-title">Painel {isAdminRoute ? 'Administrativo' : 'Participante'}</span>
            <span className="brand-subtitle"></span>
          </div>
        </div>
        <nav className="topnav">
          {isAdminUser && (
            <div className="nav-group">
              <span className="nav-group-title">Admin</span>
              <NavLink
                to="/admin/dashboard"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/admin/quizzes"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                Quizzes
              </NavLink>
              <NavLink
                to="/admin/quizzes/new"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                Novo Quiz
              </NavLink>
              <NavLink
                to="/admin/users"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                Usuários
              </NavLink>
            </div>
          )}
          <div className="nav-group">
            <span className="nav-group-title">Participante</span>
            <NavLink
              to="/play"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Quizzes Ativos
            </NavLink>
            <NavLink
              to="/leaderboard"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Ranking Global
            </NavLink>
          </div>
        </nav>
        <div className="auth-actions">
          {user ? (
            <>
              <span className="user-chip">
                {user.name} <span className="user-chip-role">{user.role}</span>
              </span>
              <NavLink to="/account/profile" className="button ghost">
                Meu perfil
              </NavLink>
              <button className="button ghost" type="button" onClick={handleLogout}>
                Sair
              </button>
            </>
          ) : (
            <NavLink to="/admin/login" className="button ghost">
              Login admin
            </NavLink>
          )}
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      <footer className="footer">
        <span>© {new Date().getFullYear()} Spaguas Quiz</span>
      </footer>
    </div>
  );
};

export default Layout;
