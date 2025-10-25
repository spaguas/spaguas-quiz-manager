import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

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
            Acompanhe os usuários com maior pontuação, nível e conquistas na plataforma.
          </p>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Usuário</th>
              <th>Pontos</th>
              <th>Nível</th>
              <th>Quizzes</th>
              <th>Acertos</th>
              <th>Melhor sequência</th>
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
                const trophy = leader.position === 1 ? '🥇' : leader.position === 2 ? '🥈' : leader.position === 3 ? '🥉' : '🏅';
                return (
                  <tr key={leader.userId}>
                    <td><strong>{trophy} {leader.position}º</strong></td>
                  <td>{leader.name}</td>
                  <td>{leader.points}</td>
                  <td>Nível {leader.level}</td>
                  <td>{leader.totalQuizzes}</td>
                  <td>{leader.totalCorrect}</td>
                  <td>{leader.bestStreak}</td>
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
