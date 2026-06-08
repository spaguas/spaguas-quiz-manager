import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../services/api.js';

const toISO = (value) => {
  if (!value) {
    return '1970-01-01T00:00:00.000Z';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return new Date(value).toISOString();
  } catch (error) {
    return '1970-01-01T00:00:00.000Z';
  }
};

const normalizePrize = (prize) => ({
  id: prize?.id ?? `${prize?.position ?? 'pos'}-${prize?.name ?? 'premio'}`,
  position: Number(prize?.position ?? 0),
  name: prize?.name ?? 'Prêmio',
  description: prize?.description ?? null,
  quantity: Number(prize?.quantity ?? 0),
  availableQuantity: Number(prize?.availableQuantity ?? 0),
  isAvailable: Boolean(prize?.isAvailable ?? Number(prize?.availableQuantity ?? 0) > 0),
  claimStatus: prize?.claimStatus ?? null,
  claimedAt: prize?.claimedAt ?? null,
  declinedAt: prize?.declinedAt ?? null,
});

const normalizeItem = (item) => {
  const createdAt = toISO(item?.createdAt);
  return {
    submissionId: item?.submissionId ?? item?.id ?? `${createdAt}`,
    userName: item?.userName ?? 'Participante',
    userEmail: item?.userEmail ?? null,
    score: Number(item?.score ?? 0),
    total: Number(item?.total ?? 0),
    percentage: Number(item?.percentage ?? 0),
    durationSeconds: Number.isFinite(Number(item?.durationSeconds)) ? Number(item.durationSeconds) : null,
    createdAt,
    position: typeof item?.position === 'number' ? item.position : null,
    dailyPosition: typeof item?.dailyPosition === 'number' ? item.dailyPosition : null,
    prizes: Array.isArray(item?.prizes) ? item.prizes.map(normalizePrize) : [],
  };
};

const sortByScoreThenDuration = (a, b) => {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  const aDuration = Number.isFinite(a.durationSeconds) ? a.durationSeconds : Number.MAX_SAFE_INTEGER;
  const bDuration = Number.isFinite(b.durationSeconds) ? b.durationSeconds : Number.MAX_SAFE_INTEGER;

  if (aDuration !== bDuration) {
    return aDuration - bDuration;
  }

  return new Date(a.createdAt) - new Date(b.createdAt);
};

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) {
    return '-';
  }

  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const formatDateTime = (value) => {
  if (!value) {
    return '';
  }
  return dayjs(value).format('DD/MM/YYYY HH:mm');
};

const buildFullRankingFromRaw = (rawItems) => {
  const normalized = rawItems.map((item) => normalizeItem(item));
  normalized.sort(sortByScoreThenDuration);
  normalized.forEach((entry, index) => {
    if (entry.position === null) {
      entry.position = index + 1;
    }
  });
  return normalized;
};

const buildRecentRanking = (fullRanking, size = 10) => fullRanking.slice(0, size);

