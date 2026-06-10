import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PlayerCompetitiveQuizPlay = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [session, setSession] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [joining, setJoining] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [now, setNow] = useState(Date.now());
  const startedAtRef = useRef(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/quizzes/${quizId}`);
        setQuiz(response.data);
        if (response.data?.mode !== 'COMPETITIVE') {
          navigate(`/play/quiz/${quizId}`, { replace: true });
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Não foi possível carregar o quiz.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [navigate, quizId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session?.token || ['COMPLETED', 'EXPIRED'].includes(session.status)) {
      return undefined;
    }

    const poll = async () => {
      try {
        const response = await api.get(`/quizzes/${quizId}/competitive/lobby/${session.token}`);
        setSession(response.data);
        if (response.data?.status === 'ACTIVE' && !startedAtRef.current) {
          startedAtRef.current = Date.now();
        }
      } catch (err) {
        setFeedback(err.response?.data?.message || 'Não foi possível atualizar o lobby.');
      }
    };

    const interval = window.setInterval(poll, 600);
    return () => window.clearInterval(interval);
  }, [quizId, session?.status, session?.token]);

  useEffect(() => {
    setSelectedOptionId(null);
    setFeedback('');
    if (session?.status === 'ACTIVE' && session.startsAt) {
      startedAtRef.current = new Date(session.startsAt).getTime();
    }
  }, [session?.question?.id, session?.startsAt, session?.status]);

  const remainingMs = useMemo(() => {
    if (!session?.endsAt || session.status !== 'ACTIVE') {
      return null;
    }
    return Math.max(0, new Date(session.endsAt).getTime() - now);
  }, [now, session?.endsAt, session?.status]);

  const handleJoin = async (event) => {
    event.preventDefault();
    setFeedback('');

    const trimmedName = userName.trim();
    const trimmedEmail = userEmail.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setFeedback('Informe seu nome com pelo menos 2 caracteres.');
      return;
    }

    if (!emailRegex.test(trimmedEmail)) {
      setFeedback('Informe um e-mail válido.');
      return;
    }

    try {
      setJoining(true);
      const response = await api.post(`/quizzes/${quizId}/competitive/lobby`, {
        userName: trimmedName,
        userEmail: trimmedEmail,
      });
      setSession(response.data);
      setSelectedOptionId(null);
      startedAtRef.current = response.data?.status === 'ACTIVE' ? Date.now() : null;
    } catch (err) {
      setFeedback(err.response?.data?.message || 'Não foi possível entrar no lobby.');
    } finally {
      setJoining(false);
    }
  };

  const handleAnswer = async () => {
    if (!session?.token || !selectedOptionId || answering || session.ownAnswer) {
      return;
    }

    try {
      setAnswering(true);
      setFeedback('');
      const response = await api.post(`/quizzes/${quizId}/competitive/lobby/${session.token}/answer`, {
        optionId: selectedOptionId,
        responseMs: startedAtRef.current ? Date.now() - startedAtRef.current : 0,
      });
      setSession(response.data);
      if (response.data?.ownAnswer) {
        setFeedback('Resposta registrada. A próxima pergunta será liberada quando todos responderem ou o tempo acabar.');
      }
    } catch (err) {
      setFeedback(err.response?.data?.message || 'Não foi possível registrar sua resposta.');
    } finally {
      setAnswering(false);
    }
  };

  if (loading) {
    return <div className="page-loading">Carregando quiz competitivo...</div>;
  }

  if (error) {
    return <div className="page-error">{error}</div>;
  }

  const isWaiting = session?.status === 'WAITING';
  const isActive = session?.status === 'ACTIVE';
  const isFinished = ['COMPLETED', 'EXPIRED'].includes(session?.status);
  const secondsLeft = remainingMs === null ? null : Math.ceil(remainingMs / 1000);
  const opponentLabel = session?.opponent?.userName ? `Você está disputando contra ${session.opponent.userName}.` : '';
  const scoreboard = Array.isArray(session?.scoreboard) ? session.scoreboard : [];

  return (
    <div className="grid">
      <div className="page-title">
        <div>
          <h1>{quiz?.title ?? 'Quiz competitivo'}</h1>
          <p className="page-description">{quiz?.description}</p>
        </div>
        <button className="button ghost" type="button" onClick={() => navigate('/play')}>
          Voltar
        </button>
      </div>

      {!session && (
        <form className="card form-grid" onSubmit={handleJoin}>
          <h2>Lobby competitivo</h2>
          <div className="form-field">
            <label htmlFor="competitive-name">Nome</label>
            <input
              id="competitive-name"
              type="text"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              placeholder="Seu nome"
            />
          </div>
          <div className="form-field">
            <label htmlFor="competitive-email">E-mail</label>
            <input
              id="competitive-email"
              type="email"
              value={userEmail}
              onChange={(event) => setUserEmail(event.target.value)}
              placeholder="seuemail@exemplo.com"
            />
          </div>
          {feedback && <div className="page-error" style={{ margin: 0 }}>{feedback}</div>}
          <div className="form-actions">
            <button className="button" type="submit" disabled={joining}>
              {joining ? 'Entrando...' : 'Entrar no lobby'}
            </button>
          </div>
        </form>
      )}

      {isWaiting && (
        <div className="card">
          <h2>Aguardando competidor</h2>
          <p className="page-description">
            Sua sessão está pronta. Quando outra pessoa entrar, a pergunta será liberada automaticamente.
          </p>
          <div className="stat-list">
            {session.participants.map((participant) => (
              <div className="stat-item" key={participant.id}>
                <strong>{participant.isSelf ? 'Você' : `Competidor ${participant.slot}`}</strong>
                <span>{participant.userName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isActive && session.question && (
        <div className="card wizard-question">
          {opponentLabel && (
            <p className="page-description" style={{ marginTop: 0 }}>{opponentLabel}</p>
          )}
          {scoreboard.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
                flexWrap: 'wrap',
              }}
            >
              {scoreboard.map((player) => (
                <div
                  key={player.participantId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    minWidth: '180px',
                  }}
                >
                  <img
                    src={player.avatarUrl}
                    alt={player.userName}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: player.isSelf ? '3px solid #2563eb' : '3px solid #cbd5e1',
                    }}
                  />
                  <div>
                    <strong>{player.isSelf ? 'Você' : player.userName}</strong>
                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                      {player.score} ponto(s)
                      {player.hasAnsweredCurrentQuestion ? ' - respondeu' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="wizard-question-header">
            <span className="wizard-question-index">
              Pergunta {session.currentQuestionNumber ?? 1} de {session.totalQuestions ?? 1}
            </span>
            <span className={`tag ${secondsLeft > 5 ? 'info' : 'danger'}`}>
              {secondsLeft}s
            </span>
          </div>
          <h3>{session.question.text}</h3>
          <div className="options-list">
            {session.question.options.map((option) => (
              <label
                key={option.id}
                className={`option-item ${selectedOptionId === option.id ? 'selected' : ''}`}
                htmlFor={`competitive-option-${option.id}`}
              >
                <input
                  id={`competitive-option-${option.id}`}
                  type="radio"
                  name="competitive-answer"
                  checked={selectedOptionId === option.id}
                  disabled={Boolean(session.ownAnswer)}
                  onChange={() => setSelectedOptionId(option.id)}
                />
                <span>{option.text}</span>
              </label>
            ))}
          </div>
          {session.ownAnswer && (
            <div className="answer-feedback warning">
              Resposta enviada em {(session.ownAnswer.responseMs / 1000).toFixed(2)}s.
            </div>
          )}
          {feedback && <div className="tag info">{feedback}</div>}
          <div className="wizard-actions">
            <button
              className="button"
              type="button"
              disabled={!selectedOptionId || answering || Boolean(session.ownAnswer)}
              onClick={handleAnswer}
            >
              {answering ? 'Enviando...' : session.ownAnswer ? 'Resposta registrada' : 'Responder'}
            </button>
          </div>
        </div>
      )}

      {isFinished && session.result && (
        <div className="card">
          <h2>Resultado da disputa</h2>
          <p>
            {session.result.didWin
              ? 'Você venceu esta rodada.'
              : session.result.winnerParticipantId
                ? 'Você não venceu esta rodada.'
                : session.result.outcome === 'TIE'
                  ? 'A disputa terminou empatada.'
                  : 'A disputa terminou sem vencedor.'}
          </p>
          <p className="page-description">{session.result.message}</p>
          <div className="stat-list">
            {session.result.answers.map((answer) => (
              <div className="stat-item" key={answer.participantId}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img
                    src={answer.avatarUrl}
                    alt={answer.userName}
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  {answer.isSelf ? 'Você' : answer.userName}
                </strong>
                <span>
                  {answer.score} ponto(s) em {answer.answeredQuestions} resposta(s)
                  {answer.totalResponseMs > 0 ? ` - ${(answer.totalResponseMs / 1000).toFixed(2)}s` : ''}
                </span>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button
              className="button"
              type="button"
              onClick={() => {
                setSession(null);
                setSelectedOptionId(null);
                setFeedback('');
                startedAtRef.current = null;
              }}
            >
              Nova disputa
            </button>
            <button className="button ghost" type="button" onClick={() => navigate('/play')}>
              Voltar aos quizzes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerCompetitiveQuizPlay;
