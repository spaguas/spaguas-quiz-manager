import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const ForgotPassword = () => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setToken('');

    if (!email.trim()) {
      setError('Informe um e-mail válido.');
      return;
    }

    try {
      setLoading(true);
      const response = await requestPasswordReset({ email: email.trim() });
      setMessage(response.message || 'Se o e-mail existir receberá instruções para redefinição.');
      if (response.token) {
        setToken(response.token);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Não foi possível iniciar a recuperação de senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid">
      <div className="page-title">
        <div>
          <h1>Recuperar senha</h1>
          <p className="page-description">
            Informe o e-mail cadastrado para gerar um token de redefinição. Use-o na etapa seguinte.
          </p>
        </div>
      </div>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="recover-email">E-mail</label>
          <input
            id="recover-email"
            type="email"
            placeholder="seuemail@exemplo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        {error && <div className="page-error" style={{ margin: 0 }}>{error}</div>}
        {message && <div className="tag success">{message}</div>}
        {token && (
          <div className="card" style={{ background: '#f1f5f9' }}>
            <strong>Token gerado:</strong>
            <p style={{ wordBreak: 'break-all' }}>{token}</p>
            <p style={{ marginTop: '0.5rem', color: '#475569' }}>
              Use este código na página de <Link to="/auth/reset-password">redefinição de senha</Link>.
            </p>
          </div>
        )}
        <div className="form-actions">
          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Enviando...' : 'Gerar token'}
          </button>
          <Link className="button ghost" to="/admin/login">
            Voltar ao login
          </Link>
        </div>
      </form>
    </div>
  );
};

export default ForgotPassword;
