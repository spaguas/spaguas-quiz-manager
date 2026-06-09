import { useEffect, useMemo, useState } from 'react';
import { Award, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import api from '../services/api.js';

const metricOptions = [
  { value: 'points', label: 'Pontos' },
  { value: 'level', label: 'Nível' },
  { value: 'experience', label: 'Experiência' },
  { value: 'totalQuizzes', label: 'Quizzes concluídos' },
  { value: 'totalCorrect', label: 'Acertos acumulados' },
  { value: 'totalIncorrect', label: 'Erros acumulados' },
  { value: 'bestStreak', label: 'Melhor sequência 100%' },
  { value: 'currentStreak', label: 'Sequência atual 100%' },
  { value: 'accuracyPercentage', label: 'Percentual de acerto' },
];

const operatorOptions = [
  { value: 'gte', label: 'Maior ou igual' },
  { value: 'gt', label: 'Maior que' },
  { value: 'eq', label: 'Igual a' },
  { value: 'lte', label: 'Menor ou igual' },
  { value: 'lt', label: 'Menor que' },
];

const createDefaultForm = () => ({
  code: '',
  name: '',
  description: '',
  icon: '🏅',
  conditionMetric: 'totalQuizzes',
  conditionOperator: 'gte',
  conditionValue: 1,
  isActive: true,
});

const metricLabel = (value) => metricOptions.find((option) => option.value === value)?.label || value;
const operatorLabel = (value) => operatorOptions.find((option) => option.value === value)?.label || value;

const AdminGamification = () => {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [form, setForm] = useState(createDefaultForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(createDefaultForm);

  const activeCount = useMemo(() => badges.filter((badge) => badge.isActive).length, [badges]);

  const loadBadges = async () => {
    try {
      setLoading(true);
      const response = await api.get('/gamification/admin/badges');
      setBadges(response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Não foi possível carregar as conquistas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBadges();
  }, []);

  const handleFormChange = (event) => {
    const { name, type, checked, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }));
  };

  const handleEditChange = (event) => {
    const { name, type, checked, value } = event.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFeedback('');

    try {
      await api.post('/gamification/admin/badges', form);
      setForm(createDefaultForm());
      setFeedback('Conquista cadastrada com sucesso.');
      await loadBadges();
    } catch (err) {
      setError(err.response?.data?.message || 'Não foi possível cadastrar a conquista.');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (badge) => {
    setEditingId(badge.id);
    setEditForm({
      code: badge.code,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      conditionMetric: badge.conditionMetric,
      conditionOperator: badge.conditionOperator,
      conditionValue: badge.conditionValue,
      isActive: badge.isActive,
    });
    setError('');
    setFeedback('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(createDefaultForm());
  };

  const handleUpdate = async (badgeId) => {
    setSaving(true);
    setError('');
    setFeedback('');

    try {
      await api.patch(`/gamification/admin/badges/${badgeId}`, editForm);
      cancelEditing();
      setFeedback('Conquista atualizada com sucesso.');
      await loadBadges();
    } catch (err) {
      setError(err.response?.data?.message || 'Não foi possível atualizar a conquista.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (badgeId) => {
    const confirmed = window.confirm('Remover esta conquista e os vínculos já atribuídos aos usuários?');
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError('');
    setFeedback('');

    try {
      await api.delete(`/gamification/admin/badges/${badgeId}`);
      setFeedback('Conquista removida com sucesso.');
      await loadBadges();
    } catch (err) {
      setError(err.response?.data?.message || 'Não foi possível remover a conquista.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-loading">Carregando gamificação...</div>;
  }

  return (
    <div className="grid" style={{ gap: '1.5rem' }}>
      <div className="page-title">
        <div>
          <h1>Gamificação</h1>
          <p className="page-description">
            Cadastre conquistas e defina as condições necessárias para desbloqueio automático.
          </p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="dashboard-metric-card">
          <Award size={24} />
          <div>
            <span>Conquistas cadastradas</span>
            <strong>{badges.length}</strong>
          </div>
        </div>
        <div className="dashboard-metric-card">
          <Award size={24} />
          <div>
            <span>Conquistas ativas</span>
            <strong>{activeCount}</strong>
          </div>
        </div>
      </div>

      <form className="card form-grid" onSubmit={handleCreate}>
        <div className="section-heading">
          <div>
            <h2>Nova conquista</h2>
            <p className="page-description">A regra será avaliada a cada finalização de quiz.</p>
          </div>
        </div>

        <div className="admin-gamification-form">
          <div className="form-field">
            <label htmlFor="code">Código</label>
            <input id="code" name="code" type="text" value={form.code} onChange={handleFormChange} required />
          </div>
          <div className="form-field">
            <label htmlFor="name">Nome</label>
            <input id="name" name="name" type="text" value={form.name} onChange={handleFormChange} required />
          </div>
          <div className="form-field">
            <label htmlFor="icon">Ícone</label>
            <input id="icon" name="icon" type="text" value={form.icon} onChange={handleFormChange} required />
          </div>
          <div className="form-field">
            <label htmlFor="conditionMetric">Métrica</label>
            <select id="conditionMetric" name="conditionMetric" value={form.conditionMetric} onChange={handleFormChange}>
              {metricOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="conditionOperator">Condição</label>
            <select
              id="conditionOperator"
              name="conditionOperator"
              value={form.conditionOperator}
              onChange={handleFormChange}
            >
              {operatorOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="conditionValue">Valor</label>
            <input
              id="conditionValue"
              name="conditionValue"
              type="number"
              min="0"
              step="0.01"
              value={form.conditionValue}
              onChange={handleFormChange}
              required
            />
          </div>
          <div className="form-field admin-gamification-description">
            <label htmlFor="description">Descrição</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleFormChange}
              required
            />
          </div>
          <label className="checkbox-field">
            <input name="isActive" type="checkbox" checked={form.isActive} onChange={handleFormChange} />
            Ativa
          </label>
        </div>

        {error && <div className="page-error" style={{ margin: 0 }}>{error}</div>}
        {feedback && <div className="tag success">{feedback}</div>}

        <div className="form-actions">
          <button className="button" type="submit" disabled={saving}>
            <Plus size={16} />
            {saving ? 'Salvando...' : 'Cadastrar conquista'}
          </button>
        </div>
      </form>

      <div className="card">
        <h2>Conquistas cadastradas</h2>
        {badges.length === 0 ? (
          <div className="empty-state">Nenhuma conquista cadastrada até o momento.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Conquista</th>
                <th>Regra</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {badges.map((badge) => {
                const isEditing = editingId === badge.id;
                return (
                  <tr key={badge.id}>
                    <td>
                      {isEditing ? (
                        <div className="admin-gamification-inline">
                          <input name="icon" type="text" value={editForm.icon} onChange={handleEditChange} required />
                          <input name="code" type="text" value={editForm.code} onChange={handleEditChange} required />
                          <input name="name" type="text" value={editForm.name} onChange={handleEditChange} required />
                          <textarea
                            name="description"
                            value={editForm.description}
                            onChange={handleEditChange}
                            required
                          />
                        </div>
                      ) : (
                        <div className="admin-gamification-badge">
                          <span className="admin-gamification-icon">{badge.icon}</span>
                          <div>
                            <strong>{badge.name}</strong>
                            <span>{badge.code}</span>
                            <small>{badge.description}</small>
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="admin-gamification-inline">
                          <select name="conditionMetric" value={editForm.conditionMetric} onChange={handleEditChange}>
                            {metricOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <select
                            name="conditionOperator"
                            value={editForm.conditionOperator}
                            onChange={handleEditChange}
                          >
                            {operatorOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <input
                            name="conditionValue"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.conditionValue}
                            onChange={handleEditChange}
                            required
                          />
                        </div>
                      ) : (
                        <span>
                          {metricLabel(badge.conditionMetric)} {operatorLabel(badge.conditionOperator).toLowerCase()}{' '}
                          {badge.conditionValue}
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <label className="checkbox-field">
                          <input
                            name="isActive"
                            type="checkbox"
                            checked={editForm.isActive}
                            onChange={handleEditChange}
                          />
                          Ativa
                        </label>
                      ) : (
                        <span className={`tag ${badge.isActive ? 'success' : 'warning'}`}>
                          {badge.isActive ? 'Ativa' : 'Inativa'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        {isEditing ? (
                          <>
                            <button className="button icon-button" type="button" onClick={() => handleUpdate(badge.id)} disabled={saving} title="Salvar">
                              <Save size={16} />
                            </button>
                            <button className="button ghost icon-button" type="button" onClick={cancelEditing} disabled={saving} title="Cancelar">
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="button ghost icon-button" type="button" onClick={() => startEditing(badge)} title="Editar">
                              <Pencil size={16} />
                            </button>
                            <button className="button ghost icon-button" type="button" onClick={() => handleDelete(badge.id)} title="Remover">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminGamification;
