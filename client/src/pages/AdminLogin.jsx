import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, logout, user, isAdmin } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [user, isAdmin, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      setLoading(true);
      const loggedUser = await login(form);
      if (loggedUser.role !== 'ADMIN') {
        setError('Esta conta não possui permissão administrativa.');
        logout();
        return;
      }

      const redirectPath = location.state?.from && location.state.from.startsWith('/admin')
        ? location.state.from
        : '/admin/dashboard';
      navigate(redirectPath, { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || 'Não foi possível autenticar.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid">
      <div className="page-title">
        <div>
          <h1>Login administrativo</h1>
          <p className="page-description">
            Informe suas credenciais para acessar o painel administrativo.
          </p>
        </div>
      </div>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="admin@exemplo.com"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Sua senha"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>

        {error && <div className="page-error" style={{ margin: 0 }}>{error}</div>}

        <div className="form-actions">
          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            className="button ghost"
            type="button"
            onClick={() => navigate('/auth/forgot-password')}
          >
            Esqueci minha senha
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminLogin;
