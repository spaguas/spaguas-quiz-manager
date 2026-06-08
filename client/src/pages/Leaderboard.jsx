import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) {
    return '-';
  }

  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const Leaderboard = () => {
  const { getLeaderboard } = useAuth();
  const [leaders, setLeaders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getLeaderboard();
        setLeaders(data);
      } catch (err) {
        setError(err.response?.data?.message || 'Não foi possível carregar o ranking.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [getLeaderboard]);

  if (loading) {
    return <div className="page-loading">Carregando ranking global...</div>;
  }

  if (error) {
    return <div className="page-error">{error}</div>;
  }

  return (
    <div className="grid">
      <div className="page-title">
        <div>
          <h1>Ranking Global</h1>
          <p className="page-description">
            Acompanhe os participantes com mais acertos. Em caso de empate, vence quem concluiu em menos tempo.
          </p>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Usuário</th>
              <th>Acertos</th>
              <th>Duração total</th>
              <th>Duração média</th>
              <th>Quizzes</th>
            </tr>
          </thead>
          <tbody>
            {leaders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem' }}>
                  Ainda não há participantes no ranking.
                </td>
              </tr>
            ) : (
              leaders.map((leader) => {
                const medal = leader.position === 1 ? '🥇' : leader.position === 2 ? '🥈' : leader.position === 3 ? '🥉' : null;
                return (
                  <tr key={leader.userId ?? leader.email ?? leader.position}>
                    <td><strong>{medal ? `${medal} ` : ''}{leader.position}º</strong></td>
                  <td>{leader.name}</td>
                  <td>{leader.totalCorrect}</td>
                  <td>{formatDuration(leader.totalDurationSeconds)}</td>
                  <td>{formatDuration(leader.averageDurationSeconds)}</td>
                  <td>{leader.totalQuizzes}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaderboard;
