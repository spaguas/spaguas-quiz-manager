import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const ResetPassword = () => {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialToken = searchParams.get('token') ?? '';

  const [form, setForm] = useState({ token: initialToken, password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
    setMessage('');

    if (!form.token.trim()) {
      setError('Informe o token recebido.');
      return;
    }

    if (form.password.length < 6) {
      setError('A nova senha deve ter ao menos 6 caracteres.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('A confirmação deve ser igual à nova senha.');
      return;
    }

    try {
      setLoading(true);
      const response = await resetPassword({ token: form.token.trim(), password: form.password });
      setMessage(response.message || 'Senha redefinida com sucesso!');
      setTimeout(() => {
        navigate('/admin/login');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Não foi possível redefinir a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid">
      <div className="page-title">
        <div>
          <h1>Redefinir senha</h1>
          <p className="page-description">
            Informe o token recebido e escolha uma nova senha para acessar o sistema.
          </p>
        </div>
      </div>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="reset-token">Token</label>
          <input
            id="reset-token"
            name="token"
            type="text"
            placeholder="Cole aqui o token recebido"
            value={form.token}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="reset-password">Nova senha</label>
          <input
            id="reset-password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="reset-confirm">Confirmar nova senha</label>
          <input
            id="reset-confirm"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
          />
        </div>
        {error && <div className="page-error" style={{ margin: 0 }}>{error}</div>}
        {message && <div className="tag success">{message}</div>}
        <div className="form-actions">
          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Redefinindo...' : 'Redefinir senha'}
          </button>
          <Link className="button ghost" to="/admin/login">
            Voltar ao login
          </Link>
        </div>
      </form>
    </div>
  );
};

export default ResetPassword;
