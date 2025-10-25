import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api.js';

const PlayerQuizPlay = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/quizzes/${quizId}`);
        setQuiz(response.data);
        const defaultAnswers = {};
        response.data.questions.forEach((question) => {
          defaultAnswers[question.id] = null;
        });
        setAnswers(defaultAnswers);
      } catch (err) {
        setError(err.response?.data?.message || 'Não foi possível carregar o quiz.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  const handleOptionSelect = (questionId, optionId) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setResult(null);

    const trimmedName = userName.trim();
    const trimmedEmail = userEmail.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setFormError('Informe seu nome com pelo menos 2 caracteres.');
      return;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Informe um e-mail válido.');
      return;
    }

    const unanswered = Object.values(answers).filter((value) => !value);
    if (unanswered.length > 0) {
      setFormError('Responda todas as perguntas antes de enviar.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        userName: trimmedName,
        userEmail: trimmedEmail,
        answers: Object.entries(answers).map(([questionId, optionId]) => ({
          questionId: Number(questionId),
          optionId,
        })),
      };

      const response = await api.post(`/quizzes/${quizId}/submissions`, payload);
      setResult(response.data);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Não foi possível registrar suas respostas.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="page-loading">Carregando quiz...</div>;
  }

  if (error) {
    return (
      <div className="grid">
        <div className="card">
          <h2>Quiz indisponível</h2>
          <p className="page-description">{error}</p>
          <div className="form-actions">
            <button className="button" type="button" onClick={() => navigate('/play')}>
              Voltar à lista
            </button>
            <button className="button ghost" type="button" onClick={() => navigate(`/play/quiz/${quizId}/ranking`)}>
              Ver ranking
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return <div className="page-error">Quiz indisponível.</div>;
  }

  return (
    <div className="grid">
      <div className="page-title">
        <div>
          <h1>{quiz.title}</h1>
          <p className="page-description">{quiz.description}</p>
        </div>
        <button className="button ghost" type="button" onClick={() => navigate(`/play/quiz/${quizId}/ranking`)}>
          Ranking
        </button>
      </div>

      <form className="grid" onSubmit={handleSubmit} style={{ gap: '1.5rem' }}>
        <div className="card">
          <h2>Identificação</h2>
          <p style={{ color: '#475569', marginBottom: '1rem' }}>
            Informe seu nome e e-mail para participar do ranking (cada e-mail participa apenas uma vez por quiz).
          </p>
          <div className="form-field">
            <label htmlFor="user-name">Nome</label>
            <input
              id="user-name"
              type="text"
              placeholder="Seu nome"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="user-email">E-mail</label>
            <input
              id="user-email"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={userEmail}
              onChange={(event) => setUserEmail(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid">
          {quiz.questions.map((question) => (
            <div key={question.id} className="card">
              <h3>
                {question.order}. {question.text}
              </h3>
              <div className="options-list">
                {question.options.map((option) => (
                  <label key={option.id} className="option-item" htmlFor={`question-${question.id}-option-${option.id}`}>
                    <input
                      id={`question-${question.id}-option-${option.id}`}
                      type="radio"
                      name={`question-${question.id}`}
                      checked={answers[question.id] === option.id}
                      onChange={() => handleOptionSelect(question.id, option.id)}
                      required
                    />
                    <span>{option.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {formError && <div className="page-error" style={{ margin: 0 }}>{formError}</div>}

        <div className="form-actions">
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? 'Enviando...' : 'Enviar respostas'}
          </button>
          <button className="button ghost" type="button" onClick={() => navigate('/play')} disabled={submitting}>
            Voltar
          </button>
        </div>
      </form>

      {result && (
        <div className="card">
          <h2>Resultado</h2>
          <p>
            Você acertou <strong>{result.score}</strong> de <strong>{result.total}</strong> perguntas
            ({result.percentage.toFixed(2)}%). Sua posição atual no ranking é <strong>{result.position}º</strong>.
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              type="button"
              onClick={() => navigate(`/play/quiz/${quizId}/ranking`)}
            >
              Ver ranking completo
            </button>
            <button className="button ghost" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Voltar ao topo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerQuizPlay;
