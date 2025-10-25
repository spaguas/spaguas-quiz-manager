import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../services/api.js';

const AdminQuizList = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        setLoading(true);
        const response = await api.get('/admin/quizzes');
        setQuizzes(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Não foi possível carregar os quizzes.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, []);

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

      {quizzes.length === 0 ? (
        <div className="empty-state">Nenhum quiz cadastrado ainda. Crie o primeiro usando o botão acima.</div>
      ) : (
        <div className="grid" style={{ gap: '1.25rem' }}>
          {quizzes.map((quiz) => (
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
                  <span>{quiz.questions?.length || 0}</span>
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminQuizList;
