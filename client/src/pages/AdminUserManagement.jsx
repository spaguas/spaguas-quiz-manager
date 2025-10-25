import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import api from '../services/api.js';

const createDefaultForm = () => ({
  name: '',
  email: '',
  password: '',
  role: 'USER',
});

const AdminUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(createDefaultForm);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setFeedback('');

    try {
      setSaving(true);
      await api.post('/admin/users', form);
      setFeedback('Usuário criado com sucesso!');
      setForm(createDefaultForm());
      await loadUsers();
    } catch (err) {
      const message = err.response?.data?.message || 'Não foi possível criar o usuário.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-loading">Carregando usuários...</div>;
  }

  if (error && !users.length) {
    return <div className="page-error">{error}</div>;
  }

  return (
    <div className="grid" style={{ gap: '1.5rem' }}>
      <div className="page-title">
        <div>
          <h1>Controle de usuários</h1>
          <p className="page-description">
            Cadastre novos usuários, atribua permissões administrativas e acompanhe o histórico de participações.
          </p>
        </div>
      </div>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <h2>Novo usuário</h2>
        <div className="form-field">
          <label htmlFor="name">Nome</label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="Nome completo"
            value={form.name}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="usuario@exemplo.com"
            value={form.email}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Mínimo de 6 caracteres"
            value={form.password}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="role">Perfil</label>
          <select
            id="role"
            name="role"
            value={form.role}
            onChange={handleInputChange}
          >
            <option value="USER">Participante</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>

        {error && <div className="page-error" style={{ margin: 0 }}>{error}</div>}
        {feedback && <div className="tag success">{feedback}</div>}

        <div className="form-actions">
          <button className="button" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Criar usuário'}
          </button>
        </div>
      </form>

      <div className="card">
        <h2>Usuários cadastrados</h2>
        {users.length === 0 ? (
          <div className="empty-state">Nenhum usuário cadastrado até o momento.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Submissões</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.email}</td>
                  <td>
                    <span className={`tag ${item.role === 'ADMIN' ? 'info' : 'success'}`}>
                      {item.role === 'ADMIN' ? 'Administrador' : 'Participante'}
                    </span>
                  </td>
                  <td>{item.submissionCount}</td>
                  <td>{dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminUserManagement;
