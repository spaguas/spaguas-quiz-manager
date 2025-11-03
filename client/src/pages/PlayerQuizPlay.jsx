import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const extractYouTubeVideoId = (url) => {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      return parsed.pathname.slice(1);
    }

    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (parsed.searchParams.has('v')) {
        return parsed.searchParams.get('v');
      }

      const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) {
        return embedMatch[1];
      }

      const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?]+)/);
      if (shortsMatch) {
        return shortsMatch[1];
      }
    }
  } catch (error) {
    return null;
  }

  return null;
};

const buildYouTubeBackgroundUrl = (url, { start, end, loop, muted }) => {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return null;
  }

  const params = new URLSearchParams({
    autoplay: '1',
    controls: '0',
    modestbranding: '1',
    rel: '0',
    showinfo: '0',
    disablekb: '1',
    playsinline: '1',
    fs: '0',
    iv_load_policy: '3',
    cc_load_policy: '0',
    autohide: '1',
    mute: muted ? '1' : '0',
  });

  if (typeof start === 'number' && start >= 0) {
    params.set('start', String(Math.floor(start)));
  }

  if (typeof end === 'number' && end > 0) {
    params.set('end', String(Math.floor(end)));
  }

  if (loop) {
    params.set('loop', '1');
    params.set('playlist', videoId);
  } else {
    params.set('loop', '0');
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

const PlayerQuizPlay = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [stage, setStage] = useState('identification');
  const [responses, setResponses] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionError, setQuestionError] = useState('');
  const [identificationError, setIdentificationError] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [checkingParticipation, setCheckingParticipation] = useState(false);

  const backgroundVideoUrl = quiz?.backgroundVideoUrl ?? null;
  const videoEmbedUrl = backgroundVideoUrl
    ? buildYouTubeBackgroundUrl(backgroundVideoUrl, {
        start: quiz?.backgroundVideoStart ?? 0,
        end: quiz?.backgroundVideoEnd ?? null,
        loop: quiz?.backgroundVideoLoop ?? true,
        muted: quiz?.backgroundVideoMuted ?? true,
      })
    : null;

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get(`/quizzes/${quizId}`);
        const quizData = response.data;
        const initialResponses = {};
        quizData.questions.forEach((question) => {
          initialResponses[question.id] = {
            selectedOptionId: null,
            isConfirmed: false,
            isCorrect: null,
          };
        });
        setQuiz(quizData);
        setResponses(initialResponses);
        setStage('identification');
        setCurrentQuestionIndex(0);
        setQuestionError('');
        setIdentificationError('');
        setSubmissionError('');
        setResult(null);
        setQuizCompleted(false);
        setUserName('');
        setUserEmail('');
      } catch (err) {
        setError(err.response?.data?.message || 'Não foi possível carregar o quiz.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  useEffect(() => {
    setQuestionError('');
  }, [currentQuestionIndex]);

  useEffect(() => {
    const shouldUseImage = Boolean(quiz?.backgroundImageUrl) && !backgroundVideoUrl;

    if (shouldUseImage) {
      setBackgroundLoaded(false);
      const image = new Image();
      image.src = quiz.backgroundImageUrl;
      image.onload = () => setBackgroundLoaded(true);
      image.onerror = () => setBackgroundLoaded(false);
      return () => {
        image.onload = null;
        image.onerror = null;
      };
    }

    setBackgroundLoaded(true);
    return undefined;
  }, [quiz?.backgroundImageUrl, backgroundVideoUrl]);

  useEffect(() => {
    if (videoEmbedUrl) {
      setVideoReady(false);
    } else {
      setVideoReady(true);
    }
  }, [videoEmbedUrl]);

  const currentQuestion = quiz?.questions?.[currentQuestionIndex] ?? null;
  const currentResponse = currentQuestion ? responses[currentQuestion.id] : null;
  const isLastQuestion = quiz ? currentQuestionIndex === quiz.questions.length - 1 : false;
  const answerStatus = currentResponse?.isConfirmed ? (currentResponse.isCorrect ? 'correct' : 'incorrect') : null;

  const canNavigateTo = (index) => {
    if (!quiz) {
      return false;
    }

    if (quizCompleted) {
      return true;
    }

    if (index <= currentQuestionIndex) {
      return true;
    }

    const allPreviousConfirmed = quiz.questions
      .slice(0, index)
      .every((question) => responses[question.id]?.isConfirmed);

    return allPreviousConfirmed;
  };

  const handleGoToQuestion = (index) => {
    if (!quiz || index === currentQuestionIndex) {
      return;
    }

    if (canNavigateTo(index)) {
      setCurrentQuestionIndex(index);
    }
  };

  const handleOptionSelect = (questionId, optionId) => {
    if (quizCompleted) {
      return;
    }

    setResponses((prev) => {
      const current = prev[questionId] ?? { selectedOptionId: null, isConfirmed: false, isCorrect: null };
      if (current.isConfirmed) {
        return prev;
      }

      return {
        ...prev,
        [questionId]: {
          ...current,
          selectedOptionId: optionId,
        },
      };
    });
    setQuestionError('');
  };

  const handleStartQuiz = async (event) => {
    event.preventDefault();
    if (!quiz) {
      return;
    }

    setIdentificationError('');
    const trimmedName = userName.trim();
    const trimmedEmail = userEmail.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setIdentificationError('Informe seu nome com pelo menos 2 caracteres.');
      return;
    }

    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setIdentificationError('Informe um e-mail válido.');
      return;
    }

    try {
      setCheckingParticipation(true);
      await api.post(`/quizzes/${quizId}/validate-participation`, {
        userName: trimmedName,
        userEmail: trimmedEmail,
      });
    } catch (err) {
      setIdentificationError(err.response?.data?.message || 'Você já participou deste quiz.');
      return;
    } finally {
      setCheckingParticipation(false);
    }

    setUserName(trimmedName);
    setUserEmail(trimmedEmail);
    setStage('quiz');
    setCurrentQuestionIndex(0);
    setQuestionError('');
    setSubmissionError('');
    setResult(null);
    setQuizCompleted(false);
  };

  const handleConfirmAnswer = async () => {
    if (!quiz || !currentQuestion || quizCompleted || currentResponse?.isConfirmed) {
      return;
    }

    const selectedOptionId = currentResponse?.selectedOptionId;
    if (!selectedOptionId) {
      setQuestionError('Selecione uma alternativa para continuar.');
      return;
    }

    try {
      setValidating(true);
      const response = await api.post(`/quizzes/${quizId}/questions/${currentQuestion.id}/validate`, {
        optionId: selectedOptionId,
      });
      setResponses((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          ...prev[currentQuestion.id],
          isConfirmed: true,
          isCorrect: Boolean(response.data?.isCorrect),
        },
      }));
      setQuestionError('');
    } catch (err) {
      setQuestionError(err.response?.data?.message || 'Não foi possível validar sua resposta.');
    } finally {
      setValidating(false);
    }
  };

  const handleNextQuestion = () => {
    if (!quiz || quizCompleted) {
      return;
    }

    if (currentQuestionIndex < quiz.questions.length - 1 && currentResponse?.isConfirmed) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (!quiz || currentQuestionIndex === 0) {
      return;
    }

    setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSubmitQuiz = async () => {
    if (!quiz || quizCompleted) {
      return;
    }

    const unanswered = quiz.questions.filter((question) => !responses[question.id]?.isConfirmed);
    if (unanswered.length > 0) {
      setSubmissionError('Responda todas as perguntas antes de enviar.');
      return;
    }

    setSubmissionError('');
    setResult(null);

    const payload = {
      userName,
      userEmail,
      answers: quiz.questions.map((question) => ({
        questionId: question.id,
        optionId: responses[question.id]?.selectedOptionId,
      })),
    };

    try {
      setSubmitting(true);
      const response = await api.post(`/quizzes/${quizId}/submissions`, payload);
      setResult(response.data);
      setQuizCompleted(true);
    } catch (err) {
      setSubmissionError(err.response?.data?.message || 'Não foi possível registrar suas respostas.');
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

  const hasBackgroundImage = Boolean(quiz.backgroundImageUrl);
  const hasBackgroundVideo = Boolean(videoEmbedUrl);
  const showBackgroundImage = hasBackgroundImage && !hasBackgroundVideo;
  const hasBackground = hasBackgroundVideo || showBackgroundImage;

  const confirmDisabled =
    !currentResponse?.selectedOptionId || currentResponse?.isConfirmed || validating || quizCompleted;
  const nextDisabled = !currentResponse?.isConfirmed || quizCompleted;
  const submitDisabled = submitting || quizCompleted;
  const submitLabel = submitting ? 'Enviando...' : quizCompleted ? 'Quiz finalizado' : 'Enviar respostas';

  return (
    <div className={`quiz-play-wrapper ${hasBackground ? 'has-background' : ''}`}>
      {hasBackgroundVideo && videoEmbedUrl && (
        <div className={`quiz-video-layer ${videoReady ? 'loaded' : ''}`}>
          <iframe
            key={videoEmbedUrl}
            src={videoEmbedUrl}
            title="Plano de fundo do quiz"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            frameBorder="0"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => setVideoReady(true)}
          />
        </div>
      )}
      {showBackgroundImage && (
        <div
          className={`quiz-background-layer ${backgroundLoaded ? 'loaded' : ''}`}
          style={{ backgroundImage: `url(${quiz.backgroundImageUrl})` }}
        />
      )}
      <div className="quiz-content-wrapper">
        <div className="grid quiz-content">
          <div className={`page-title ${hasBackground ? 'with-background' : ''}`}>
            {/*<div className={hasBackground ? 'page-title-card' : ''}>
               Imagem do header removida propositalmente para priorizar o formulário */}
              {/* {quiz.headerImageUrl && (
                <img
                  src={quiz.headerImageUrl}
                  alt={`Imagem do quiz ${quiz.title}`}
                  className="quiz-header-image"
                />
              )} 
              <h1>{quiz.title}</h1>
               Descrição do quiz ocultada durante o play para manter o layout limpo */}
              {/* <p className="page-description">{quiz.description}</p> 
            </div>
            <button
              className="button ghost"
              type="button"
              onClick={() => navigate(`/play/quiz/${quizId}/ranking`)}
            >
              Ranking
            </button>*/}
          </div>

          {stage === 'identification' && (
            <form className="card wizard-identification" onSubmit={handleStartQuiz}>
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
                />
              </div><br/>
              <div className="form-field">
                <label htmlFor="user-email">E-mail</label>
                <input
                  id="user-email"
                  type="email"
                  placeholder="seuemail@exemplo.com"
                  value={userEmail}
                  onChange={(event) => setUserEmail(event.target.value)}
                />
              </div>
              {identificationError && <div className="page-error" style={{ margin: 0 }}>{identificationError}</div>}
              <div className="form-actions">
                <button className="button" type="submit" disabled={checkingParticipation}>
                  {checkingParticipation ? 'Verificando...' : 'Iniciar quiz'}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => navigate(`/play/quiz/${quizId}/ranking`)}
                >
                  Ver ranking completo
                </button>
                <button className="button ghost" type="button" onClick={() => navigate('/play')}>
                  Voltar
                </button>
              </div>
            </form>
          )}

          {stage !== 'identification' && currentQuestion && (
            <>
              <div className="card wizard-progress-card">
                <h2 style={{ marginBottom: '1rem' }}>Progresso</h2>
                <div className="wizard-progress">
                  {quiz.questions.map((question, index) => {
                    const response = responses[question.id];
                    const statusClass = response?.isConfirmed
                      ? response.isCorrect
                        ? 'success'
                        : 'error'
                      : 'pending';
                    const isActive = index === currentQuestionIndex;
                    return (
                      <button
                        key={question.id}
                        type="button"
                        className={`wizard-step ${statusClass} ${isActive ? 'active' : ''}`}
                        onClick={() => handleGoToQuestion(index)}
                        disabled={!canNavigateTo(index)}
                        aria-label={`Pergunta ${index + 1}`}
                      >
                        <span className="wizard-step-label">
                          {response?.isConfirmed ? (
                            response.isCorrect ? (
                              <span aria-hidden="true" className="wizard-icon success">✓</span>
                            ) : (
                              <span aria-hidden="true" className="wizard-icon danger">✕</span>
                            )
                          ) : (
                            <span className="wizard-step-index">{index + 1}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <br/>
              <div className={`card wizard-question ${answerStatus ? `status-${answerStatus}` : ''}`}>
                <div className="wizard-question-header">
                  <span className="wizard-question-index">
                    Pergunta {currentQuestionIndex + 1} de {quiz.questions.length}
                  </span>
                  {currentResponse?.isConfirmed && (
                    <span className={`tag ${currentResponse.isCorrect ? 'success' : 'danger'}`}>
                      {currentResponse.isCorrect ? 'Resposta correta' : 'Resposta incorreta'}
                    </span>
                  )}
                </div>
                <h3>{currentQuestion.text}</h3>
                <div className="options-list">
                  {currentQuestion.options.map((option) => (
                    <label
                      key={option.id}
                      className={`option-item ${currentResponse?.selectedOptionId === option.id ? 'selected' : ''}`}
                      htmlFor={`question-${currentQuestion.id}-option-${option.id}`}
                    >
                      <input
                        id={`question-${currentQuestion.id}-option-${option.id}`}
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        checked={currentResponse?.selectedOptionId === option.id}
                        onChange={() => handleOptionSelect(currentQuestion.id, option.id)}
                        disabled={currentResponse?.isConfirmed || quizCompleted}
                      />
                      <span>{option.text}</span>
                    </label>
                  ))}
                </div>
                {answerStatus === 'correct' && (
                  <div className="answer-feedback success">Boa! Você acertou esta pergunta.</div>
                )}
                {answerStatus === 'incorrect' && (
                  <div className="answer-feedback danger">Resposta incorreta. Continue tentando nas próximas!</div>
                )}
                {questionError && <div className="card page-error" style={{ marginTop: '2rem' }}>{questionError}</div>}
                <div className="wizard-actions">
                  <button
                    className="button ghost"
                    type="button"
                    onClick={handlePreviousQuestion}
                    disabled={currentQuestionIndex === 0 || validating}
                  >
                    Pergunta anterior
                  </button>
                  {!currentResponse?.isConfirmed && (
                    <button className="button" type="button" onClick={handleConfirmAnswer} disabled={confirmDisabled}>
                      {validating ? 'Verificando...' : 'Confirmar resposta'}
                    </button>
                  )}
                  {currentResponse?.isConfirmed && !isLastQuestion && (
                    <button className="button" type="button" onClick={handleNextQuestion} disabled={nextDisabled}>
                      Próxima pergunta
                    </button>
                  )}
                  {currentResponse?.isConfirmed && isLastQuestion && (
                    <button className="button" type="button" onClick={handleSubmitQuiz} disabled={submitDisabled}>
                      {submitLabel}
                    </button>
                  )}
                </div>
              </div>

              {submissionError && <div className="page-error"><span style={{ fontSize: '12px' }} className="tag danger">{submissionError}</span></div>}
            </>
          )}
          <br/>
          {quizCompleted && !result && (
            <div className="card">
              <h2>Resultado</h2>
              <p>Quase lá! Aguarde alguns instantes e tente novamente caso o resultado não seja exibido.</p>
            </div>
          )}

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
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  Voltar ao topo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerQuizPlay;
