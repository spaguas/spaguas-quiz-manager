import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import api from '../services/api.js';

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const response = await api.get('/admin/dashboard');
        setData(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Não foi possível carregar o dashboard.');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  if (loading) {
    return <div className="page-loading">Carregando dashboard...</div>;
  }

  if (error) {
    return <div className="page-error">{error}</div>;
  }

  if (!data) {
    return <div className="page-error">Dados indisponíveis.</div>;
  }

  const { metrics, topQuizzes, topPerformers, recentActivity } = data;

  return (
    <div className="grid">
      <div className="page-title">
        <div>
          <h1>Dashboard</h1>
          <p className="page-description">
            Visão geral do desempenho dos quizzes, participação dos usuários e atividades recentes.
          </p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="card metrics-card">
          <span>Total de quizzes</span>
          <span className="metrics-value">{metrics.totalQuizzes}</span>
        </div>
        <div className="card metrics-card">
          <span>Quizzes ativos</span>
          <span className="metrics-value">{metrics.activeQuizzes}</span>
        </div>
        <div className="card metrics-card">
          <span>Perguntas cadastradas</span>
          <span className="metrics-value">{metrics.totalQuestions}</span>
        </div>
        <div className="card metrics-card">
          <span>Submissões</span>
          <span className="metrics-value">{metrics.totalSubmissions}</span>
        </div>
        <div className="card metrics-card">
          <span>Média acertos (%)</span>
          <span className="metrics-value">{metrics.averageAccuracy.toFixed(2)}</span>
        </div>
        <div className="card metrics-card">
          <span>Média de respostas corretas</span>
          <span className="metrics-value">{metrics.averageScore.toFixed(2)}</span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="card">
          <h2>Quizzes mais respondidos</h2>
          {topQuizzes.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Submissões</th>
                  <th>Média %</th>
                </tr>
              </thead>
              <tbody>
                {topQuizzes.map((quiz) => (
                  <tr key={quiz.quizId}>
                    <td>{quiz.title}</td>
                    <td>{quiz.submissions}</td>
                    <td>{quiz.averageAccuracy.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">Ainda não há submissões registradas.</div>
          )}
        </div>

        <div className="card">
          <h2>Top participantes</h2>
          {topPerformers.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Participante</th>
                  <th>Quiz</th>
                  <th>Acertos</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {topPerformers.map((submission) => (
                  <tr key={submission.submissionId}>
                    <td>{submission.userName}</td>
                    <td>{submission.quizTitle}</td>
                    <td>
                      {submission.score}/{submission.total}
                    </td>
                    <td>{submission.percentage.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">Participações aparecerão aqui.</div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Atividade recente</h2>
        {recentActivity.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Participante</th>
                <th>Quiz</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((submission) => (
                <tr key={submission.submissionId}>
                  <td>{dayjs(submission.createdAt).format('DD/MM/YYYY HH:mm')}</td>
                  <td>{submission.userName}</td>
                  <td>{submission.quizTitle}</td>
                  <td>
                    {submission.score}/{submission.total} ({submission.percentage.toFixed(2)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">Nenhuma atividade recente foi registrada.</div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
