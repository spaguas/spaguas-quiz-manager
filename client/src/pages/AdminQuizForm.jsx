import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';

const AdminQuizForm = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      const response = await api.post('/admin/quizzes', form);
      setSuccess('Quiz criado com sucesso!');
      setTimeout(() => {
        navigate(`/admin/quizzes/${response.data.id}/questions`);
      }, 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Não foi possível criar o quiz.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid">
      <div className="page-title">
        <div>
          <h1>Novo quiz</h1>
          <p className="page-description">
            Cadastre as informações principais do quiz. Depois, inclua perguntas e alternativas.
          </p>
        </div>
      </div>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="title">Título</label>
          <input
            id="title"
            name="title"
            type="text"
            placeholder="Ex.: Fundamentos de JavaScript"
            value={form.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="description">Descrição</label>
          <textarea
            id="description"
            name="description"
            placeholder="Explique o objetivo do quiz"
            value={form.description}
            onChange={handleChange}
            required
          />
        </div>

        <div className="checkbox-field">
          <input
            id="isActive"
            name="isActive"
            type="checkbox"
            checked={form.isActive}
            onChange={handleChange}
          />
          <label htmlFor="isActive">Quiz ativo</label>
        </div>

        {error && <div className="page-error" style={{ margin: 0 }}>{error}</div>}
        {success && <div className="tag success">{success}</div>}

        <div className="form-actions">
          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Salvando...' : 'Criar quiz'}
          </button>
          <button className="button ghost" type="button" onClick={() => navigate(-1)} disabled={loading}>
            Voltar
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminQuizForm;
