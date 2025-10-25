import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../services/api.js';

const PlayerQuizList = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        setLoading(true);
        const response = await api.get('/quizzes');
        setQuizzes(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Não foi possível carregar os quizzes ativos.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, []);

  if (loading) {
    return <div className="page-loading">Carregando quizzes disponíveis...</div>;
  }

  if (error) {
    return <div className="page-error">{error}</div>;
  }

  return (
    <div className="grid">
      <div className="page-title">
        <div>
          <h1>Quizzes disponíveis</h1>
          <p className="page-description">
            Escolha um quiz ativo para testar seus conhecimentos e disputar o ranking.
          </p>
        </div>
      </div>

      {quizzes.length === 0 ? (
        <div className="empty-state">Nenhum quiz ativo no momento. Volte mais tarde!</div>
      ) : (
        <div className="grid" style={{ gap: '1.25rem' }}>
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="card">
              <h2>{quiz.title}</h2>
              <p style={{ color: '#475569', marginBottom: '1rem' }}>{quiz.description}</p>
              {quiz.questionCount === 0 && (
                <div className="tag warning">
                  Este quiz ainda não possui perguntas disponíveis.
                </div>
              )}
              <div className="stat-list">
                <div className="stat-item">
                  <strong>Perguntas</strong>
                  <span>{quiz.questionCount}</span>
                </div>
                <div className="stat-item">
                  <strong>Submissões</strong>
                  <span>{quiz.submissionCount}</span>
                </div>
                <div className="stat-item">
                  <strong>Disponível desde</strong>
                  <span>{dayjs(quiz.createdAt).format('DD/MM/YYYY')}</span>
                </div>
              </div>
              <div className="form-actions" style={{ marginTop: '1.5rem' }}>
                <button
                  className="button"
                  type="button"
                  disabled={quiz.questionCount === 0}
                  onClick={() => navigate(`/play/quiz/${quiz.id}`)}
                >
                  {quiz.questionCount === 0 ? 'Indisponível' : 'Iniciar quiz'}
                </button>
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => navigate(`/play/quiz/${quiz.id}/ranking`)}
                >
                  Ver ranking
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlayerQuizList;
