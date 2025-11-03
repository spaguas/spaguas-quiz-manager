import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../services/api.js';

const PlayerRanking = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [ranking, setRanking] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/quizzes/${quizId}/ranking`);
        setQuiz(response.data.quiz);
        setRanking(response.data.ranking);
      } catch (err) {
        setError(err.response?.data?.message || 'Não foi possível carregar o ranking.');
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, [quizId]);

  if (loading) {
    return <div className="page-loading">Carregando ranking...</div>;
  }

  if (error) {
    return <div className="page-error">{error}</div>;
  }

  if (!quiz) {
    return <div className="page-error">Ranking indisponível.</div>;
  }

  return (
    <div className="grid">
      <br/>
      <div className="page-title">
        <div>
          <h1>Ranking – {quiz.title}</h1>
          <p className="page-description">{quiz.description}</p>
        </div>
        <div className="actions">
          <button className="button ghost" type="button" onClick={() => navigate(`/play/quiz/${quizId}`)}>
            Voltar ao quiz
          </button>
          <button className="button" type="button" onClick={() => navigate('/play')}>
            Outros quizzes
          </button>
        </div>
      </div>

      <div className="card">
        {ranking.length === 0 ? (
          <div className="empty-state">Ainda não há submissões para este quiz.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Posição</th>
                <th>Participante</th>
                <th>Resultado</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((entry) => (
                <tr key={entry.submissionId}>
                  <td>
                    <strong>{entry.position}º</strong>
                  </td>
                  <td>{entry.userName}</td>
                  <td>
                    {entry.score}/{entry.total} ({entry.percentage.toFixed(2)}%)
                  </td>
                  <td>{dayjs(entry.createdAt).format('DD/MM/YYYY HH:mm')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PlayerRanking;
