import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../services/api.js';

const AdminQuizList = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();

  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setActionError('');
      const response = await api.get('/admin/quizzes');
      setQuizzes(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Não foi possível carregar os quizzes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleDelete = async (quizId, quizTitle) => {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o quiz "${quizTitle}"? Esta ação não pode ser desfeita.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(quizId);
      setActionError('');
      await api.delete(`/admin/quizzes/${quizId}`);
      setQuizzes((prev) => prev.filter((quiz) => quiz.id !== quizId));
    } catch (err) {
      setActionError(err.response?.data?.message || 'Não foi possível excluir o quiz.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="page-loading">Carregando quizzes...</div>;
  }

  if (error) {
    return <div className="page-error">{error}</div>;
  }

  return (
    <div className="grid">
      <div className="page-title">
        <div>
          <h1>Quizzes cadastrados</h1>
          <p className="page-description">
            Consulte todos os quizzes existentes, visualize perguntas e acesse atalhos para manutenção.
          </p>
        </div>
        <button className="button" type="button" onClick={() => navigate('/admin/quizzes/new')}>
          Novo quiz
        </button>
      </div>

      {actionError && (
        <div className="page-error" style={{ marginTop: 0, padding: '1rem 1.25rem', textAlign: 'left' }}>
          {actionError}
        </div>
      )}

      {quizzes.length === 0 ? (
        <div className="empty-state">Nenhum quiz cadastrado ainda. Crie o primeiro usando o botão acima.</div>
      ) : (
        <div className="grid" style={{ gap: '1.25rem' }}>
          {quizzes.map((quiz) => {
            const totalQuestions = quiz.questions?.length || 0;
            const limit = quiz.questionLimit ?? null;
            const questionsUsed = limit ? Math.min(limit, totalQuestions) : totalQuestions;
            return (
              <div key={quiz.id} className="card">
                <h2>{quiz.title}</h2>
                <p style={{ color: '#475569', marginBottom: '1rem' }}>{quiz.description}</p>
                <div className="stat-list">
                  <div className="stat-item">
                    <strong>Status</strong>
                    <span className={quiz.isActive ? 'status-active' : 'status-inactive'}>
                      {quiz.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="stat-item">
                    <strong>Perguntas</strong>
                    <span>
                      {limit ? `${questionsUsed} / ${totalQuestions}` : totalQuestions}
                    </span>
                  </div>
                  <div className="stat-item">
                    <strong>Modo</strong>
                    <span>{quiz.mode === 'RANDOM' ? 'Aleatório' : 'Sequencial'}</span>
                  </div>
                  <div className="stat-item">
                    <strong>Criado em</strong>
                    <span>{dayjs(quiz.createdAt).format('DD/MM/YYYY')}</span>
                  </div>
                </div>
                <div className="list-divider" />
                <div className="table-actions">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => navigate(`/admin/quizzes/${quiz.id}/questions`)}
                  >
                    Gerenciar perguntas
                  </button>
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => navigate(`/play/quiz/${quiz.id}/ranking`)}
                  >
                    Ver ranking
                  </button>
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => navigate(`/play/quiz/${quiz.id}`)}
                  >
                    Pré-visualizar quiz
                  </button>
                  <button
                    className="button danger"
                    type="button"
                    onClick={() => handleDelete(quiz.id, quiz.title)}
                    disabled={deletingId === quiz.id}
                  >
                    {deletingId === quiz.id ? 'Excluindo...' : 'Excluir quiz'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminQuizList;
