import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  HelpCircle,
  MapPin,
  Percent,
  Send,
  Trophy,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import DashboardClientMap from '../components/DashboardClientMap.jsx';
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

const AdminQuizDashboard = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get(`/admin/quizzes/${quizId}/dashboard`);
        setData(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Não foi possível carregar o dashboard do quiz.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [quizId]);

  if (loading) {
    return <div className="page-loading">Carregando dashboard do quiz...</div>;
  }

  if (error) {
    return <div className="page-error">{error}</div>;
  }

  if (!data) {
    return <div className="page-error">Dados indisponíveis.</div>;
  }

  const {
    quiz,
    metrics,
    prizes = [],
    questionStats = [],
    scoreDistribution = [],
    topPerformers = [],
    recentActivity = [],
    clientSummary = [],
    clientMetadata = {},
    clientInteractions = [],
    geoInteractions = [],
  } = data;
  const prizeStats = metrics.prizes ?? {};

  return (
    <div className="grid admin-dashboard">
      <div className="page-title">
        <div>
          <button className="button ghost" type="button" onClick={() => navigate('/admin/quizzes')}>
            <ArrowLeft size={16} />
            Voltar
          </button>
          <h1>{quiz.title}</h1>
          <p className="page-description">
            Dashboard individual com estatísticas, premiações, desempenho por pergunta e dados de cliente deste quiz.
          </p>
        </div>
        <button className="button secondary" type="button" onClick={() => navigate(`/admin/quizzes/${quiz.id}/questions`)}>
          Gerenciar quiz
        </button>
      </div>

      <div className="metrics-grid">
        <MetricCard icon={HelpCircle} label="Perguntas" value={metrics.totalQuestions} />
        <MetricCard icon={Send} label="Submissões" value={metrics.totalSubmissions} />
        <MetricCard icon={Users} label="Participantes" value={metrics.totalParticipants} />
        <MetricCard icon={UserRoundCheck} label="Temporários" value={metrics.temporaryParticipants} />
        <MetricCard icon={Percent} label="Média acertos (%)" value={metrics.averageAccuracy.toFixed(2)} />
        <MetricCard icon={CheckCircle2} label="Média de acertos" value={metrics.averageScore.toFixed(2)} />
        <MetricCard icon={Clock} label="Duração média" value={formatDuration(metrics.averageDurationSeconds)} />
        <MetricCard icon={Trophy} label="Prêmios retirados" value={prizeStats.claimed ?? 0} />
        <MetricCard icon={Users} label="IPs únicos" value={clientMetadata.uniqueIps ?? 0} />
        <MetricCard icon={MapPin} label="Pontos no mapa" value={geoInteractions.length} />
      </div>

      <div className="dashboard-card-grid">
        <div className="card">
          <h2>Duração</h2>
          <div className="dashboard-kpi-list">
            <div>
              <span>Média</span>
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
              <strong>{prizeStats.configuredItems ?? 0}</strong>
            </div>
            <div>
              <span>Quantidade total</span>
              <strong>{prizeStats.totalQuantity ?? 0}</strong>
            </div>
            <div>
              <span>Disponíveis</span>
              <strong>{prizeStats.availableQuantity ?? 0}</strong>
            </div>
            <div>
              <span>Retirados</span>
              <strong>{prizeStats.claimed ?? 0}</strong>
            </div>
            <div>
              <span>Não retirados</span>
              <strong>{prizeStats.declined ?? 0}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-card-grid">
        <div className="card">
          <h2>Mapa de interações</h2>
          {geoInteractions.length ? (
            <>
              <DashboardClientMap points={geoInteractions} />
              <div className="map-legend">
                <span><i style={{ background: '#16a34a' }} />80% ou mais</span>
                <span><i style={{ background: '#ca8a04' }} />50% a 79%</span>
                <span><i style={{ background: '#dc2626' }} />abaixo de 50%</span>
              </div>
            </>
          ) : (
            <div className="empty-state">
              Ainda não há interações com coordenadas para este quiz.
            </div>
          )}
        </div>

        <div className="card">
          <h2>Distribuição de acertos</h2>
          {scoreDistribution.length ? (
            <div className="dashboard-bars">
              {scoreDistribution.map((item) => (
                <div className="dashboard-bar-row" key={item.range}>
                  <div>
                    <span>{item.range}</span>
                    <strong>{item.count}</strong>
                  </div>
                  <div className="dashboard-bar-track">
                    <span style={{ width: `${Math.min(100, (item.count / metrics.totalSubmissions) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Ainda não há submissões para calcular a distribuição.</div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Desempenho por pergunta</h2>
        {questionStats.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Ordem</th>
                <th>Pergunta</th>
                <th>Tentativas</th>
                <th>Acertos</th>
                <th>Erros</th>
                <th>% acerto</th>
              </tr>
            </thead>
            <tbody>
              {questionStats.map((question) => (
                <tr key={question.questionId}>
                  <td>{question.order}</td>
                  <td>{question.text}</td>
                  <td>{question.attempts}</td>
                  <td>{question.correct}</td>
                  <td>{question.incorrect}</td>
                  <td>{question.accuracy.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">Nenhuma pergunta cadastrada.</div>
        )}
      </div>

      <div className="dashboard-card-grid">
        <div className="card">
          <h2>Top participantes</h2>
          {topPerformers.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Participante</th>
                  <th>Resultado</th>
                  <th>%</th>
                  <th>Duração</th>
                </tr>
              </thead>
              <tbody>
                {topPerformers.map((submission) => (
                  <tr key={submission.submissionId}>
                    <td>{submission.userName}</td>
                    <td>{submission.score}/{submission.total}</td>
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

        <div className="card">
          <h2>Ambiente do cliente</h2>
          {clientSummary.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Dispositivo</th>
                  <th>Navegador</th>
                  <th>Sistema</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {clientSummary.map((item) => (
                  <tr key={`${item.deviceType}-${item.browserName}-${item.osName}`}>
                    <td>{item.deviceType}</td>
                    <td>{item.browserName}</td>
                    <td>{item.osName}</td>
                    <td>{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">Metadados de cliente ainda não foram coletados.</div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Prêmios configurados</h2>
        {prizes.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Posição</th>
                <th>Prêmio</th>
                <th>Quantidade</th>
                <th>Disponível</th>
                <th>Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {prizes.map((prize) => (
                <tr key={prize.id}>
                  <td>{prize.position}</td>
                  <td>{prize.name}</td>
                  <td>{prize.quantity}</td>
                  <td>{prize.availableQuantity}</td>
                  <td>{prize.minimumPercentage.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">Nenhum prêmio configurado para este quiz.</div>
        )}
      </div>

      <div className="card">
        <h2>Interações recentes</h2>
        {recentActivity.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Participante</th>
                <th>Resultado</th>
                <th>Duração</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((submission) => (
                <tr key={submission.submissionId}>
                  <td>{dayjs(submission.createdAt).format('DD/MM/YYYY HH:mm')}</td>
                  <td>{submission.userName}</td>
                  <td>{submission.score}/{submission.total} ({submission.percentage.toFixed(2)}%)</td>
                  <td>{formatDuration(submission.durationSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">Nenhuma atividade recente foi registrada.</div>
        )}
      </div>

      <div className="card">
        <h2>Metadados de cliente</h2>
        {clientInteractions.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Participante</th>
                <th>IP</th>
                <th>Navegador</th>
                <th>Dispositivo</th>
                <th>Localização</th>
              </tr>
            </thead>
            <tbody>
              {clientInteractions.slice(0, 25).map((item) => (
                <tr key={item.submissionId}>
                  <td>{dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}</td>
                  <td>{item.userName}</td>
                  <td>{item.ipAddress || '-'}</td>
                  <td>{item.browserName || '-'} {item.browserVersion || ''}</td>
                  <td>{item.deviceType || '-'} / {item.osName || '-'}</td>
                  <td>
                    {Number.isFinite(item.geoLatitude) && Number.isFinite(item.geoLongitude)
                      ? `${item.geoLatitude.toFixed(5)}, ${item.geoLongitude.toFixed(5)}`
                      : item.geoStatus || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">Nenhum metadado de cliente foi registrado para este quiz.</div>
        )}
      </div>
    </div>
  );
};

export default AdminQuizDashboard;
