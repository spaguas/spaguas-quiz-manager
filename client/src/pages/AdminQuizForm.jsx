import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';

const AdminQuizForm = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    isActive: true,
    mode: 'SEQUENTIAL',
    questionUsage: 'ALL',
    questionLimit: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (name === 'questionUsage') {
      setForm((prev) => ({
        ...prev,
        questionUsage: value,
        questionLimit: value === 'ALL' ? '' : prev.questionLimit,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const trimmedTitle = form.title.trim();
    const trimmedDescription = form.description.trim();
    const wantsLimit = form.questionUsage === 'LIMITED';
    const parsedLimit = wantsLimit ? Number(form.questionLimit) : null;

    if (trimmedTitle.length < 3) {
      setError('Informe um título com pelo menos 3 caracteres.');
      return;
    }

    if (trimmedDescription.length < 5) {
      setError('Informe uma descrição com pelo menos 5 caracteres.');
      return;
    }

    if (wantsLimit) {
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
        setError('Informe uma quantidade máxima de perguntas válida (a partir de 1).');
        return;
      }
    }

    const payload = {
      title: trimmedTitle,
      description: trimmedDescription,
      isActive: form.isActive,
      mode: form.mode,
      questionLimit: wantsLimit ? parsedLimit : null,
    };

    try {
      setLoading(true);
      const response = await api.post('/admin/quizzes', payload);
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

        <div className="form-field">
          <label htmlFor="mode">Modo das perguntas</label>
          <select id="mode" name="mode" value={form.mode} onChange={handleChange}>
            <option value="SEQUENTIAL">Sequencial (ordem fixa)</option>
            <option value="RANDOM">Aleatório (ordem aleatória)</option>
          </select>
          <small style={{ color: '#64748b' }}>
            No modo aleatório, as perguntas são sorteadas a cada tentativa.
          </small>
        </div>

        <div className="form-field">
          <label htmlFor="questionUsage">Perguntas utilizadas no quiz</label>
          <select
            id="questionUsage"
            name="questionUsage"
            value={form.questionUsage}
            onChange={handleChange}
          >
            <option value="ALL">Usar todas as perguntas cadastradas</option>
            <option value="LIMITED">Definir uma quantidade máxima</option>
          </select>
        </div>

        {form.questionUsage === 'LIMITED' && (
          <div className="form-field">
            <label htmlFor="questionLimit">Quantidade máxima de perguntas</label>
            <input
              id="questionLimit"
              name="questionLimit"
              type="number"
              min="1"
              value={form.questionLimit}
              onChange={handleChange}
              placeholder="Ex.: 5"
            />
          </div>
        )}

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