const buildRankingByDay = (fullRanking) => {
  const groups = new Map();

  fullRanking.forEach((item) => {
    const dateKey = item.createdAt.slice(0, 10);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey).push(item);
  });

  return Array.from(groups.entries())
    .map(([date, items]) => {
      const sortedItems = items
        .slice()
        .sort(sortByScoreThenDuration)
        .map((entry, index) => ({
          ...entry,
          dailyPosition: index + 1,
        }));
      return {
        date,
        items: sortedItems,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
};

const normalizeRankingResponse = (payload) => {
  if (!payload) {
    return null;
  }

  const rawFull = payload?.views?.full?.items ?? payload?.ranking ?? [];
  const fullRanking = buildFullRankingFromRaw(rawFull);
  const recentRanking = buildRecentRanking(fullRanking, 10);
  const rankingByDay = buildRankingByDay(fullRanking);

  const latestParticipantRaw = payload?.views?.recent?.latestParticipant ?? recentRanking[0] ?? null;
  let latestParticipant = latestParticipantRaw ? normalizeItem(latestParticipantRaw) : null;

  if (latestParticipant && latestParticipant.position === null) {
    const matched = fullRanking.find((item) => item.submissionId === latestParticipant.submissionId);
    if (matched) {
      latestParticipant = matched;
    } else {
      latestParticipant.position = 0;
    }
  }

  return {
    quiz: payload.quiz
      ? {
          ...payload.quiz,
          prizes: Array.isArray(payload.quiz?.prizes) ? payload.quiz.prizes.map(normalizePrize) : [],
        }
      : null,
    ranking: recentRanking,
    views: {
      recent: {
        items: recentRanking,
        latestParticipant,
      },
      full: {
        total: fullRanking.length,
        items: fullRanking,
      },
      byDay: rankingByDay,
    },
  };
};

const PlayerRanking = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('recent');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [showAllFull, setShowAllFull] = useState(true);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/quizzes/${quizId}/ranking`, {
          params: {
            full: 'true',
          },
        });
        setData(normalizeRankingResponse(response.data));
      } catch (err) {
        setError(err.response?.data?.message || 'Não foi possível carregar o ranking.');
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, [quizId]);

  const fullRanking = data?.views?.full?.items ?? [];

  const filteredFullRanking = useMemo(() => {
    if (!fullRanking.length) {
      return [];
    }

    const term = searchTerm.trim().toLowerCase();
    const date = filterDate.trim();

    return fullRanking.filter((item) => {
      const matchesTerm = term
        ? (item.userName || '').toLowerCase().includes(term) ||
          (item.userEmail || '').toLowerCase().includes(term)
        : true;
      const matchesDate = date ? item.createdAt.slice(0, 10) === date : true;
      return matchesTerm && matchesDate;
    });
  }, [fullRanking, searchTerm, filterDate]);

  const fullRankingVisible = showAllFull ? filteredFullRanking : filteredFullRanking.slice(0, 10);

  if (loading) {
    return <div className="page-loading">Carregando ranking...</div>;
  }

  if (error) {
    return <div className="page-error">{error}</div>;
  }

  if (!data?.quiz) {
    return <div className="page-error">Ranking indisponível.</div>;
  }

  const recentRanking = data.views?.recent?.items ?? [];
  const latestParticipant = data.views?.recent?.latestParticipant ?? null;
  const rankingByDay = data.views?.byDay ?? [];
  const rankingPrizes = data.quiz?.prizes ?? [];

  const renderPrizeList = (prizes) => {
    if (!prizes.length) {
      return <span className="muted-text">-</span>;
    }

    return (
      <div className="ranking-prize-list">
        {prizes.map((prize) => {
          const isClaimed = prize.claimStatus === 'CLAIMED';
          const isDeclined = prize.claimStatus === 'DECLINED';
          const title = isClaimed
            ? `Retirado em ${formatDateTime(prize.claimedAt)}`
            : isDeclined
              ? `Marcado como não retirado em ${formatDateTime(prize.declinedAt)}`
              : prize.isAvailable
                ? 'Pendente de retirada'
                : 'Indisponível em estoque';

          return (
            <span
              key={prize.id}
              className={`prize-chip ${isClaimed ? 'claimed' : isDeclined ? 'declined' : prize.isAvailable ? 'available' : 'unavailable'}`}
              title={title}
            >
              {prize.name}
              <small>
                {isClaimed ? 'retirado' : isDeclined ? 'não retirado' : `${prize.availableQuantity}/${prize.quantity}`}
              </small>
            </span>
          );
        })}
      </div>
    );
  };

  const renderRankingTable = (items, options = {}) => {
    const { highlightSubmissionId = null, showEmail = false, extraColumns = null } = options;

    return (
      <table className="table">
        <thead>
          <tr>
            <th>Posição</th>
            <th>Participante</th>
            {showEmail && <th>E-mail</th>}
            <th>Resultado</th>
            <th>Duração</th>
            <th>Prêmios</th>
            <th>Data</th>
            {extraColumns ? <th>{extraColumns.header}</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => (
            <tr
              key={entry.submissionId}
              className={highlightSubmissionId === entry.submissionId ? 'highlight-row' : ''}
            >
              <td>
                <strong>{entry.position}º</strong>
              </td>
              <td>{entry.userName}</td>
              {showEmail && <td>{entry.userEmail ?? '—'}</td>}
              <td>
                {entry.score}/{entry.total} ({entry.percentage.toFixed(2)}%)
              </td>
              <td>{formatDuration(entry.durationSeconds)}</td>
              <td>{renderPrizeList(entry.prizes ?? [])}</td>
              <td>{dayjs(entry.createdAt).format('DD/MM/YYYY HH:mm')}</td>
              {extraColumns ? <td>{extraColumns.render(entry)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="grid">
      <br />
      <div className="page-title">
        <div>
          <h1>Ranking – {data.quiz.title}</h1>
          <p className="page-description">{data.quiz.description}</p>
        </div>
        <div className="actions">
          <button className="button ghost" type="button" onClick={() => navigate(`/play/quiz/${quizId}`)}>
            Voltar ao quiz
          </button>
          <button className="button" type="button" onClick={() => navigate('/play')}>
            Outros quizzes
          </button>
        </div>
      </div>

      {rankingPrizes.length > 0 && (
        <div className="card">
          <h2>Prêmios do ranking</h2>
          <div className="ranking-prize-catalog">
            {rankingPrizes.map((prize) => (
              <div key={prize.id} className="ranking-prize-card">
                <strong>{prize.position}º lugar</strong>
                <span>{prize.name}</span>
                {prize.description && <small>{prize.description}</small>}
                <span className={`tag ${prize.isAvailable ? 'success' : 'danger'}`}>
                  {prize.availableQuantity}/{prize.quantity} disponível(is)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="ranking-view-switch">
          <button
            type="button"
            className={`button ${viewMode === 'recent' ? '' : 'ghost'}`}
            onClick={() => setViewMode('recent')}
          >
            Recentes
          </button>
          <button
            type="button"
            className={`button ${viewMode === 'full' ? '' : 'ghost'}`}
            onClick={() => setViewMode('full')}
          >
            Lista completa
          </button>
          <button
            type="button"
            className={`button ${viewMode === 'daily' ? '' : 'ghost'}`}
            onClick={() => setViewMode('daily')}
          >
            Ranking diário
          </button>
        </div>

        {viewMode === 'recent' && (
          <>
            {recentRanking.length === 0 ? (
              <div className="empty-state">Ainda não há submissões para este quiz.</div>
            ) : (
              <>
                {latestParticipant && (
                  <div className="tag info" style={{ marginBottom: '1rem', display: 'inline-flex' }}>
                    Participante mais recente: <strong style={{ marginLeft: '0.4rem' }}>{latestParticipant.userName}</strong> – posição {latestParticipant.position}º
                  </div>
                )}
                {renderRankingTable(recentRanking, {
                  highlightSubmissionId: latestParticipant?.submissionId ?? null,
                  showEmail: true,
                })}
              </>
            )}
          </>
        )}

        {viewMode === 'full' && (
          <>
            <div className="ranking-filters">
              <input
                type="text"
                placeholder="Filtrar por nome ou e-mail"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <input
                type="date"
                value={filterDate}
                onChange={(event) => setFilterDate(event.target.value)}
              />
              <button
                className="button ghost"
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFilterDate('');
                }}
              >
                Limpar filtros
              </button>
            </div>
            {filteredFullRanking.length === 0 ? (
              <div className="empty-state">Nenhuma submissão encontrada com os filtros selecionados.</div>
            ) : (
              <>
                {renderRankingTable(fullRankingVisible, { showEmail: true })}
                {filteredFullRanking.length > 10 && (
                  <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                    <button
                      className="button"
                      type="button"
                      onClick={() => setShowAllFull((prev) => !prev)}
                    >
                      {showAllFull ? 'Mostrar menos' : `Ver lista completa (${filteredFullRanking.length})`}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {viewMode === 'daily' && (
          <>
            {!rankingByDay.length ? (
              <div className="empty-state">Ainda não há submissões para este quiz.</div>
            ) : (
              <div className="ranking-daily-groups">
                {rankingByDay.map((group) => (
                  <div key={group.date} className="ranking-daily-group">
                    <div className="ranking-daily-header">
                      <h3>{dayjs(group.date).format('DD/MM/YYYY')}</h3>
                      <span className="tag info">{group.items.length} participação(ões)</span>
                    </div>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Posição geral</th>
                          <th>Participante</th>
                          <th>Resultado</th>
                          <th>Duração</th>
                          <th>Prêmios</th>
                          <th>Posição no dia</th>
                          <th>Horário</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((entry) => (
                          <tr key={entry.submissionId}>
                            <td>
                              <strong>{entry.position}º</strong>
                            </td>
                            <td>{entry.userName}</td>
                            <td>
                              {entry.score}/{entry.total} ({entry.percentage.toFixed(2)}%)
                            </td>
                            <td>{formatDuration(entry.durationSeconds)}</td>
                            <td>{renderPrizeList(entry.prizes ?? [])}</td>
                            <td>{entry.dailyPosition}º</td>
                            <td>{dayjs(entry.createdAt).format('HH:mm')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PlayerRanking;
