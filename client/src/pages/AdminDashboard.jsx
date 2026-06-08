import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  CheckCircle2,
  Clock,
  ClipboardList,
  Gift,
  Hash,
  HelpCircle,
  Percent,
  Send,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import api from '../services/api.js';

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) {
    return '-';
  }

  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const MetricCard = ({ icon: Icon, label, value }) => (
  <div className="card metrics-card dashboard-metric-card">
    <span className="dashboard-metric-icon" aria-hidden="true">
      <Icon size={22} strokeWidth={2.4} />
    </span>
    <div>
      <span>{label}</span>
      <span className="metrics-value">{value}</span>
    </div>
  </div>
);

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

  const {
    metrics,
    topQuizzes = [],
    topPerformers = [],
    recentActivity = [],
    quizStats = [],
    prizeStats = metrics?.prizes ?? {},
  } = data;
  const prizes = metrics.prizes ?? prizeStats;

  return (
    <div className="grid admin-dashboard">
      <div className="page-title">
        <div>
          <h1>Dashboard</h1>
          <p className="page-description">
            Visão global dos quizzes, duração dos testes, participação, premiações e atividades recentes.
          </p>
        </div>
      </div>

      <div className="metrics-grid">
        <MetricCard icon={ClipboardList} label="Total de quizzes" value={metrics.totalQuizzes} />
        <MetricCard icon={CheckCircle2} label="Quizzes ativos" value={metrics.activeQuizzes} />
        <MetricCard icon={HelpCircle} label="Perguntas cadastradas" value={metrics.totalQuestions} />
        <MetricCard icon={Send} label="Submissões" value={metrics.totalSubmissions} />
        <MetricCard icon={Users} label="Participantes únicos" value={metrics.totalParticipants} />
        <MetricCard icon={UserRoundCheck} label="Participantes temporários" value={metrics.temporaryParticipants} />
        <MetricCard icon={Percent} label="Média acertos (%)" value={metrics.averageAccuracy.toFixed(2)} />
        <MetricCard icon={Hash} label="Média de respostas corretas" value={metrics.averageScore.toFixed(2)} />
        <MetricCard icon={Clock} label="Duração média" value={formatDuration(metrics.averageDurationSeconds)} />
        <MetricCard icon={Gift} label="Prêmios retirados" value={prizes.claimed ?? 0} />
      </div>

      <div className="dashboard-card-grid">
        <div className="card">
          <h2>Duração dos testes</h2>
          <div className="dashboard-kpi-list">
            <div>
              <span>Média geral</span>
              <strong>{formatDuration(metrics.averageDurationSeconds)}</strong>
            </div>
            <div>
              <span>Mais rápido</span>
              <strong>{formatDuration(metrics.fastestDurationSeconds)}</strong>
            </div>
            <div>
              <span>Mais lento</span>
              <strong>{formatDuration(metrics.slowestDurationSeconds)}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Premiações</h2>
          <div className="dashboard-kpi-list">
            <div>
              <span>Itens configurados</span>
              <strong>{prizes.configuredItems ?? 0}</strong>
            </div>
            <div>
              <span>Quantidade total</span>
              <strong>{prizes.totalQuantity ?? 0}</strong>
            </div>
            <div>
              <span>Disponíveis</span>
              <strong>{prizes.availableQuantity ?? 0}</strong>
            </div>
            <div>
              <span>Retirados</span>
              <strong>{prizes.claimed ?? 0}</strong>
            </div>
            <div>
              <span>Não retirados</span>
              <strong>{prizes.declined ?? 0}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-card-grid">
        <div className="card">
          <h2>Quizzes mais respondidos</h2>
          {topQuizzes.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Submissões</th>
                  <th>Média %</th>
                  <th>Duração média</th>
                </tr>
              </thead>
              <tbody>
                {topQuizzes.map((quiz) => (
                  <tr key={quiz.quizId}>
                    <td>{quiz.title}</td>
                    <td>{quiz.submissions}</td>
                    <td>{quiz.averageAccuracy.toFixed(2)}</td>
                    <td>{formatDuration(quiz.averageDurationSeconds)}</td>
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
                  <th>Duração</th>
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
                    <td>{formatDuration(submission.durationSeconds)}</td>
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
        <h2>Estatísticas por quiz</h2>
        {quizStats.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Quiz</th>
                <th>Status</th>
                <th>Perguntas</th>
                <th>Submissões</th>
                <th>Média %</th>
                <th>Duração média</th>
                <th>Prêmios</th>
                <th>Estoque</th>
                <th>Retirados</th>
              </tr>
            </thead>
            <tbody>
              {quizStats.map((quiz) => (
                <tr key={quiz.quizId}>
                  <td>{quiz.title}</td>
                  <td>{quiz.isActive ? 'Ativo' : 'Inativo'}</td>
                  <td>{quiz.questions}</td>
                  <td>{quiz.submissions}</td>
                  <td>{quiz.averageAccuracy.toFixed(2)}</td>
                  <td>{formatDuration(quiz.averageDurationSeconds)}</td>
                  <td>{quiz.prizes.configuredItems} itens / {quiz.prizes.totalQuantity} un.</td>
                  <td>{quiz.prizes.availableQuantity} disp.</td>
                  <td>{quiz.prizes.claimed} retirados / {quiz.prizes.declined} não retirados</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">Nenhum quiz cadastrado.</div>
        )}
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
                <th>Duração</th>
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
                  <td>{formatDuration(submission.durationSeconds)}</td>
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
