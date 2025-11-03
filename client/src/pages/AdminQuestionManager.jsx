import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api.js';

const createEmptyForm = (order) => ({
  text: '',
  order,
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
  ],
});

const AdminQuestionManager = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [questionFeedback, setQuestionFeedback] = useState('');
  const [form, setForm] = useState(createEmptyForm(1));
  const [deletingQuestionId, setDeletingQuestionId] = useState(null);
  const [clearingRanking, setClearingRanking] = useState(false);
  const [quizDetails, setQuizDetails] = useState({
    title: '',
    description: '',
    mode: 'SEQUENTIAL',
    questionUsage: 'ALL',
    questionLimit: '',
    backgroundVideoUrl: '',
    backgroundVideoStart: '0',
    backgroundVideoEnd: '',
    backgroundVideoLoop: true,
    backgroundVideoMuted: true,
    backgroundIntensity: '0.65',
  });
  const [updatingQuiz, setUpdatingQuiz] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [quizFeedback, setQuizFeedback] = useState('');
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [headerFile, setHeaderFile] = useState(null);
  const [backgroundPreview, setBackgroundPreview] = useState('');
  const [headerPreview, setHeaderPreview] = useState('');
  const backgroundObjectUrlRef = useRef(null);
  const headerObjectUrlRef = useRef(null);
  const backgroundInputRef = useRef(null);
  const headerInputRef = useRef(null);

  const setBackgroundPreviewFromServer = (url) => {
    if (backgroundObjectUrlRef.current) {
      URL.revokeObjectURL(backgroundObjectUrlRef.current);
      backgroundObjectUrlRef.current = null;
    }
    setBackgroundPreview(url || '');
  };

  const setHeaderPreviewFromServer = (url) => {
    if (headerObjectUrlRef.current) {
      URL.revokeObjectURL(headerObjectUrlRef.current);
      headerObjectUrlRef.current = null;
    }
    setHeaderPreview(url || '');
  };

  const setBackgroundPreviewFromFile = (file) => {
    if (backgroundObjectUrlRef.current) {
      URL.revokeObjectURL(backgroundObjectUrlRef.current);
      backgroundObjectUrlRef.current = null;
    }

    if (!file) {
      setBackgroundPreview('');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    backgroundObjectUrlRef.current = objectUrl;
    setBackgroundPreview(objectUrl);
  };

  const setHeaderPreviewFromFile = (file) => {
    if (headerObjectUrlRef.current) {
      URL.revokeObjectURL(headerObjectUrlRef.current);
      headerObjectUrlRef.current = null;
    }

    if (!file) {
      setHeaderPreview('');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    headerObjectUrlRef.current = objectUrl;
    setHeaderPreview(objectUrl);
  };

  useEffect(
    () => () => {
      if (backgroundObjectUrlRef.current) {
        URL.revokeObjectURL(backgroundObjectUrlRef.current);
      }
      if (headerObjectUrlRef.current) {
        URL.revokeObjectURL(headerObjectUrlRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/admin/quizzes/${quizId}`);
        setQuiz(response.data);
        const nextOrder =
          response.data?.questions?.length > 0
            ? Math.max(...response.data.questions.map((question) => question.order)) + 1
            : 1;
        setForm(createEmptyForm(nextOrder));
      } catch (err) {
        setError(err.response?.data?.message || 'Não foi possível carregar o quiz.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  useEffect(() => {
    if (quiz) {
      const hasLimit = quiz.questionLimit !== null && quiz.questionLimit !== undefined;
      const hasVideo = Boolean(quiz.backgroundVideoUrl);
      setQuizDetails({
        title: quiz.title ?? '',
        description: quiz.description ?? '',
        mode: quiz.mode ?? 'SEQUENTIAL',
        questionUsage: hasLimit ? 'LIMITED' : 'ALL',
        questionLimit: hasLimit ? String(quiz.questionLimit) : '',
        backgroundVideoUrl: quiz.backgroundVideoUrl ?? '',
        backgroundVideoStart: hasVideo
          ? String(quiz.backgroundVideoStart ?? 0)
          : '',
        backgroundVideoEnd:
          hasVideo && quiz.backgroundVideoEnd !== null && quiz.backgroundVideoEnd !== undefined
            ? String(quiz.backgroundVideoEnd)
            : '',
        backgroundVideoLoop: quiz.backgroundVideoLoop ?? true,
        backgroundVideoMuted: quiz.backgroundVideoMuted ?? true,
        backgroundIntensity: quiz.backgroundImageIntensity !== null && quiz.backgroundImageIntensity !== undefined
          ? String(Number(quiz.backgroundImageIntensity).toFixed(2))
          : '0.65',
      });
      setBackgroundFile(null);
      setHeaderFile(null);
      setBackgroundPreviewFromServer(quiz.backgroundImageUrl ?? '');
      setHeaderPreviewFromServer(quiz.headerImageUrl ?? '');
      if (backgroundInputRef.current) {
        backgroundInputRef.current.value = '';
      }
      if (headerInputRef.current) {
        headerInputRef.current.value = '';
      }
    }
  }, [quiz]);

  const nextOrder = useMemo(() => {
    if (!quiz?.questions?.length) {
      return 1;
    }
    return Math.max(...quiz.questions.map((question) => question.order)) + 1;
  }, [quiz]);

  const handleQuizDetailChange = (field) => (event) => {
    const { value } = event.target;
    setQuizDetails((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleQuizDetailCheckboxChange = (field) => (event) => {
    const { checked } = event.target;
    setQuizDetails((prev) => ({
      ...prev,
      [field]: checked,
    }));
  };

  const handleQuizModeChange = (event) => {
    const { value } = event.target;
    setQuizDetails((prev) => ({
      ...prev,
      mode: value,
    }));
  };

  const handleQuestionUsageChange = (event) => {
    const { value } = event.target;
    setQuizDetails((prev) => ({
      ...prev,
      questionUsage: value,
      questionLimit: value === 'ALL' ? '' : prev.questionLimit,
    }));
  };

  const handleQuestionLimitChange = (event) => {
    const { value } = event.target;
    setQuizDetails((prev) => ({
      ...prev,
      questionLimit: value,
    }));
  };

  const handleBackgroundIntensityChange = (event) => {
    setQuizDetails((prev) => ({
      ...prev,
      backgroundIntensity: event.target.value,
    }));
  };

  const maxUploadSizeMbEnv = Number(import.meta.env.VITE_MAX_UPLOAD_SIZE_MB ?? '10');
  const effectiveUploadSizeMb = Number.isFinite(maxUploadSizeMbEnv) && maxUploadSizeMbEnv > 0 ? maxUploadSizeMbEnv : 10;
  const maxUploadSizeLabelValue = Number.isInteger(effectiveUploadSizeMb)
    ? String(effectiveUploadSizeMb)
    : effectiveUploadSizeMb.toFixed(1);
  const MAX_IMAGE_SIZE = effectiveUploadSizeMb * 1024 * 1024;
  const maxImageSizeLabel = `${maxUploadSizeLabelValue}MB`;
  const backgroundIntensityNumber = (() => {
    const parsed = Number(quizDetails.backgroundIntensity);
    if (!Number.isFinite(parsed)) {
      return 0.65;
    }
    return Math.min(Math.max(parsed, 0.1), 1);
  })();
  const backgroundIntensityDisplay = backgroundIntensityNumber.toFixed(2);

  const validateImageFile = (file) => {
    if (!file) {
      return null;
    }
    if (file.type !== 'image/png') {
      return 'Apenas imagens PNG são permitidas.';
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return `Imagem excede o limite de ${maxImageSizeLabel}.`;
    }
    return null;
  };

  const handleBackgroundImageChange = (event) => {
    setQuizError('');
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setBackgroundFile(null);
      setBackgroundPreviewFromServer(quiz?.backgroundImageUrl ?? '');
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      setQuizError(validationError);
      if (backgroundInputRef.current) {
        backgroundInputRef.current.value = '';
      }
      return;
    }

    setBackgroundFile(file);
    setBackgroundPreviewFromFile(file);
  };

  const handleHeaderImageChange = (event) => {
    setQuizError('');
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setHeaderFile(null);
      setHeaderPreviewFromServer(quiz?.headerImageUrl ?? '');
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      setQuizError(validationError);
      if (headerInputRef.current) {
        headerInputRef.current.value = '';
      }
      return;
    }

    setHeaderFile(file);
    setHeaderPreviewFromFile(file);
  };

  const handleOptionChange = (index, value) => {
    setForm((prev) => {
      const updated = [...prev.options];
      updated[index] = { ...updated[index], text: value };
      return { ...prev, options: updated };
    });
  };

  const handleMarkCorrect = (index) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((option, optionIndex) => ({
        ...option,
        isCorrect: optionIndex === index,
      })),
    }));
  };

  const handleAddOption = () => {
    setForm((prev) => ({
      ...prev,
      options: [...prev.options, { text: '', isCorrect: false }],
    }));
  };

  const handleRemoveOption = (index) => {
    setForm((prev) => {
      if (prev.options.length <= 2) {
        return prev;
      }
      const updated = prev.options.filter((_, optionIndex) => optionIndex !== index);
      if (!updated.some((option) => option.isCorrect)) {
        updated[0] = { ...updated[0], isCorrect: true };
      }
      return { ...prev, options: updated };
    });
  };

  const resetForm = () => {
    setForm(createEmptyForm(nextOrder));
  };

  const handleUpdateQuiz = async (event) => {
    event.preventDefault();
    setQuizError('');
    setQuizFeedback('');
    setQuestionFeedback('');

    const trimmedTitle = quizDetails.title.trim();
    const trimmedDescription = quizDetails.description.trim();
    const wantsLimitedQuestions = quizDetails.questionUsage === 'LIMITED';
    const trimmedLimit = quizDetails.questionLimit.trim();
    let normalizedLimit = null;

    if (trimmedTitle.length < 3) {
      setQuizError('Informe um título com ao menos 3 caracteres.');
      return;
    }

    if (trimmedDescription.length < 5) {
      setQuizError('Informe uma descrição com ao menos 5 caracteres.');
      return;
    }

    if (wantsLimitedQuestions) {
      const parsedLimit = Number(trimmedLimit);
      if (trimmedLimit.length === 0 || !Number.isInteger(parsedLimit) || parsedLimit < 1) {
        setQuizError('Informe uma quantidade máxima de perguntas válida (a partir de 1).');
        return;
      }
      normalizedLimit = parsedLimit;
    }

    const currentMode = quiz?.mode ?? 'SEQUENTIAL';
    const currentLimit = quiz?.questionLimit ?? null;
    const videoUrl = quizDetails.backgroundVideoUrl.trim();
    const rawStart = quizDetails.backgroundVideoStart.trim();
    const rawEnd = quizDetails.backgroundVideoEnd.trim();

    let videoStartValue = null;
    if (rawStart !== '') {
      const parsedStart = Number(rawStart);
      if (!Number.isFinite(parsedStart) || parsedStart < 0) {
        setQuizError('Informe um tempo inicial válido (maior ou igual a 0).');
        return;
      }
      videoStartValue = parsedStart;
    }

    let videoEndValue = null;
    if (rawEnd !== '') {
      const parsedEnd = Number(rawEnd);
      if (!Number.isFinite(parsedEnd) || parsedEnd < 0) {
        setQuizError('Informe um tempo final válido (maior ou igual a 0).');
        return;
      }
      videoEndValue = parsedEnd;
    }

    const hasVideo = videoUrl.length > 0;

    if (hasVideo) {
      if (videoStartValue === null) {
        videoStartValue = 0;
      }
      if (videoEndValue !== null && videoEndValue <= videoStartValue) {
        setQuizError('Tempo final do vídeo deve ser maior que o tempo inicial.');
        return;
      }
    } else {
      videoStartValue = null;
      videoEndValue = null;
    }

    const existingVideoUrl = quiz?.backgroundVideoUrl ?? null;
    const existingVideoStart = existingVideoUrl ? (quiz?.backgroundVideoStart ?? 0) : null;
    const existingVideoEnd = existingVideoUrl ? (quiz?.backgroundVideoEnd ?? null) : null;
    const existingVideoLoop = quiz?.backgroundVideoLoop ?? true;
    const existingVideoMuted = quiz?.backgroundVideoMuted ?? true;
    const existingIntensity = quiz?.backgroundImageIntensity ?? 0.65;
    const parsedIntensity = Number(quizDetails.backgroundIntensity);
    const normalizedIntensityRaw = Number.isFinite(parsedIntensity) ? parsedIntensity : existingIntensity;
    const normalizedIntensity = Math.min(Math.max(normalizedIntensityRaw, 0.1), 1);

    const normalizedVideoUrl = hasVideo ? videoUrl : null;
    const normalizedVideoStart = hasVideo ? (videoStartValue ?? 0) : null;
    const normalizedVideoEnd = hasVideo ? (videoEndValue ?? null) : null;

    const videoUrlChanged = normalizedVideoUrl !== existingVideoUrl;
    const videoStartChanged = normalizedVideoStart !== existingVideoStart;
    const videoEndChanged = normalizedVideoEnd !== existingVideoEnd;
    const videoLoopChanged =
      Boolean(existingVideoUrl || normalizedVideoUrl) &&
      quizDetails.backgroundVideoLoop !== existingVideoLoop;
    const videoMutedChanged =
      Boolean(existingVideoUrl || normalizedVideoUrl) &&
      quizDetails.backgroundVideoMuted !== existingVideoMuted;
    const intensityChanged = Math.abs(normalizedIntensity - existingIntensity) > 0.0001;

    const hasChanges =
      trimmedTitle !== (quiz?.title ?? '') ||
      trimmedDescription !== (quiz?.description ?? '') ||
      quizDetails.mode !== currentMode ||
      normalizedLimit !== currentLimit ||
      videoUrlChanged ||
      videoStartChanged ||
      videoEndChanged ||
      videoLoopChanged ||
      videoMutedChanged ||
      intensityChanged;

    const hasImageChanges = Boolean(backgroundFile || headerFile);

    if (!hasChanges && !hasImageChanges) {
      setQuizFeedback('Nenhuma alteração detectada.');
      return;
    }

    try {
      setUpdatingQuiz(true);
      const payload = {};

      if (trimmedTitle !== (quiz?.title ?? '')) {
        payload.title = trimmedTitle;
      }
      if (trimmedDescription !== (quiz?.description ?? '')) {
        payload.description = trimmedDescription;
      }
      if (quizDetails.mode !== currentMode) {
        payload.mode = quizDetails.mode;
      }
      if (normalizedLimit !== currentLimit) {
        payload.questionLimit = normalizedLimit;
      }
      if (videoUrlChanged) {
        payload.backgroundVideoUrl = normalizedVideoUrl;
      }
      if (videoUrlChanged || videoStartChanged) {
        payload.backgroundVideoStart = normalizedVideoStart;
      }
      if (videoUrlChanged || videoEndChanged) {
        payload.backgroundVideoEnd = normalizedVideoEnd;
      }
      if (videoUrlChanged || videoLoopChanged) {
        payload.backgroundVideoLoop = quizDetails.backgroundVideoLoop;
      }
      if (videoUrlChanged || videoMutedChanged) {
        payload.backgroundVideoMuted = quizDetails.backgroundVideoMuted;
      }
      if (intensityChanged) {
        payload.backgroundImageIntensity = normalizedIntensity;
        payload.backgroundVideoIntensity = normalizedIntensity;
      }

      let latestQuizData = quiz;

      if (hasChanges) {
        const response = await api.patch(`/admin/quizzes/${quizId}`, payload);
        latestQuizData = response.data;
        setQuiz(response.data);
        setQuizFeedback('Quiz atualizado com sucesso!');
      }

      if (hasImageChanges) {
        const formData = new FormData();
        if (backgroundFile) {
          formData.append('backgroundImage', backgroundFile);
        }
        if (headerFile) {
          formData.append('headerImage', headerFile);
        }

        const response = await api.patch(`/admin/quizzes/${quizId}/media`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        latestQuizData = response.data;
        setQuiz(response.data);
        setQuizFeedback(hasChanges ? 'Quiz atualizado com sucesso!' : 'Imagens atualizadas com sucesso!');
      }

      if (latestQuizData) {
        setBackgroundPreviewFromServer(latestQuizData.backgroundImageUrl ?? '');
        setHeaderPreviewFromServer(latestQuizData.headerImageUrl ?? '');
        setBackgroundFile(null);
        setHeaderFile(null);
        if (backgroundInputRef.current) {
          backgroundInputRef.current.value = '';
        }
        if (headerInputRef.current) {
          headerInputRef.current.value = '';
        }
      }
    } catch (err) {
      setQuizError(err.response?.data?.message || 'Não foi possível atualizar o quiz.');
    } finally {
      setUpdatingQuiz(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setQuestionFeedback('');
    setQuizFeedback('');
    setQuizError('');

    const trimmedOptions = form.options.map((option) => ({
      ...option,
      text: option.text.trim(),
    }));

    if (form.text.trim().length < 3) {
      setFormError('Informe um enunciado com ao menos 3 caracteres.');
      return;
    }

    if (trimmedOptions.filter((option) => option.text.length > 0).length < 2) {
      setFormError('Informe pelo menos duas alternativas preenchidas.');
      return;
    }

    if (!trimmedOptions.some((option) => option.isCorrect)) {
      setFormError('Marque uma alternativa correta.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        text: form.text.trim(),
        order: form.order || nextOrder,
        options: trimmedOptions.filter((option) => option.text.length > 0),
      };

      const response = await api.post(`/admin/quizzes/${quizId}/questions`, payload);
      setQuiz((prev) => ({
        ...prev,
        questions: [...(prev.questions || []), response.data].sort((a, b) => a.order - b.order),
      }));
      setQuestionFeedback('Pergunta adicionada com sucesso!');
      resetForm();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Não foi possível cadastrar a pergunta.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    setFormError('');
    setQuestionFeedback('');
    setQuizFeedback('');
    setQuizError('');

    const confirmed = window.confirm('Tem certeza de que deseja excluir esta pergunta? Esta ação é irreversível.');
    if (!confirmed) {
      return;
    }

    try {
      setDeletingQuestionId(questionId);
      await api.delete(`/admin/quizzes/${quizId}/questions/${questionId}`);
      setQuiz((prev) => {
        const updatedQuestions = (prev.questions || [])
          .filter((question) => question.id !== questionId)
          .sort((a, b) => a.order - b.order)
          .map((question, index) => ({
            ...question,
            order: index + 1,
          }));

        return {
          ...prev,
          questions: updatedQuestions,
        };
      });
      setQuestionFeedback('Pergunta removida com sucesso.');
    } catch (err) {
      setFormError(err.response?.data?.message || 'Não foi possível remover a pergunta.');
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const handleClearRanking = async () => {
    setFormError('');
    setQuestionFeedback('');
    setQuizError('');
    setQuizFeedback('');

    const confirmed = window.confirm('Tem certeza de que deseja limpar todo o ranking deste quiz? Esta ação remove definitivamente todas as submissões.');
    if (!confirmed) {
      return;
    }

    try {
      setClearingRanking(true);
      const response = await api.delete(`/admin/quizzes/${quizId}/ranking`);
      setQuizFeedback(response.data?.message || 'Ranking limpo com sucesso.');
    } catch (err) {
      setQuizError(err.response?.data?.message || 'Não foi possível limpar o ranking.');
    } finally {
      setClearingRanking(false);
    }
  };

  if (loading) {
    return <div className="page-loading">Carregando quiz...</div>;
  }

  if (error) {
    return <div className="page-error">{error}</div>;
  }

  if (!quiz) {
    return <div className="page-error">Quiz não encontrado.</div>;
  }

  const videoSettingsDisabled = quizDetails.backgroundVideoUrl.trim().length === 0;

  return (
    <div className="grid">
      <div className="page-title">
        <div>
          <h1>{quiz.title}</h1>
          <p className="page-description">{quiz.description}</p>
        </div>
      <div className="actions">
        <button className="button ghost" type="button" onClick={() => navigate('/admin/dashboard')}>
          Dashboard
        </button>
        <button
            className="button danger"
            type="button"
            onClick={handleClearRanking}
            disabled={clearingRanking}
          >
            {clearingRanking ? 'Limpando...' : 'Limpar ranking'}
          </button>
          <button className="button" type="button" onClick={() => navigate('/admin/quizzes')}>
            Voltar à lista
          </button>
        </div>
      </div>

      <form className="card form-grid" onSubmit={handleUpdateQuiz}>
        <h2>Editar quiz</h2>
        <div className="form-field">
          <label htmlFor="quiz-title">Título</label>
          <input
            id="quiz-title"
            type="text"
            value={quizDetails.title}
            onChange={handleQuizDetailChange('title')}
            placeholder="Título do quiz"
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="quiz-description">Descrição</label>
          <textarea
            id="quiz-description"
            value={quizDetails.description}
            onChange={handleQuizDetailChange('description')}
            placeholder="Descrição do quiz"
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="quiz-mode">Modo das perguntas</label>
          <select id="quiz-mode" value={quizDetails.mode} onChange={handleQuizModeChange}>
            <option value="SEQUENTIAL">Sequencial (ordem fixa)</option>
            <option value="RANDOM">Aleatório (ordem aleatória)</option>
          </select>
          <small style={{ color: '#64748b' }}>
            No modo aleatório, a ordem das perguntas pode variar a cada participação.
          </small>
        </div>
        <div className="form-field">
          <label htmlFor="quiz-question-usage">Perguntas utilizadas no quiz</label>
          <select
            id="quiz-question-usage"
            value={quizDetails.questionUsage}
            onChange={handleQuestionUsageChange}
          >
            <option value="ALL">Usar todas as perguntas cadastradas</option>
            <option value="LIMITED">Definir uma quantidade máxima</option>
          </select>
        </div>
        {quizDetails.questionUsage === 'LIMITED' && (
          <div className="form-field">
            <label htmlFor="quiz-question-limit">Quantidade máxima de perguntas</label>
            <input
              id="quiz-question-limit"
              type="number"
              min="1"
              value={quizDetails.questionLimit}
              onChange={handleQuestionLimitChange}
              placeholder="Ex.: 5"
            />
            <small style={{ color: '#64748b' }}>
              Quando houver menos perguntas cadastradas, o quiz usará todas as disponíveis.
            </small>
          </div>
        )}
        <div className="form-field">
          <label htmlFor="quiz-background-intensity">
            Intensidade do fundo ({backgroundIntensityDisplay})
          </label>
          <input
            id="quiz-background-intensity"
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            value={String(backgroundIntensityNumber)}
            onChange={handleBackgroundIntensityChange}
          />
          <small style={{ color: '#64748b' }}>
            Valores menores escurecem o fundo, maiores deixam a imagem mais nítida.
          </small>
        </div>
        <div className="form-field">
          <label htmlFor="quiz-background-video-url">Vídeo de fundo (YouTube)</label>
          <input
            id="quiz-background-video-url"
            type="url"
            value={quizDetails.backgroundVideoUrl}
            onChange={handleQuizDetailChange('backgroundVideoUrl')}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <small style={{ color: '#64748b' }}>
            Informe uma URL do YouTube para usar como plano de fundo animado. O vídeo será exibido sem controles.
          </small>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="form-field">
            <label htmlFor="quiz-background-video-start">Início do trecho (segundos)</label>
            <input
              id="quiz-background-video-start"
              type="number"
              min="0"
              value={quizDetails.backgroundVideoStart}
              onChange={handleQuizDetailChange('backgroundVideoStart')}
              placeholder="Ex.: 0"
              disabled={videoSettingsDisabled}
            />
          </div>
          <div className="form-field">
            <label htmlFor="quiz-background-video-end">Fim do trecho (segundos)</label>
            <input
              id="quiz-background-video-end"
              type="number"
              min="0"
              value={quizDetails.backgroundVideoEnd}
              onChange={handleQuizDetailChange('backgroundVideoEnd')}
              placeholder="Ex.: 30"
              disabled={videoSettingsDisabled}
            />
            <small style={{ color: '#64748b' }}>Deixe em branco para reproduzir até o final.</small>
          </div>
        </div>
        <div className="checkbox-field">
          <input
            id="quiz-background-video-loop"
            type="checkbox"
            checked={quizDetails.backgroundVideoLoop}
            onChange={handleQuizDetailCheckboxChange('backgroundVideoLoop')}
            disabled={videoSettingsDisabled}
          />
          <label htmlFor="quiz-background-video-loop">Repetir vídeo em loop</label>
        </div>
        <div className="checkbox-field">
          <input
            id="quiz-background-video-muted"
            type="checkbox"
            checked={quizDetails.backgroundVideoMuted}
            onChange={handleQuizDetailCheckboxChange('backgroundVideoMuted')}
            disabled={videoSettingsDisabled}
          />
          <label htmlFor="quiz-background-video-muted">Reproduzir vídeo sem áudio</label>
        </div>
        <div className="form-field">
          <label htmlFor="quiz-background-image">Imagem de fundo do quiz (PNG até {maxImageSizeLabel})</label>
          <div className="image-upload-panel">
            {backgroundPreview ? (
              <img
                src={backgroundPreview}
                alt="Pré-visualização do background do quiz"
                className="quiz-image-preview"
                style={{ filter: `brightness(${backgroundIntensityNumber})` }}
              />
            ) : (
              <div className="quiz-image-placeholder">Sem imagem de fundo</div>
            )}
            <div className="image-upload-actions">
              <input
                id="quiz-background-image"
                type="file"
                accept="image/png"
                onChange={handleBackgroundImageChange}
                ref={backgroundInputRef}
              />
              <small>Carregue um arquivo PNG para personalizar o fundo do quiz.</small>
            </div>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="quiz-header-image">Imagem de header do quiz (PNG até {maxImageSizeLabel})</label>
          <div className="image-upload-panel">
            {headerPreview ? (
              <img
                src={headerPreview}
                alt="Pré-visualização do header do quiz"
                className="quiz-image-preview"
              />
            ) : (
              <div className="quiz-image-placeholder">Sem imagem de header</div>
            )}
            <div className="image-upload-actions">
              <input
                id="quiz-header-image"
                type="file"
                accept="image/png"
                onChange={handleHeaderImageChange}
                ref={headerInputRef}
              />
              <small>Essa imagem será exibida junto ao título do quiz.</small>
            </div>
          </div>
        </div>
        {quizError && <div className="page-error" style={{ margin: 0 }}>{quizError}</div>}
        {quizFeedback && <div className="tag success">{quizFeedback}</div>}
        <div className="form-actions">
          <button className="button" type="submit" disabled={updatingQuiz}>
            {updatingQuiz ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <h2>Adicionar pergunta</h2>
        <div className="form-field">
          <label htmlFor="question-text">Enunciado</label>
          <textarea
            id="question-text"
            placeholder="Descreva a pergunta"
            value={form.text}
            onChange={(event) => setForm((prev) => ({ ...prev, text: event.target.value }))}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="question-order">Ordem de exibição</label>
          <input
            id="question-order"
            type="number"
            min={1}
            value={form.order}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, order: Number(event.target.value) || nextOrder }))
            }
          />
        </div>

        <div className="form-field">
          <label>Alternativas</label>
          <div className="options-list">
            {form.options.map((option, index) => (
              <div
                key={`option-${index}`}
                className={`option-item ${option.isCorrect ? 'correct' : ''}`}
              >
                <input
                  type="radio"
                  name="correct-option"
                  checked={option.isCorrect}
                  onChange={() => handleMarkCorrect(index)}
                  title="Marcar como correta"
                />
                <input
                  type="text"
                  placeholder={`Alternativa ${index + 1}`}
                  value={option.text}
                  onChange={(event) => handleOptionChange(index, event.target.value)}
                  style={{ flex: 1 }}
                  required
                />
                {form.options.length > 2 && (
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button className="button secondary" type="button" onClick={handleAddOption}>
            Adicionar alternativa
          </button>
          <button className="button" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Cadastrar pergunta'}
          </button>
        </div>

        {formError && <div className="page-error" style={{ margin: 0 }}>{formError}</div>}
        {questionFeedback && <div className="tag success">{questionFeedback}</div>}
      </form>

      <div className="card">
        <h2>Perguntas cadastradas</h2>
        {!quiz.questions?.length ? (
          <div className="empty-state">Nenhuma pergunta cadastrada até o momento.</div>
        ) : (
          quiz.questions
            .sort((a, b) => a.order - b.order)
            .map((question) => (
              <div key={question.id} className="question-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                  <div>
                    <strong>
                      {question.order}. {question.text}
                    </strong>
                    <div style={{ marginTop: '0.35rem', color: '#64748b', fontSize: '0.85rem' }}>
                      {question.options.length} alternativa(s)
                    </div>
                  </div>
                  <div className="table-actions">
                    <span className="tag info">
                      {question.options.filter((option) => option.isCorrect).length} resposta(s) correta(s)
                    </span>
                    <button
                      className="button danger"
                      type="button"
                      onClick={() => handleDeleteQuestion(question.id)}
                      disabled={deletingQuestionId === question.id}
                    >
                      {deletingQuestionId === question.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </div>
                <div className="options-list">
                  {question.options.map((option) => (
                    <div
                      key={option.id}
                      className={`option-item ${option.isCorrect ? 'correct' : ''}`}
                    >
                      <span>{option.text}</span>
                      {option.isCorrect && <span className="tag success">Correta</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default AdminQuestionManager;
