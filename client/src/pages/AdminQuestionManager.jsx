import { useEffect, useMemo, useState } from 'react';
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
  const [quizDetails, setQuizDetails] = useState({ title: '', description: '' });
  const [updatingQuiz, setUpdatingQuiz] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [quizFeedback, setQuizFeedback] = useState('');

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
      setQuizDetails({
        title: quiz.title ?? '',
        description: quiz.description ?? '',
      });
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

    if (trimmedTitle.length < 3) {
      setQuizError('Informe um título com ao menos 3 caracteres.');
      return;
    }

    if (trimmedDescription.length < 5) {
      setQuizError('Informe uma descrição com ao menos 5 caracteres.');
      return;
    }

    const hasChanges =
      trimmedTitle !== (quiz?.title ?? '') || trimmedDescription !== (quiz?.description ?? '');

    if (!hasChanges) {
      setQuizFeedback('Nenhuma alteração detectada.');
      return;
    }

    try {
      setUpdatingQuiz(true);
      const response = await api.patch(`/admin/quizzes/${quizId}`, {
        title: trimmedTitle,
        description: trimmedDescription,
      });
      setQuiz(response.data);
      setQuizFeedback('Quiz atualizado com sucesso!');
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
