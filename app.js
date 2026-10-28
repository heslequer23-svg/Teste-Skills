/* Poliedro Skills V4.20 — Plataforma Oficial de Habilidades Esportivas */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'poliedroskills_atletas';
  const LIVE_STATE_KEY = 'poliedroskills_live_state';
  const CHANNEL_NAME = 'poliedroskills_live';
  const BONUS_UNIT = 2;
  const PENALTY_UNIT = 2;

  const CIRCUITS_STORAGE_KEY = 'poliedroskills_circuitos';
  const MODALIDADES_EMOJIS = { Basquete: '🏀', Futsal: '⚽', 'Vôlei': '🏐' };

  const DEFAULT_CIRCUITOS = {
    Basquete: [
      { type: 'penalty', impact: 'penalty', nome: 'Penalidades de Drible', icon: '🔴', attempts: 5, unit: PENALTY_UNIT, label: 'Penalidade', desc: 'Erros ou violações durante a condução no circuito' },
      { type: 'standard', impact: 'bonus', nome: 'Mudança de Mão', icon: '↔️', bonus: BONUS_UNIT, unit: BONUS_UNIT, desc: 'Execução de crossover (troca de mão) nos pontos demarcados' },
      { type: 'attempts', impact: 'bonus', nome: 'Passe de Precisão', icon: '🎯', attempts: 5, unit: BONUS_UNIT, item: 'Passe', desc: 'Série de 5 passes diretos no alvo fixado' },
      { type: 'attempts', impact: 'bonus', nome: 'Arremesso', icon: '🏀', attempts: 8, unit: BONUS_UNIT, item: 'Arremesso', desc: 'Série de até 8 arremessos nas posições demarcadas' }
    ],
    Futsal: [
      { type: 'penalty', impact: 'penalty', nome: 'Condução', icon: '🔴', attempts: 5, unit: PENALTY_UNIT, label: 'Erro', desc: 'Toques fora da demarcação ou descontrole das estacas' },
      { type: 'standard', impact: 'bonus', nome: 'Mudança de Direção', icon: '↪️', bonus: BONUS_UNIT, unit: BONUS_UNIT, desc: 'Corte rápido em 90 graus simulando drible sobre marcador' },
      { type: 'attempts', impact: 'bonus', nome: 'Domínio & Passe', icon: '🎯', attempts: 5, unit: BONUS_UNIT, item: 'Passe', desc: 'Recepção de bola e passe com precisão no alvo curto' },
      { type: 'attempts', impact: 'bonus', nome: 'Finalização', icon: '⚽', attempts: 5, unit: BONUS_UNIT, item: 'Chute', desc: 'Chute de precisão com bola em movimento no mini gol' }
    ],
    'Vôlei': [
      { type: 'penalty', impact: 'penalty', nome: 'Deslocamento', icon: '🔴', attempts: 5, unit: PENALTY_UNIT, label: 'Erro', desc: 'Invasão ou toque faltoso nas linhas demarcatórias' },
      { type: 'attempts', impact: 'bonus', nome: 'Toque de Precisão', icon: '🙌', attempts: 5, unit: BONUS_UNIT, item: 'Toque', desc: 'Toque alto direcionado para dentro de cesto/arco' },
      { type: 'attempts', impact: 'bonus', nome: 'Manchete', icon: '🏐', attempts: 5, unit: BONUS_UNIT, item: 'Manchete', desc: 'Recepção de manchete correta na zona demarcada' },
      { type: 'attempts', impact: 'bonus', nome: 'Saque e Ataque', icon: '💥', attempts: 5, unit: BONUS_UNIT, item: 'Acerto', desc: 'Saque por cima ou ataque direcionado ao alvo quadra adversária' }
    ]
  };

  function loadCircuitos() {
    try {
      const raw = localStorage.getItem(CIRCUITS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.Basquete) && Array.isArray(parsed.Futsal) && Array.isArray(parsed['Vôlei'])) {
          return parsed;
        }
      }
    } catch (_) { }
    return JSON.parse(JSON.stringify(DEFAULT_CIRCUITOS));
  }

  let CIRCUITOS = loadCircuitos();

  function saveCircuitos(circuits) {
    CIRCUITOS = circuits;
    try {
      localStorage.setItem(CIRCUITS_STORAGE_KEY, JSON.stringify(circuits));
      liveChannel?.postMessage({ type: 'circuits-updated', circuitos: circuits });
    } catch (_) { }
  }

  const $ = (id) => document.getElementById(id);
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  const debounce = (fn, wait = 200) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; };
  const generateId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const formatSeconds = (secs) => Number.isFinite(Number(secs)) ? `${Number(secs).toFixed(2)}s` : '-';
  const formatTime = (ms) => {
    const safe = Math.max(0, Number(ms) || 0);
    const cs = Math.floor(safe / 10);
    return `${String(Math.floor(cs / 6000)).padStart(2, '0')}:${String(Math.floor((cs % 6000) / 100)).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
  };

  function normalizeModalidade(input = '') {
    const clean = String(input).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (clean === 'basquete' || clean === 'basketball' || clean === 'basquetebol' || clean === 'bask') return 'Basquete';
    if (clean === 'futsal' || clean === 'futebol' || clean === 'soccer' || clean === 'fut' || clean === 'futebol de salao') return 'Futsal';
    if (clean === 'volei' || clean === 'voleibol' || clean === 'volleyball' || clean === 'volei de quadra') return 'Vôlei';
    return CIRCUITOS[input] ? input : null;
  }

  const CATEGORIAS_OFICIAIS = [
    'Feminino Fundamental',
    'Masculino Fundamental',
    'Feminino Médio',
    'Masculino Médio'
  ];

  function normalizeCategoria(input = '') {
    const raw = String(input || '').trim();
    if (!raw) return 'Não informada';
    if (CATEGORIAS_OFICIAIS.includes(raw)) return raw;

    const clean = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isFem = clean.includes('fem') || clean.includes('menina') || clean.includes('garota') || clean.startsWith('f ') || clean === 'f' || /\b(feminino|mulher)\b/i.test(clean);
    const isMasc = clean.includes('masc') || clean.includes('menino') || clean.includes('garoto') || clean.startsWith('m ') || clean === 'm' || /\b(masculino|homem)\b/i.test(clean);
    const isFund = clean.includes('fund') || clean.includes('fundamental') || /\b(ef|ef1|ef2|ensino fundamental|[6-9]º|[6-9]o|[6-9]ª)\b/i.test(clean);
    const isMed = clean.includes('medio') || /\b(med|em|ensino medio|[1-3]º\s*em|[1-3]ª\s*serie)\b/i.test(clean);

    if (isFem && !isMasc) {
      if (isMed && !isFund) return 'Feminino Médio';
      if (isFund && !isMed) return 'Feminino Fundamental';
    } else if (isMasc && !isFem) {
      if (isMed && !isFund) return 'Masculino Médio';
      if (isFund && !isMed) return 'Masculino Fundamental';
    }

    const exact = CATEGORIAS_OFICIAIS.find(c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === clean);
    return exact || raw;
  }

  function seedData() {
    // V4.15: instalação nova inicia sem dados fictícios.
    return [];
  }

  function normalizeAthlete(raw = {}) {
    const tempoBase = raw.tempoBase === null || raw.tempoBase === '' ? null : Number(raw.tempoBase);
    const bonus = Number.isFinite(Number(raw.bonus)) ? Math.max(0, Number(raw.bonus)) : 0;
    const penalidade = Number.isFinite(Number(raw.penalidade)) ? Math.max(0, Number(raw.penalidade)) : 0;
    const calculated = Number.isFinite(tempoBase) ? Math.max(0, tempoBase + penalidade - bonus) : null;
    const legacyPendingRegistration = (raw.tempoBase === null || raw.tempoBase === '' || raw.tempoBase === undefined)
      && !raw.dataRegistro && Number(raw.tempoFinal) === 0;
    const hasTempoFinal = !legacyPendingRegistration && raw.tempoFinal !== null && raw.tempoFinal !== '' && raw.tempoFinal !== undefined;
    return {
      id: raw.id || generateId(),
      nome: String(raw.nome || 'Aluno sem nome').trim(),
      turma: String(raw.turma || 'Não informada').trim(),
      categoria: normalizeCategoria(raw.categoria),
      modalidade: normalizeModalidade(raw.modalidade) || 'Basquete',
      tempoBase,
      bonus,
      penalidade,
      tempoFinal: hasTempoFinal && Number.isFinite(Number(raw.tempoFinal)) ? Math.max(0, Number(raw.tempoFinal)) : calculated,
      dataRegistro: raw.dataRegistro || null,
      detalhes: raw.detalhes && typeof raw.detalhes === 'object' ? raw.detalhes : {},
      statusParticipacao: ['nao_participou', 'em_andamento', 'ja_participou', 'ausente', 'desclassificado'].includes(raw.statusParticipacao)
        ? raw.statusParticipacao
        : (hasTempoFinal || Number.isFinite(calculated) ? 'ja_participou' : 'nao_participou')
    };
  }

  function getAtletas() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (Array.isArray(parsed)) {
        const normalized = parsed.map(normalizeAthlete);
        if (JSON.stringify(normalized) !== JSON.stringify(parsed)) localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      }
    } catch (error) { console.error(error); }
    const initial = seedData();
    saveAtletas(initial, false);
    return initial;
  }

  let liveChannel = null;
  try { liveChannel = new BroadcastChannel(CHANNEL_NAME); } catch (_) { }

  function saveLiveState(patch = {}) {
    const previous = (() => { try { return JSON.parse(localStorage.getItem(LIVE_STATE_KEY) || '{}'); } catch { return {}; } })();
    const state = { ...previous, ...patch, updatedAt: Date.now() };
    localStorage.setItem(LIVE_STATE_KEY, JSON.stringify(state));
    liveChannel?.postMessage({ type: 'live-state', state });
    return state;
  }

  function getLiveState() {
    try { return JSON.parse(localStorage.getItem(LIVE_STATE_KEY) || '{}'); } catch { return {}; }
  }

  function saveAtletas(atletas, broadcast = true) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(atletas));
    if (broadcast) liveChannel?.postMessage({ type: 'refresh' });
  }

  let currentAtletas = getAtletas();
  let currentFilters = { modalidade: 'Todas', categoria: 'Todas', search: '' };
  let startTime = 0, elapsedTime = 0, timerInterval = null, isRunning = false;
  let performanceState = { bonus: 0, penalty: 0, details: {} };

  const navbar = $('navbar'), mobileToggle = $('mobile-toggle'), navLinks = $('nav-links');
  const btnInscricao = $('btn-inscricao'), modalInscricao = $('modal-inscricao'), modalClose = $('modal-close'), formInscricao = $('form-inscricao');
  const atletaSelect = $('atleta-select'), cronometroDisplay = $('cronometro-display'), cronometroStatus = $('cronometro-status');
  const btnIniciar = $('btn-iniciar'), btnPausar = $('btn-pausar'), btnZerar = $('btn-zerar'), btnRegistrar = $('btn-registrar');
  const estacoesGrid = $('estacoes-grid'), bonusDisplay = $('bonus-display'), penaltyDisplay = $('penalty-display'), tempoFinalDisplay = $('tempo-final-display');
  const rankingTableBody = $('ranking-table-body'), rankingEmpty = $('ranking-empty'), searchInput = $('search-input');
  const overviewSportName = $('overview-sport-name'), overviewSportIcon = $('overview-sport-icon');
  const overviewEnrolled = $('overview-enrolled'), overviewFinished = $('overview-finished'), overviewPending = $('overview-pending'), overviewRecord = $('overview-record');
  let overviewSport = 'Basquete';

  window.addEventListener('scroll', () => navbar?.classList.toggle('scrolled', window.scrollY > 50));
  mobileToggle?.addEventListener('click', () => navLinks?.classList.toggle('active'));
  document.querySelectorAll('#nav-links a').forEach(a => a.addEventListener('click', () => navLinks?.classList.remove('active')));

  function openModal(athlete = null) {
    modalInscricao?.classList.add('active');
    document.body.style.overflow = 'hidden';
    const title = $('modal-inscricao-title') || modalInscricao?.querySelector('.modal__title');
    if (title) title.textContent = athlete ? 'Editar inscrição' : 'Nova inscrição';
    if ($('input-edit-id')) $('input-edit-id').value = athlete?.id || '';
    if ($('input-nome')) $('input-nome').value = athlete?.nome || '';
    if ($('input-turma')) $('input-turma').value = athlete?.turma || '';
    if ($('input-categoria')) $('input-categoria').value = athlete?.categoria || '';
    if ($('input-modalidade')) $('input-modalidade').value = athlete?.modalidade || '';
  }
  function closeModal() {
    modalInscricao?.classList.remove('active');
    document.body.style.overflow = '';
    formInscricao?.reset();
    if ($('input-edit-id')) $('input-edit-id').value = '';
    const title = $('modal-inscricao-title') || modalInscricao?.querySelector('.modal__title');
    if (title) title.textContent = 'Nova inscrição';
  }
  btnInscricao?.addEventListener('click', () => openModal());
  modalClose?.addEventListener('click', closeModal);
  modalInscricao?.addEventListener('click', e => { if (e.target === modalInscricao) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      adminCloseModal();
      hideResultPresentation();
    }
    if (e.code === 'Space' && $('painel')) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button') return;
      e.preventDefault();
      if (isRunning) pauseTimer();
      else startTimer();
    }
  });

  function isDuplicateAthlete(nome, turma, modalidade, excludeId = null) {
    const cleanNome = String(nome || '').trim().toLowerCase();
    const cleanTurma = String(turma || '').trim().toLowerCase();
    const cleanMod = normalizeModalidade(modalidade);
    return currentAtletas.some(a =>
      a.id !== excludeId &&
      String(a.nome || '').trim().toLowerCase() === cleanNome &&
      String(a.turma || '').trim().toLowerCase() === cleanTurma &&
      a.modalidade === cleanMod
    );
  }

  formInscricao?.addEventListener('submit', e => {
    e.preventDefault();
    const id = $('input-edit-id')?.value;
    const nome = $('input-nome')?.value.trim(), turma = $('input-turma')?.value.trim();
    const categoria = normalizeCategoria($('input-categoria')?.value);
    const modalidade = normalizeModalidade($('input-modalidade')?.value);
    if (!nome || !turma || !categoria || !modalidade) return alert('Preencha todos os campos.');
    if (isDuplicateAthlete(nome, turma, modalidade, id || null)) {
      return alert(`O aluno "${nome}" (${turma}) já está inscrito na modalidade ${modalidade}.`);
    }
    if (id) {
      const a = currentAtletas.find(x => x.id === id);
      if (!a) return;
      if ((a.modalidade !== modalidade || a.categoria !== categoria) && a.tempoFinal !== null) {
        if (!confirm('A modalidade ou categoria foi alterada para um aluno que já possui tempo registrado. Isso redefinirá a tentativa para "Não participou". Deseja continuar?')) {
          return;
        }
        resetParticipation(a);
      }
      a.nome = nome;
      a.turma = turma;
      a.categoria = categoria;
      a.modalidade = modalidade;
    } else {
      currentAtletas.push(normalizeAthlete({ id: generateId(), nome, turma, categoria, modalidade, tempoBase: null, bonus: 0, penalidade: 0, tempoFinal: null, dataRegistro: null, detalhes: {}, statusParticipacao: 'nao_participou' }));
    }
    saveAtletas(currentAtletas);
    closeModal();
    refreshAll();
  });

  function updateStats() {
    if (!overviewSportName) return;
    const sportAthletes = currentAtletas.filter(a => a.modalidade === overviewSport);
    const finished = sportAthletes.filter(a => a.statusParticipacao === 'ja_participou' && Number.isFinite(Number(a.tempoFinal)));
    const pending = sportAthletes.filter(a => a.statusParticipacao === 'nao_participou' || a.statusParticipacao === 'em_andamento');
    const icons = { Basquete: '🏀', Futsal: '⚽', 'Vôlei': '🏐' };
    const labels = { Basquete: 'Basquete', Futsal: 'Futsal', 'Vôlei': 'Vôlei' };
    overviewSportName.textContent = labels[overviewSport] || overviewSport;
    if (overviewSportIcon) overviewSportIcon.textContent = icons[overviewSport] || '🏅';
    if (overviewEnrolled) overviewEnrolled.textContent = sportAthletes.length;
    if (overviewFinished) overviewFinished.textContent = finished.length;
    if (overviewPending) overviewPending.textContent = pending.length;
    if (overviewRecord) overviewRecord.textContent = finished.length ? `${Math.min(...finished.map(a => Number(a.tempoFinal))).toFixed(2)}s` : '—';
  }

  document.querySelectorAll('[data-overview-sport]').forEach(button => {
    button.addEventListener('click', () => {
      overviewSport = button.dataset.overviewSport;
      document.querySelectorAll('[data-overview-sport]').forEach(item => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      updateStats();
    });
  });

  function updateCompetitionCommand() {
    const recorded = currentAtletas.filter(a => a.statusParticipacao === 'ja_participou' && Number.isFinite(Number(a.tempoFinal)));
    const pending = currentAtletas.filter(a => a.statusParticipacao === 'nao_participou');
    const live = getLiveState();
    const current = live.athleteName || 'Aguardando';
    const sport = live.modalidade || currentFilters.modalidade || 'Todas';

    let statusText = 'Aguardando';
    let statusBg = 'rgba(100,116,139,.18)';
    let statusBorder = 'rgba(100,116,139,.35)';
    let statusColor = '#cbd5e1';

    if (live.status === 'running') {
      statusText = '● Ao vivo';
      statusBg = 'rgba(22,163,106,.2)';
      statusBorder = 'rgba(105,237,177,.35)';
      statusColor = '#6ee7b7';
    } else if (live.status === 'paused') {
      statusText = '⏸️ Pausada';
      statusBg = 'rgba(234,179,8,.2)';
      statusBorder = 'rgba(250,204,21,.35)';
      statusColor = '#fde047';
    } else if (live.status === 'finished') {
      statusText = '✅ Registrado';
      statusBg = 'rgba(59,130,246,.2)';
      statusBorder = 'rgba(147,197,253,.35)';
      statusColor = '#93c5fd';
    } else if (live.status === 'ready' && live.athleteName) {
      statusText = '⚡ Na pista';
      statusBg = 'rgba(249,115,22,.2)';
      statusBorder = 'rgba(251,146,60,.35)';
      statusColor = '#fdba74';
    }

    const nextAthlete = pending.find(a => a.id !== live.athleteId && (currentFilters.modalidade === 'Todas' || a.modalidade === currentFilters.modalidade))
      || pending.find(a => a.id !== live.athleteId);
    const next = nextAthlete?.nome || 'A definir';
    const total = currentAtletas.length;
    const pct = total ? Math.round((recorded.length / total) * 100) : 0;

    document.querySelectorAll('#command-status').forEach(el => {
      el.textContent = statusText;
      el.style.background = statusBg;
      el.style.border = `1px solid ${statusBorder}`;
      el.style.color = statusColor;
    });
    document.querySelectorAll('#command-current').forEach(el => el.textContent = current);
    document.querySelectorAll('#command-next').forEach(el => el.textContent = next);
    document.querySelectorAll('#command-sport').forEach(el => el.textContent = sport);
    document.querySelectorAll('#command-progress').forEach(el => el.textContent = `${recorded.length} / ${total}`);
    document.querySelectorAll('#command-progress-bar').forEach(el => el.style.width = `${pct}%`);
  }

  function renderRankingPodium(list) {
    const host = $('ranking-podium-v4'); if (!host) return;
    const medals = ['🥇', '🥈', '🥉'];
    host.innerHTML = list.slice(0, 3).map((a, i) => `<article class="ranking-podium-card ranking-podium-card--${i + 1}"><span class="ranking-podium-card__medal">${medals[i]}</span><h3>${escapeHTML(a.nome)}</h3><p>${escapeHTML(a.turma)} • ${escapeHTML(a.categoria)}</p><strong>${formatSeconds(a.tempoFinal)}</strong><small>${escapeHTML(a.modalidade)}</small></article>`).join('') || '<div class="ranking__empty">Aguardando resultados oficiais.</div>';
  }

  function renderRanking() {
    if (!rankingTableBody) return;
    let list = currentAtletas.filter(a => a.statusParticipacao === 'ja_participou' && a.tempoFinal !== null && Number.isFinite(Number(a.tempoFinal)));
    if (currentFilters.modalidade !== 'Todas') list = list.filter(a => a.modalidade === currentFilters.modalidade);
    if (currentFilters.categoria !== 'Todas') list = list.filter(a => a.categoria === currentFilters.categoria);
    if (currentFilters.search) {
      const term = currentFilters.search.toLowerCase();
      list = list.filter(a => `${a.nome} ${a.turma}`.toLowerCase().includes(term));
    }
    list.sort((a, b) => Number(a.tempoFinal) - Number(b.tempoFinal));
    renderRankingPodium(list);
    updateCompetitionCommand();
    rankingTableBody.innerHTML = '';
    rankingEmpty.style.display = list.length ? 'none' : 'block';
    rankingTableBody.closest('table').style.display = list.length ? 'table' : 'none';
    list.forEach((a, index) => {
      const tr = document.createElement('tr');
      const pos = index + 1;
      if (pos <= 3) tr.classList.add(`pos--${pos}`);
      const medal = ['', ' 🥇', ' 🥈', ' 🥉'][pos] || '';
      tr.innerHTML = `<td>${pos}º${medal}</td><td><strong>${escapeHTML(a.nome)}</strong><br><small>${escapeHTML(a.turma)}</small></td><td>${escapeHTML(a.categoria)}</td><td>${escapeHTML(a.modalidade)} ${MODALIDADES_EMOJIS[a.modalidade] || ''}</td><td>${formatSeconds(a.tempoBase)}</td><td class="text-green">-${Number(a.bonus || 0).toFixed(1)}s</td><td class="text-red">+${Number(a.penalidade || 0).toFixed(1)}s</td><td><strong>${formatSeconds(a.tempoFinal)}</strong></td>`;
      rankingTableBody.appendChild(tr);
    });
  }

  document.querySelectorAll('#filter-modalidade .filter-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('#filter-modalidade .filter-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
    currentFilters.modalidade = btn.dataset.filter === 'todas' ? 'Todas' : btn.dataset.filter; renderRanking();
  }));
  document.querySelectorAll('#filter-categoria .filter-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('#filter-categoria .filter-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
    currentFilters.categoria = btn.dataset.filter === 'todas' ? 'Todas' : btn.dataset.filter; renderRanking();
  }));
  searchInput?.addEventListener('input', debounce(e => { currentFilters.search = e.target.value; renderRanking(); }));

  function populateAtletaSelect(query = '', sportFilter = 'todas') {
    if (!atletaSelect) return;
    const previous = atletaSelect.value;
    const cleanQ = String(query || '').trim().toLowerCase();
    const cleanSport = String(sportFilter || $('painel-sport-filter')?.value || 'todas');

    let list = [...currentAtletas];
    if (cleanSport !== 'todas') {
      list = list.filter(a => a.modalidade === cleanSport);
    }
    if (cleanQ) {
      list = list.filter(a => `${a.nome} ${a.turma} ${a.categoria} ${a.modalidade}`.toLowerCase().includes(cleanQ));
    }

    const semAtletasAviso = $('painel-sem-atletas-aviso');
    if (semAtletasAviso) {
      semAtletasAviso.classList.toggle('hidden', currentAtletas.length > 0);
    }

    const countEl = $('painel-atleta-count');
    if (countEl) {
      const aptos = list.filter(a => ['nao_participou', 'em_andamento'].includes(a.statusParticipacao)).length;
      countEl.textContent = cleanQ || cleanSport !== 'todas'
        ? `${list.length} encontrado(s)`
        : `${aptos} apto(s) / ${currentAtletas.length} total`;
    }

    if (!currentAtletas.length) {
      atletaSelect.innerHTML = '<option value="">Nenhum atleta cadastrado no sistema</option>';
      return;
    }

    if (!list.length) {
      atletaSelect.innerHTML = '<option value="">Nenhum atleta encontrado para esta busca/filtro</option>';
      return;
    }

    atletaSelect.innerHTML = '<option value="">Selecione um atleta inscrito...</option>';
    const groups = [
      ['nao_participou', 'DISPONÍVEIS PARA TENTATIVA (NÃO PARTICIPARAM)'],
      ['em_andamento', 'EM ANDAMENTO (PROVA INICIADA)'],
      ['ja_participou', 'JÁ PARTICIPARAM (RESULTADO REGISTRADO)'],
      ['ausente', 'AUSENTES'],
      ['desclassificado', 'DESCLASSIFICADOS']
    ];

    groups.forEach(([status, label]) => {
      const athletes = list.filter(a => a.statusParticipacao === status).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      if (!athletes.length) return;
      const group = document.createElement('optgroup');
      group.label = label;
      athletes.forEach(a => {
        const option = document.createElement('option');
        option.value = a.id;
        option.dataset.modalidade = a.modalidade;
        const finalText = status === 'ja_participou' ? ` — [${formatSeconds(a.tempoFinal)}]` : '';
        option.textContent = `${a.nome} — ${a.turma} | ${MODALIDADES_EMOJIS[a.modalidade] || ''} ${a.modalidade} (${a.categoria})${finalText}`;
        group.appendChild(option);
      });
      atletaSelect.appendChild(group);
    });

    if (previous && [...atletaSelect.options].some(o => o.value === previous)) {
      atletaSelect.value = previous;
    } else if (cleanQ && list.length === 1 && !isRunning) {
      atletaSelect.value = list[0].id;
      const mod = atletaSelect.selectedOptions?.[0]?.dataset?.modalidade;
      updateEstacoesGrid(mod);
      resetTimer(false);
    } else if (!atletaSelect.value) {
      updateEstacoesGrid('');
      resetTimer(false);
    }
  }

  $('painel-search-atleta')?.addEventListener('input', debounce(e => {
    const q = e.target.value;
    const sport = $('painel-sport-filter')?.value || 'todas';
    populateAtletaSelect(q, sport);
  }, 100));

  $('painel-sport-filter')?.addEventListener('change', e => {
    const sport = e.target.value;
    const q = $('painel-search-atleta')?.value || '';
    populateAtletaSelect(q, sport);
  });

  function updateCalculations() {
    if (bonusDisplay) bonusDisplay.textContent = `-${performanceState.bonus.toFixed(1)}s`;
    if (penaltyDisplay) penaltyDisplay.textContent = `+${performanceState.penalty.toFixed(1)}s`;
    const final = Math.max(0, elapsedTime / 1000 + performanceState.penalty - performanceState.bonus);
    if (tempoFinalDisplay) tempoFinalDisplay.textContent = `${final.toFixed(2)}s`;
  }

  function resetPerformance() { performanceState = { bonus: 0, penalty: 0, details: {} }; updateCalculations(); }

  function recalculatePerformance() {
    const modalidade = atletaSelect?.selectedOptions?.[0]?.dataset?.modalidade;
    if (!modalidade || !CIRCUITOS[modalidade]) {
      performanceState.bonus = 0;
      performanceState.penalty = 0;
      return;
    }
    let totalBonus = 0;
    let totalPenalty = 0;
    (CIRCUITOS[modalidade] || []).forEach(cfg => {
      const count = Number(performanceState.details[cfg.nome] || 0);
      if (!count) return;
      const unit = Number(cfg.unit || cfg.bonus || 2);
      const isPenalty = cfg.type === 'penalty' || cfg.impact === 'penalty';
      if (isPenalty) totalPenalty += count * unit;
      else totalBonus += count * unit;
    });
    performanceState.bonus = totalBonus;
    performanceState.penalty = totalPenalty;
  }

  function calculateBonus() {
    recalculatePerformance();
    return performanceState.bonus;
  }

  function createCard(item, index) {
    const isPenalty = item.type === 'penalty' || item.impact === 'penalty';
    const unit = Number(item.unit || item.bonus || 2);
    const card = document.createElement('div');
    card.className = `subestacao-card ${isPenalty ? 'subestacao-card--penalty' : ''}`;
    const badge = document.createElement('span');
    badge.className = `subestacao-card__badge ${isPenalty ? 'subestacao-card__badge--danger' : ''}`;
    badge.textContent = `0 / ${item.attempts} (${isPenalty ? '+' : '-'}0s)`;
    const header = document.createElement('div');
    header.className = 'subestacao-card__header';
    header.innerHTML = `<div class="subestacao-card__title"><span>${item.icon || '⚡'}</span>${index + 1}. ${escapeHTML(item.nome)}</div>`;
    header.appendChild(badge);
    card.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'subestacao-attempts__grid';
    let selectedCount = 0;
    for (let i = 1; i <= item.attempts; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = isPenalty ? 'penalty-btn' : 'pass-btn';
      const label = isPenalty ? `${item.label || 'Erro'} ${i}` : `${item.item || 'Tentativa'} ${i}`;
      btn.innerHTML = `<span class="pass-btn__title">${escapeHTML(label)}</span><span class="${isPenalty ? 'penalty-btn__time' : 'pass-btn__bonus'}">${isPenalty ? '+' : '-'}${unit}s</span><span class="pass-btn__check">✓</span>`;
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        selectedCount += btn.classList.contains('active') ? 1 : -1;
        const value = selectedCount * unit;
        performanceState.details[item.nome] = selectedCount;
        recalculatePerformance();
        badge.textContent = `${selectedCount} / ${item.attempts} (${isPenalty ? '+' : '-'}${value}s)`;
        updateCalculations();
      });
      grid.appendChild(btn);
    }
    card.appendChild(grid);
    return card;
  }

  function updateEstacoesGrid(modalidade) {
    if (!estacoesGrid) return;
    estacoesGrid.innerHTML = '';
    resetPerformance();
    const sportLabel = $('painel-modalidade');
    if (sportLabel) sportLabel.textContent = modalidade ? `${MODALIDADES_EMOJIS[modalidade] || ''} ${modalidade}` : 'Aguardando seleção';
    if (!modalidade || !CIRCUITOS[modalidade]) {
      estacoesGrid.innerHTML = '<div class="painel__empty-state"><span class="painel__empty-state-icon">👤</span><strong>Selecione um atleta para carregar o circuito</strong><p>As estações, os bônus e as penalidades serão exibidos conforme a modalidade inscrita.</p></div>';
      return;
    }
    (CIRCUITOS[modalidade] || []).forEach((item, index) => {
      const isPenalty = item.type === 'penalty' || item.impact === 'penalty';
      const hasAttempts = Boolean(item.attempts && Number(item.attempts) > 1 && item.type !== 'standard');
      const unit = Number(item.unit || item.bonus || 2);

      if (!hasAttempts || item.type === 'standard') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `estacao-btn ${isPenalty ? 'estacao-btn--penalty' : ''}`;
        btn.innerHTML = `<span class="estacao-btn__number">${index + 1}</span><span class="estacao-btn__text">${item.icon || '⚡'} ${escapeHTML(item.nome)} (${isPenalty ? '+' : '-'}${unit}s)</span><span class="estacao-btn__check">✓</span>`;
        btn.addEventListener('click', () => {
          btn.classList.toggle('active');
          performanceState.details[item.nome] = btn.classList.contains('active') ? 1 : 0;
          recalculatePerformance();
          updateCalculations();
        });
        estacoesGrid.appendChild(btn);
      } else {
        estacoesGrid.appendChild(createCard(item, index));
      }
    });
  }

  let lastLiveBroadcast = 0;
  function publishPanelState(status) {
    const selected = currentAtletas.find(a => a.id === atletaSelect?.value);
    if (!selected) return;
    saveLiveState({
      athleteId: selected.id, athleteName: selected.nome, turma: selected.turma, categoria: selected.categoria,
      modalidade: selected.modalidade, elapsedMs: elapsedTime, status: status || (isRunning ? 'running' : elapsedTime > 0 ? 'paused' : 'ready'),
      bonus: performanceState.bonus, penalty: performanceState.penalty, projectedFinal: Math.max(0, elapsedTime / 1000 + performanceState.penalty - performanceState.bonus)
    });
    updateCompetitionCommand();
  }

  function updateTimerDisplay(forceBroadcast = false) {
    if (cronometroDisplay) cronometroDisplay.textContent = formatTime(elapsedTime);
    updateCalculations();
    if (atletaSelect?.value) {
      const now = performance.now();
      if (forceBroadcast || now - lastLiveBroadcast >= 100) {
        lastLiveBroadcast = now;
        publishPanelState();
      }
    }
  }

  function startTimer() {
    if (isRunning) return;
    const selected = currentAtletas.find(a => a.id === atletaSelect?.value);
    if (!selected) return alert('Selecione um atleta antes de iniciar o cronômetro.');
    if (!['nao_participou', 'em_andamento'].includes(selected.statusParticipacao)) {
      if (selected.statusParticipacao === 'ja_participou') {
        if (!confirm(`Este atleta já possui tempo registrado (${formatSeconds(selected.tempoFinal)}). Deseja reabrir a tentativa para uma nova cronometragem oficial?`)) {
          return;
        }
        resetParticipation(selected);
        saveAtletas(currentAtletas);
      } else {
        return alert('Este atleta não está disponível para uma nova tentativa.');
      }
    }
    selected.statusParticipacao = 'em_andamento';
    saveAtletas(currentAtletas);
    isRunning = true;
    startTime = performance.now() - elapsedTime;
    timerInterval = setInterval(() => {
      elapsedTime = performance.now() - startTime;
      updateTimerDisplay(false);
    }, 10);
    if (cronometroStatus) {
      cronometroStatus.textContent = 'Rodando... 🟢';
      cronometroStatus.className = 'cronometro__status cronometro__status--running';
    }
    if (btnIniciar) btnIniciar.disabled = true;
    if (btnPausar) btnPausar.disabled = false;
    lastLiveBroadcast = performance.now();
    publishPanelState('running');
  }

  function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerInterval);
    if (cronometroStatus) {
      cronometroStatus.textContent = 'Pausado ⏸️';
      cronometroStatus.className = 'cronometro__status cronometro__status--paused';
    }
    if (btnIniciar) btnIniciar.disabled = false;
    if (btnPausar) btnPausar.disabled = true;
    lastLiveBroadcast = performance.now();
    publishPanelState('paused');
  }

  function resetTimer(skipLivePublish = false) {
    isRunning = false;
    clearInterval(timerInterval);
    elapsedTime = 0;
    if (cronometroDisplay) cronometroDisplay.textContent = formatTime(0);
    resetPerformance();
    document.querySelectorAll('#estacoes-grid .active').forEach(x => x.classList.remove('active'));
    if (cronometroStatus) {
      cronometroStatus.textContent = 'Pronto para iniciar';
      cronometroStatus.className = 'cronometro__status';
    }
    if (btnIniciar) btnIniciar.disabled = false;
    if (btnPausar) btnPausar.disabled = true;
    if (!skipLivePublish && atletaSelect?.value) {
      lastLiveBroadcast = performance.now();
      publishPanelState('ready');
    }
  }

  atletaSelect?.addEventListener('change', () => {
    const mod = atletaSelect.selectedOptions?.[0]?.dataset?.modalidade;
    updateEstacoesGrid(mod);
    resetTimer(false);
  });
  btnIniciar?.addEventListener('click', startTimer);
  btnPausar?.addEventListener('click', pauseTimer);
  btnZerar?.addEventListener('click', () => resetTimer(false));

  function getBreakdown(modalidade, details = {}) {
    const bonusItems = [], penaltyItems = [];
    (CIRCUITOS[modalidade] || []).forEach(item => {
      const count = Math.max(0, Number(details[item.nome] || 0));
      if (!count) return;
      const isPenalty = item.type === 'penalty' || item.impact === 'penalty';
      const unit = Number(item.unit || item.bonus || 2);
      if (isPenalty) penaltyItems.push({ nome: item.nome, count, seconds: count * unit });
      else bonusItems.push({ nome: item.nome, count, seconds: count * unit });
    });
    return { bonusItems, penaltyItems };
  }

  btnRegistrar?.addEventListener('click', () => {
    const id = atletaSelect?.value;
    if (!id) return alert('Selecione um atleta primeiro.');
    if (elapsedTime <= 0) return alert('O cronômetro precisa ter um tempo registrado.');
    if (isRunning) pauseTimer();
    const athlete = currentAtletas.find(a => a.id === id);
    if (!athlete) return;

    const previousGroup = currentAtletas
      .filter(a => a.id !== id && a.statusParticipacao === 'ja_participou' && a.modalidade === athlete.modalidade && a.categoria === athlete.categoria && Number.isFinite(Number(a.tempoFinal)))
      .sort((a, b) => Number(a.tempoFinal) - Number(b.tempoFinal));
    const previousRecord = previousGroup.length ? Number(previousGroup[0].tempoFinal) : null;

    athlete.tempoBase = Number((elapsedTime / 1000).toFixed(2));
    athlete.bonus = Number((performanceState.bonus || 0).toFixed(2));
    athlete.penalidade = Number((performanceState.penalty || 0).toFixed(2));
    athlete.tempoFinal = Math.max(0, Number((athlete.tempoBase + athlete.penalidade - athlete.bonus).toFixed(2)));
    athlete.statusParticipacao = 'ja_participou';
    athlete.detalhes = { ...performanceState.details };
    athlete.dataRegistro = new Date().toISOString();

    const updatedGroup = [...previousGroup, athlete].sort((a, b) => Number(a.tempoFinal) - Number(b.tempoFinal));
    const position = updatedGroup.findIndex(a => a.id === athlete.id) + 1;
    const isNewRecord = previousRecord === null || athlete.tempoFinal < previousRecord;
    const improvement = previousRecord === null ? null : Math.max(0, Number((previousRecord - athlete.tempoFinal).toFixed(2)));
    const breakdown = getBreakdown(athlete.modalidade, athlete.detalhes);
    const duration = isNewRecord && position === 1 ? 18000 : isNewRecord ? 15000 : position <= 3 ? 12000 : 9000;
    const presentation = {
      id: generateId(), createdAt: Date.now(), activeUntil: Date.now() + duration, duration,
      athlete: { ...athlete }, position, isNewRecord, previousRecord, improvement,
      isNewLeader: position === 1, enteredPodium: position <= 3, totalCompetitors: updatedGroup.length,
      breakdown
    };

    athlete.posicao = position;
    athlete.novoRecorde = isNewRecord;
    athlete.recordeAnterior = previousRecord;
    saveAtletas(currentAtletas);
    saveLiveState({
      athleteId: athlete.id,
      athleteName: athlete.nome,
      turma: athlete.turma,
      categoria: athlete.categoria,
      modalidade: athlete.modalidade,
      lastResult: { ...athlete },
      presentation,
      status: 'finished',
      elapsedMs: elapsedTime,
      projectedFinal: athlete.tempoFinal
    });
    showResultPresentation(presentation);
    btnRegistrar.textContent = 'Registrado! ✅';
    setTimeout(() => { if (btnRegistrar) btnRegistrar.textContent = '📊 Registrar Tempo no Ranking Oficial'; }, 1600);
    resetTimer(true);
    if (atletaSelect) atletaSelect.value = '';
    updateEstacoesGrid('');
    refreshAll();
  });

  function renderCircuitosPage() {
    const sportMap = {
      Basquete: 'circuito-basquete',
      Futsal: 'circuito-futsal',
      'Vôlei': 'circuito-volei'
    };

    let totalStations = 0;
    let sportsCount = 0;

    Object.entries(sportMap).forEach(([sportName, containerId]) => {
      const container = document.querySelector(`#${containerId} .circuito__stations`);
      if (!container) return;
      const stations = CIRCUITOS[sportName] || [];
      sportsCount++;
      totalStations += stations.length;

      container.innerHTML = stations.map((item, idx) => {
        const isPenalty = item.type === 'penalty' || item.impact === 'penalty';
        const unit = Number(item.unit || item.bonus || 2);
        const hasAttempts = Boolean(item.attempts && item.type !== 'standard');
        const attemptsText = hasAttempts ? ` (${item.attempts} ${escapeHTML(item.item || item.label || 'Tentativas')})` : '';
        const badgeText = isPenalty
          ? `+${unit}s por ${escapeHTML(item.label || 'penalidade')}`
          : hasAttempts
            ? `-${unit}s por ${escapeHTML(item.item || 'acerto')} (Até -${unit * item.attempts}s total)`
            : `-${unit}s bônus por execução`;
        const badgeStyle = isPenalty
          ? 'color: #b42318; background: #fef2f2; border: 1px solid #fecaca;'
          : '';

        return `
          <div class="station-card ${isPenalty ? 'station-card--penalty' : ''}">
            <div class="station-card__number">${idx + 1}</div>
            <div>
              <div class="station-card__title">${item.icon || '⚡'} ${escapeHTML(item.nome)}${attemptsText}</div>
              <p class="station-card__desc">${escapeHTML(item.desc || (isPenalty ? 'Evite cometer faltas ou violações nesta estação.' : 'Execute com técnica e agilidade para descontar tempo.'))}</p>
              <span class="station-card__bonus" style="${badgeStyle}">${badgeText}</span>
            </div>
          </div>
        `;
      }).join('');
    });

    const avgStations = sportsCount > 0 ? Math.round(totalStations / sportsCount) : 4;
    const countEl = $('circuit-overview-count') || document.querySelector('.circuits-overview article:nth-child(2) span');
    if (countEl) countEl.textContent = avgStations;
  }

  document.querySelectorAll('.circuito-tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.circuito-tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.circuito-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active'); $(`circuito-${tab.dataset.sport}`)?.classList.add('active');
  }));

  renderCircuitosPage();

  function exportCSV() {
    const headers = [
      'Posição Oficial',
      'Status',
      'Nome do Aluno',
      'Turma',
      'Modalidade',
      'Categoria',
      'Tempo Cronometrado (s)',
      'Total Bônus (s)',
      'Total Penalidades (s)',
      'Tempo Final Líquido (s)',
      'Data do Registro Oficial'
    ];

    const formatDecimalBR = (num) => Number.isFinite(Number(num)) ? Number(num).toFixed(2).replace('.', ',') : '—';

    const MOD_ORDER = { Basquete: 1, Futsal: 2, 'Vôlei': 3 };
    const CAT_ORDER = {
      'Feminino Fundamental': 1,
      'Masculino Fundamental': 2,
      'Feminino Médio': 3,
      'Masculino Médio': 4
    };

    // Mapeia posições oficiais por modalidade + categoria
    const categoryRanks = {};
    Object.keys(MOD_ORDER).forEach(mod => {
      Object.keys(CAT_ORDER).forEach(cat => {
        const key = `${mod}__${cat}`;
        categoryRanks[key] = currentAtletas
          .filter(a => a.modalidade === mod && a.categoria === cat && a.statusParticipacao === 'ja_participou' && Number.isFinite(Number(a.tempoFinal)))
          .sort((a, b) => Number(a.tempoFinal) - Number(b.tempoFinal));
      });
    });

    const sortedList = [...currentAtletas].sort((a, b) => {
      const modDiff = (MOD_ORDER[a.modalidade] || 99) - (MOD_ORDER[b.modalidade] || 99);
      if (modDiff !== 0) return modDiff;

      const catDiff = (CAT_ORDER[a.categoria] || 99) - (CAT_ORDER[b.categoria] || 99);
      if (catDiff !== 0) return catDiff;

      const aFinished = a.statusParticipacao === 'ja_participou' && Number.isFinite(Number(a.tempoFinal));
      const bFinished = b.statusParticipacao === 'ja_participou' && Number.isFinite(Number(b.tempoFinal));

      if (aFinished && bFinished) {
        return Number(a.tempoFinal) - Number(b.tempoFinal);
      }
      if (aFinished) return -1;
      if (bFinished) return 1;

      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

    const rows = sortedList.map(a => {
      const isFinished = a.statusParticipacao === 'ja_participou' && Number.isFinite(Number(a.tempoFinal));
      let posicaoStr = '—';
      if (isFinished) {
        const rankList = categoryRanks[`${a.modalidade}__${a.categoria}`] || [];
        const pos = rankList.findIndex(x => x.id === a.id) + 1;
        posicaoStr = pos > 0 ? `${pos}º` : '—';
      }

      return [
        posicaoStr,
        STATUS_LABELS[a.statusParticipacao] || a.statusParticipacao || 'Não participou',
        a.nome,
        a.turma,
        a.modalidade,
        a.categoria,
        isFinished && Number.isFinite(Number(a.tempoBase)) ? formatDecimalBR(a.tempoBase) : '—',
        isFinished && Number(a.bonus || 0) > 0 ? `-${formatDecimalBR(a.bonus)}` : (isFinished ? '0,00' : '—'),
        isFinished && Number(a.penalidade || 0) > 0 ? `+${formatDecimalBR(a.penalidade)}` : (isFinished ? '0,00' : '—'),
        isFinished ? formatDecimalBR(a.tempoFinal) : '—',
        a.dataRegistro ? new Date(a.dataRegistro).toLocaleString('pt-BR') : '—'
      ];
    });

    const csvContent = '\uFEFF' + [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    downloadFile(`poliedro-skills-backup-tabela-${new Date().toISOString().slice(0, 10)}.csv`, csvContent, 'text/csv;charset=utf-8');
  }
  function downloadFile(name, content, type) { const blob = new Blob([content], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); }
  ['btn-exportar-csv', 'btn-exportar-csv-hero'].forEach(id => $(id)?.addEventListener('click', exportCSV));
  $('btn-backup-json')?.addEventListener('click', () => downloadFile('backup-poliedro-skills.json', JSON.stringify(currentAtletas, null, 2), 'application/json'));
  $('input-restaurar-json')?.addEventListener('change', e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(reader.result); if (!Array.isArray(data)) throw new Error(); currentAtletas = data.map(normalizeAthlete); saveAtletas(currentAtletas); refreshAll(); alert('Backup restaurado com sucesso.'); } catch { alert('Arquivo de backup inválido.'); } }; reader.readAsText(file); e.target.value = ''; });

  let activePresentationId = null;
  let presentationTimer = null;
  let confettiFrame = null;

  function stopConfetti() {
    if (confettiFrame) cancelAnimationFrame(confettiFrame);
    confettiFrame = null;
    const canvas = $('confetti-canvas');
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function startConfetti(intensity = 150) {
    const canvas = $('confetti-canvas'); if (!canvas) return;
    stopConfetti();
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
    resize();
    const colors = ['#ffd54a', '#ffffff', '#6fa4ff', '#ff756f', '#76e3a1'];
    const pieces = Array.from({ length: Math.min(intensity, innerWidth < 800 ? 85 : intensity) }, () => ({
      x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .35, w: 5 + Math.random() * 8, h: 4 + Math.random() * 12,
      vx: -2 + Math.random() * 4, vy: 2.5 + Math.random() * 5, r: Math.random() * Math.PI, vr: -.15 + Math.random() * .3,
      color: colors[Math.floor(Math.random() * colors.length)], life: 180 + Math.random() * 100
    }));
    const draw = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      pieces.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .018; p.r += p.vr; p.life--; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); });
      if (pieces.some(p => p.life > 0 && p.y < innerHeight + 40)) confettiFrame = requestAnimationFrame(draw); else stopConfetti();
    };
    draw();
  }

  function hideResultPresentation() {
    const overlay = $('resultado-overlay');
    overlay?.classList.remove('active', 'podium-1', 'podium-2', 'podium-3');
    overlay?.setAttribute('aria-hidden', 'true');
    clearTimeout(presentationTimer); stopConfetti(); activePresentationId = null;
  }

  function showResultPresentation(p) {
    const overlay = $('resultado-overlay'); if (!overlay || !p?.athlete) return;
    if (activePresentationId === p.id) return;
    activePresentationId = p.id;
    const a = p.athlete;
    setText('resultado-nome', a.nome);
    setText('resultado-meta', `${a.turma} • ${a.categoria} • ${MODALIDADES_EMOJIS[a.modalidade] || ''} ${a.modalidade}`);
    setText('resultado-tempo-bruto', formatTime(Number(a.tempoBase || 0) * 1000));
    setText('resultado-bonus-total', `-${Number(a.bonus || 0).toFixed(2)}s`);
    setText('resultado-penalidades-total', `+${Number(a.penalidade || 0).toFixed(2)}s`);
    setText('resultado-equacao', `${Number(a.tempoBase || 0).toFixed(2)}s + ${Number(a.penalidade || 0).toFixed(2)}s − ${Number(a.bonus || 0).toFixed(2)}s`);
    setText('resultado-tempo-final', formatSeconds(a.tempoFinal));

    const bonusList = $('resultado-bonus-lista'), penaltyList = $('resultado-penalidades-lista');
    const row = (item, sign) => `<div class="resultado-detail-row"><span>${escapeHTML(item.nome)} <small>(${item.count} acerto${item.count === 1 ? '' : 's'})</small></span><strong>${sign}${Number(item.seconds).toFixed(2)}s</strong></div>`;
    if (bonusList) bonusList.innerHTML = p.breakdown?.bonusItems?.length ? p.breakdown.bonusItems.map(i => row(i, '−')).join('') : '<div class="resultado-empty-detail">Nenhum bônus registrado</div>';
    if (penaltyList) penaltyList.innerHTML = p.breakdown?.penaltyItems?.length ? p.breakdown.penaltyItems.map(i => row(i, '+')).join('') : '<div class="resultado-empty-detail">Nenhuma penalidade registrada</div>';

    let achievement = '';
    if (p.isNewRecord && p.position === 1) achievement = '🏆 NOVO LÍDER & ⚡ NOVO RECORDE!';
    else if (p.isNewRecord) achievement = '⚡ NOVO RECORDE DA CATEGORIA!';
    else if (p.position === 1) achievement = '🥇 NOVO LÍDER!';
    else if (p.position === 2) achievement = '🥈 VOCÊ ASSUMIU O 2º LUGAR!';
    else if (p.position === 3) achievement = '🥉 VOCÊ ENTROU NO PÓDIO!';
    else achievement = 'TENTATIVA CONCLUÍDA';
    setText('resultado-conquista', achievement);
    $('resultado-conquista')?.classList.toggle('record', Boolean(p.isNewRecord || p.enteredPodium));

    const chips = [`<span class="resultado-ranking-chip">Posição: <strong>${p.position}º lugar</strong></span>`];
    if (p.previousRecord !== null && p.isNewRecord) chips.push(`<span class="resultado-ranking-chip">Recorde anterior: <strong>${formatSeconds(p.previousRecord)}</strong></span>`);
    if (p.improvement) chips.push(`<span class="resultado-ranking-chip">Melhoria: <strong>${Number(p.improvement).toFixed(2)}s</strong></span>`);
    const rankingInfo = $('resultado-ranking-info');
    if (rankingInfo) rankingInfo.innerHTML = chips.join('');

    overlay.className = `resultado-overlay active${p.position <= 3 ? ` podium-${p.position}` : ''}`;
    overlay.setAttribute('aria-hidden', 'false');
    const remaining = Math.max(2500, Number(p.activeUntil || 0) - Date.now());
    const bar = $('resultado-progress-bar');
    if (bar) { bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)'; requestAnimationFrame(() => { requestAnimationFrame(() => { bar.style.transition = `transform ${remaining}ms linear`; bar.style.transform = 'scaleX(0)'; }); }); }
    if (p.isNewRecord || p.position <= 3) startConfetti(p.isNewRecord && p.position === 1 ? 220 : 150);
    clearTimeout(presentationTimer); presentationTimer = setTimeout(hideResultPresentation, remaining);
  }

  $('resultado-fechar')?.addEventListener('click', hideResultPresentation);

  function renderTelao() {
    const root = $('telao-root'); if (!root) return;
    const live = getLiveState();
    if (live.presentation?.activeUntil > Date.now()) showResultPresentation(live.presentation);
    else if (activePresentationId) hideResultPresentation();
    const modalidadeFiltro = $('telao-modalidade')?.value || 'Todas';
    let ranked = currentAtletas.filter(a => a.statusParticipacao === 'ja_participou' && Number.isFinite(Number(a.tempoFinal)));
    if (modalidadeFiltro !== 'Todas') ranked = ranked.filter(a => a.modalidade === modalidadeFiltro);
    ranked.sort((a, b) => Number(a.tempoFinal) - Number(b.tempoFinal));
    const athlete = live.athleteName ? live : null;
    const lastOfSport = [...currentAtletas].filter(a => a.statusParticipacao === 'ja_participou' && a.dataRegistro && Number.isFinite(Number(a.tempoFinal)) && (modalidadeFiltro === 'Todas' || a.modalidade === modalidadeFiltro)).sort((a, b) => new Date(b.dataRegistro) - new Date(a.dataRegistro))[0];
    const last = (live.lastResult && (modalidadeFiltro === 'Todas' || live.lastResult.modalidade === modalidadeFiltro)) ? live.lastResult : lastOfSport;
    setText('telao-atleta', athlete?.athleteName || 'Aguardando próximo atleta');
    setText('telao-atleta-meta', athlete ? `${athlete.turma} • ${athlete.categoria}` : 'Selecione o atleta no Painel do Árbitro');
    setText('telao-modalidade-live', athlete ? `${MODALIDADES_EMOJIS[athlete.modalidade] || ''} ${athlete.modalidade}` : 'Poliedro Skills');
    const telaoRoot = $('telao-root');
    if (telaoRoot) {
      const sportKey = athlete?.modalidade === 'Basquete' ? 'basquete' : athlete?.modalidade === 'Futsal' ? 'futebol' : athlete?.modalidade === 'Vôlei' ? 'volei' : 'geral';
      telaoRoot.classList.remove('telao-sport--basquete', 'telao-sport--futebol', 'telao-sport--volei', 'telao-sport--geral');
      telaoRoot.classList.add(`telao-sport--${sportKey}`);
      telaoRoot.dataset.sport = sportKey;
    }
    setText('telao-cronometro', formatTime(Number(athlete?.elapsedMs || 0)));
    setText('telao-status', athlete?.status === 'running' ? 'AO VIVO' : athlete?.status === 'paused' ? 'PAUSADO' : athlete?.status === 'finished' ? 'FINALIZADO' : 'AGUARDANDO');
    setText('telao-projecao', athlete ? formatSeconds(athlete.projectedFinal || 0) : '--');
    setText('telao-bonus', athlete ? `-${Number(athlete.bonus || 0).toFixed(1)}s` : '-0.0s');
    setText('telao-penalidade', athlete ? `+${Number(athlete.penalty || 0).toFixed(1)}s` : '+0.0s');
    setText('telao-ultimo-nome', last?.nome || 'Nenhum resultado');
    setText('telao-ultimo-tempo', last ? formatSeconds(last.tempoFinal) : '--');
    setText('telao-ultimo-meta', last ? `${last.modalidade} • ${last.categoria}` : '');
    const podium = $('telao-podium');
    if (podium) podium.innerHTML = ranked.slice(0, 3).map((a, i) => `<article class="telao-podium__item telao-podium__item--${i + 1}"><span class="telao-podium__place">${['🥇', '🥈', '🥉'][i]}</span><strong>${escapeHTML(a.nome)}</strong><small>${escapeHTML(a.turma)} • ${escapeHTML(a.modalidade)}</small><b>${formatSeconds(a.tempoFinal)}</b></article>`).join('') || '<div class="telao-empty">Aguardando resultados oficiais...</div>';
    setText('telao-recorde', ranked.length ? formatSeconds(ranked[0].tempoFinal) : '--');
    updateCompetitionCommand();
  }

  $('btn-tela-cheia')?.addEventListener('click', async () => {
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch (_) { }
  });
  $('telao-modalidade')?.addEventListener('change', renderTelao);
  function refreshAll() {
    currentAtletas = getAtletas();
    const q = $('painel-search-atleta')?.value || '';
    const sport = $('painel-sport-filter')?.value || 'todas';
    populateAtletaSelect(q, sport);
    renderRanking();
    updateStats();
    renderTelao();
    renderInscricoes();
    renderAdmin();
  }

  function syncCircuitosUpdate(newCircuits) {
    CIRCUITOS = newCircuits || loadCircuitos();
    const currentMod = atletaSelect?.selectedOptions?.[0]?.dataset?.modalidade;
    if (currentMod) updateEstacoesGrid(currentMod);
    renderCircuitosPage();
  }

  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) refreshAll();
    if (e.key === LIVE_STATE_KEY) renderTelao();
    if (e.key === CIRCUITS_STORAGE_KEY) syncCircuitosUpdate();
  });
  liveChannel && (liveChannel.onmessage = e => {
    if (e.data?.type === 'refresh') refreshAll();
    if (e.data?.type === 'live-state') renderTelao();
    if (e.data?.type === 'circuits-updated') syncCircuitosUpdate(e.data.circuitos);
  });





  // ===== V4.4 — Central de inscrições prévias =====
  const STATUS_LABELS = {
    nao_participou: 'Não participou', em_andamento: 'Em andamento', ja_participou: 'Já participou',
    ausente: 'Ausente', desclassificado: 'Desclassificado'
  };

  function renderInscricoes() {
    const body = $('inscricoes-table-body'); if (!body) return;
    const statusFilter = $('inscricoes-status-filter')?.value || 'todos';
    const sportFilter = $('inscricoes-sport-filter')?.value || 'todos';
    const query = ($('inscricoes-search')?.value || '').trim().toLowerCase();
    let list = [...currentAtletas];
    if (statusFilter !== 'todos') list = list.filter(a => a.statusParticipacao === statusFilter);
    if (sportFilter !== 'todos') list = list.filter(a => a.modalidade === sportFilter);
    if (query) list = list.filter(a => `${a.nome} ${a.turma} ${a.categoria}`.toLowerCase().includes(query));
    list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    body.innerHTML = list.map(a => `<tr>
      <td><strong>${escapeHTML(a.nome)}</strong><br><small>${escapeHTML(a.turma)}</small></td>
      <td>${escapeHTML(a.categoria)}</td><td>${MODALIDADES_EMOJIS[a.modalidade] || ''} ${escapeHTML(a.modalidade)}</td>
      <td><span class="participation-status participation-status--${a.statusParticipacao}">${STATUS_LABELS[a.statusParticipacao]}</span></td>
      <td>${a.statusParticipacao === 'ja_participou' ? formatSeconds(a.tempoFinal) : '—'}</td>
      <td class="inscricoes-actions">
        <select data-status-id="${a.id}" aria-label="Alterar status de ${escapeHTML(a.nome)}">
          ${Object.entries(STATUS_LABELS).map(([key, label]) => `<option value="${key}" ${key === a.statusParticipacao ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <button type="button" class="btn-icon" data-edit-id="${a.id}" title="Editar inscrição">✏️</button>
        <button type="button" class="btn-icon" data-reopen-id="${a.id}" title="Reabrir participação">↺</button>
        <button type="button" class="btn-icon btn-icon--danger" data-delete-id="${a.id}" title="Excluir inscrição">🗑</button>
      </td></tr>`).join('');
    $('inscricoes-empty')?.classList.toggle('hidden', Boolean(list.length));
    const counts = Object.fromEntries(Object.keys(STATUS_LABELS).map(k => [k, currentAtletas.filter(a => a.statusParticipacao === k).length]));
    setText('inscricoes-total', currentAtletas.length);
    setText('inscricoes-pendentes', counts.nao_participou || 0);
    setText('inscricoes-andamento', counts.em_andamento || 0);
    setText('inscricoes-finalizados', counts.ja_participou || 0);
    setText('inscricoes-ausentes', counts.ausente || 0);
  }

  function resetParticipation(a) {
    a.statusParticipacao = 'nao_participou';
    a.tempoBase = null;
    a.bonus = 0;
    a.penalidade = 0;
    a.tempoFinal = null;
    a.dataRegistro = null;
    a.detalhes = {};
    delete a.posicao;
    delete a.novoRecorde;
    delete a.recordeAnterior;
  }

  function deleteAthlete(id) {
    const a = currentAtletas.find(x => x.id === id);
    if (!a) return false;
    currentAtletas = currentAtletas.filter(x => x.id !== a.id);
    saveAtletas(currentAtletas);
    const live = getLiveState();
    if (live.athleteId === a.id) {
      saveLiveState({
        athleteId: null,
        athleteName: null,
        status: 'ready',
        elapsedMs: 0,
        bonus: 0,
        penalty: 0,
        projectedFinal: 0
      });
    }
    refreshAll();
    return true;
  }

  $('inscricoes-table-body')?.addEventListener('change', e => {
    const select = e.target.closest('[data-status-id]'); if (!select) return;
    const a = currentAtletas.find(x => x.id === select.dataset.statusId); if (!a) return;
    if (select.value === 'nao_participou') resetParticipation(a);
    else a.statusParticipacao = select.value;
    saveAtletas(currentAtletas); refreshAll(); renderInscricoes();
  });
  $('inscricoes-table-body')?.addEventListener('click', e => {
    const edit = e.target.closest('[data-edit-id]');
    const reopen = e.target.closest('[data-reopen-id]');
    const del = e.target.closest('[data-delete-id]');
    if (edit) {
      const a = currentAtletas.find(x => x.id === edit.dataset.editId);
      if (a) openModal(a);
    }
    if (reopen) {
      const a = currentAtletas.find(x => x.id === reopen.dataset.reopenId);
      if (a && confirm(`Reabrir a participação de ${a.nome}?`)) {
        resetParticipation(a);
        saveAtletas(currentAtletas);
        refreshAll();
        renderInscricoes();
      }
    }
    if (del) {
      const a = currentAtletas.find(x => x.id === del.dataset.deleteId);
      if (a && confirm(`Excluir a inscrição de ${a.nome}?`)) {
        deleteAthlete(a.id);
        renderInscricoes();
      }
    }
  });
  ['inscricoes-status-filter', 'inscricoes-sport-filter'].forEach(id => $(id)?.addEventListener('change', renderInscricoes));
  $('inscricoes-search')?.addEventListener('input', debounce(renderInscricoes));
  $('btn-nova-inscricao')?.addEventListener('click', openModal);

  ['input-importar-csv', 'admin-import-csv'].forEach(id => $(id)?.addEventListener('change', e => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rawContent = String(reader.result || '').replace(/^\uFEFF/, '').trim();
        const lines = rawContent.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) throw new Error('O arquivo CSV está vazio ou contém apenas o cabeçalho.');
        const sep = lines[0].includes(';') ? ';' : (lines[0].includes('\t') ? '\t' : ',');
        const rawHeaders = lines[0].split(sep).map(x => x.trim().toLowerCase().replace(/^"|"$/g, ''));

        const headerMap = {};
        rawHeaders.forEach((h, idx) => {
          if (h.includes('nome') || h === 'atleta' || h === 'aluno' || h === 'estudante') headerMap.nome = idx;
          else if (h.includes('turma') || h === 'sala' || h === 'serie' || h === 'série' || h === 'classe') headerMap.turma = idx;
          else if (h.includes('categoria') || h === 'cat' || h === 'categ') headerMap.categoria = idx;
          else if (h.includes('modalidade') || h === 'esporte' || h === 'mod') headerMap.modalidade = idx;
          else if (h.includes('status') || h.includes('situa') || h.includes('partic')) headerMap.status = idx;
          else if (h.includes('tempo final') || h.includes('tempo líquido') || h.includes('tempo liquido')) headerMap.tempoFinal = idx;
          else if (h.includes('tempo cronometrado') || h.includes('tempo base')) headerMap.tempoBase = idx;
          else if (h.includes('bônus') || h.includes('bonus')) headerMap.bonus = idx;
          else if (h.includes('penalidade')) headerMap.penalidade = idx;
          else if (h.includes('data')) headerMap.dataRegistro = idx;
        });

        const missing = ['nome', 'turma', 'categoria', 'modalidade'].filter(k => headerMap[k] === undefined);
        if (missing.length > 0) {
          throw new Error(`Cabeçalhos obrigatórios não encontrados: ${missing.join(', ')}. Cabeçalhos aceitos: Nome (ou Atleta), Turma, Categoria, Modalidade.`);
        }

        let added = 0;
        let duplicates = 0;
        let skippedInvalid = 0;

        const parseNum = (val) => {
          if (!val || val === '—' || val === '-') return null;
          const clean = String(val).replace(',', '.').replace(/[^\d.-]/g, '');
          const n = Number(clean);
          return Number.isFinite(n) ? Math.max(0, n) : null;
        };

        lines.slice(1).forEach(line => {
          const cols = line.split(sep).map(x => x.trim().replace(/^"|"$/g, ''));
          const nome = String(cols[headerMap.nome] || '').trim();
          const turma = String(cols[headerMap.turma] || '').trim();
          const categoria = normalizeCategoria(cols[headerMap.categoria]);
          const modalidade = normalizeModalidade(cols[headerMap.modalidade]);

          if (!nome || !turma || !categoria || !modalidade) {
            skippedInvalid++;
            return;
          }

          if (isDuplicateAthlete(nome, turma, modalidade)) {
            duplicates++;
            return;
          }

          let statusParticipacao = 'nao_participou';
          if (headerMap.status !== undefined) {
            const rawStatus = String(cols[headerMap.status] || '').toLowerCase().trim();
            if (rawStatus.includes('ja') || rawStatus.includes('já') || rawStatus.includes('conclu')) statusParticipacao = 'ja_participou';
            else if (rawStatus.includes('andamento')) statusParticipacao = 'em_andamento';
            else if (rawStatus.includes('ausente')) statusParticipacao = 'ausente';
            else if (rawStatus.includes('desclass')) statusParticipacao = 'desclassificado';
          }

          const tempoBase = headerMap.tempoBase !== undefined ? parseNum(cols[headerMap.tempoBase]) : null;
          const bonus = headerMap.bonus !== undefined ? (parseNum(cols[headerMap.bonus]) || 0) : 0;
          const penalidade = headerMap.penalidade !== undefined ? (parseNum(cols[headerMap.penalidade]) || 0) : 0;
          const tempoFinal = headerMap.tempoFinal !== undefined ? parseNum(cols[headerMap.tempoFinal]) : (tempoBase !== null ? Math.max(0, Number((tempoBase + penalidade - bonus).toFixed(2))) : null);

          if (tempoFinal !== null && statusParticipacao === 'nao_participou') {
            statusParticipacao = 'ja_participou';
          }

          const rawData = headerMap.dataRegistro !== undefined ? cols[headerMap.dataRegistro] : '';
          const dataRegistro = rawData && rawData !== '—' && rawData !== '-' ? rawData : (statusParticipacao === 'ja_participou' ? new Date().toISOString() : null);

          currentAtletas.push(normalizeAthlete({
            id: generateId(),
            nome,
            turma,
            categoria,
            modalidade,
            statusParticipacao,
            tempoBase,
            bonus,
            penalidade,
            tempoFinal,
            dataRegistro,
            detalhes: {}
          }));
          added++;
        });

        saveAtletas(currentAtletas);
        refreshAll();
        renderInscricoes();
        renderAdmin();

        let msg = `${added} inscrição(ões) importada(s) com sucesso.`;
        if (duplicates > 0) msg += `\n${duplicates} cadastro(s) duplicado(s) foram ignorados.`;
        if (skippedInvalid > 0) msg += `\n${skippedInvalid} linha(s) com dados incompletos foram ignoradas.`;
        alert(msg);
      } catch (err) {
        alert(err.message || 'CSV inválido.');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }));

  renderInscricoes();

  // ===== V4.5 — Área administrativa interna =====
  function adminOpenModal(athlete = null) {
    const modal = $('admin-modal'); if (!modal) return;
    $('admin-modal-title').textContent = athlete ? 'Editar aluno' : 'Cadastrar aluno';
    $('admin-edit-id').value = athlete?.id || '';
    $('admin-nome').value = athlete?.nome || '';
    $('admin-turma').value = athlete?.turma || '';
    $('admin-categoria').value = athlete?.categoria || '';
    $('admin-modalidade').value = athlete?.modalidade || '';
    $('admin-status-edit').value = athlete?.statusParticipacao || 'nao_participou';
    modal.classList.add('active'); document.body.style.overflow = 'hidden';
  }
  function adminCloseModal() { $('admin-modal')?.classList.remove('active'); document.body.style.overflow = ''; $('admin-form')?.reset(); if ($('admin-edit-id')) $('admin-edit-id').value = ''; }

  // ===== Certificado de Participação e Desempenho (A4 paisagem) =====
  function buildCertificadoHTML(aluno) {
    const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
    const seg = v => num(v) === null ? '-' : `${num(v).toFixed(2).replace('.', ',')}s`;
    const txt = v => escapeHTML(v === null || v === undefined || String(v).trim() === '' ? '-' : v);
    const { bonusItems, penaltyItems } = getBreakdown(aluno.modalidade, aluno.detalhes || {});
    const qtdAcertos = bonusItems.reduce((s, i) => s + i.count, 0);
    const qtdPenal = penaltyItems.reduce((s, i) => s + i.count, 0);
    const grupo = currentAtletas
      .filter(a => a.statusParticipacao === 'ja_participou' && a.modalidade === aluno.modalidade && a.categoria === aluno.categoria && num(a.tempoFinal) !== null)
      .sort((a, b) => Number(a.tempoFinal) - Number(b.tempoFinal));
    const pos = grupo.findIndex(a => a.id === aluno.id) + 1;
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const dataProva = aluno.dataRegistro ? new Date(aluno.dataRegistro).toLocaleDateString('pt-BR') : '-';
    const codigo = `PS-${String(aluno.id || '').slice(-6).toUpperCase() || '000000'}-${new Date().getFullYear()}`;

    return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Certificado — ${escapeHTML(aluno.nome)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { width: 297mm; height: 210mm; background: #fff; font-family: 'Inter', Arial, sans-serif; color: #02142f; }
  .sheet { width: 297mm; height: 210mm; padding: 10mm; display: flex; align-items: center; justify-content: center;
           background: linear-gradient(135deg, #02142f 0%, #0a2a5c 100%); }
  .frame { position: relative; width: 277mm; height: 190mm; background: #fff; border: 1.2mm solid #ff7a00;
           outline: .4mm solid #fff; outline-offset: -3mm; padding: 12mm 18mm 10mm; display: flex; flex-direction: column; }
  .frame::before { content: ''; position: absolute; inset: 3.4mm; border: .35mm solid #02142f; pointer-events: none; }
  .corner { position: absolute; width: 16mm; height: 16mm; border-color: #ff7a00; border-style: solid; }
  .c-tl { top: 6mm; left: 6mm; border-width: 1.2mm 0 0 1.2mm; } .c-tr { top: 6mm; right: 6mm; border-width: 1.2mm 1.2mm 0 0; }
  .c-bl { bottom: 6mm; left: 6mm; border-width: 0 0 1.2mm 1.2mm; } .c-br { bottom: 6mm; right: 6mm; border-width: 0 1.2mm 1.2mm 0; }
  .watermark { position: absolute; right: 14mm; top: 50%; transform: translateY(-50%); font: 800 120mm/1 'Plus Jakarta Sans', sans-serif; color: rgba(2,20,47,.035); pointer-events: none; }
  header { text-align: center; }
  .brand { font: 800 9mm/1 'Plus Jakarta Sans', sans-serif; letter-spacing: .6mm; color: #02142f; }
  .brand span { color: #ff7a00; }
  .kicker { margin-top: 2.5mm; font: 600 3.4mm/1.2 'Inter', sans-serif; letter-spacing: 1.2mm; text-transform: uppercase; color: #ff7a00; }
  .rule { width: 60mm; height: .8mm; background: #ff7a00; margin: 4mm auto 0; border-radius: 1mm; }
  .intro { margin-top: 7mm; text-align: center; font-size: 4mm; color: #3b4a63; }
  .name { margin-top: 3mm; text-align: center; font: 800 12mm/1.1 'Plus Jakarta Sans', sans-serif; color: #02142f; }
  .desc { margin: 4mm auto 0; max-width: 210mm; text-align: center; font-size: 3.9mm; line-height: 1.55; color: #3b4a63; }
  .desc strong { color: #02142f; }
  .stats { margin: 7mm auto 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; width: 220mm; }
  .stat { border: .35mm solid #d6dce6; border-top: 1.2mm solid #02142f; border-radius: 2mm; padding: 3.5mm 3mm; text-align: center; background: #f6f8fb; }
  .stat--main { border-top-color: #ff7a00; background: #fff6ee; }
  .stat small { display: block; font: 600 2.7mm/1.2 'Inter', sans-serif; letter-spacing: .4mm; text-transform: uppercase; color: #5b6b84; }
  .stat b { display: block; margin-top: 1.8mm; font: 700 7mm/1 'JetBrains Mono', monospace; color: #02142f; }
  .stat--main b { color: #ff7a00; }
  .stat em { display: block; margin-top: 1.2mm; font-style: normal; font-size: 2.8mm; color: #5b6b84; }
  footer { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 10mm; }
  .sign { width: 95mm; text-align: center; }
  .sign .line { border-top: .35mm solid #02142f; margin-bottom: 2mm; }
  .sign b { display: block; font-size: 3.4mm; color: #02142f; } .sign span { font-size: 3mm; color: #5b6b84; }
  .meta { font-size: 2.8mm; color: #5b6b84; line-height: 1.6; } .meta--right { text-align: right; }
  .meta code { font-family: 'JetBrains Mono', monospace; color: #02142f; }
  @media screen { body { background: #4b5563; } html, body { width: auto; height: auto; } .sheet { margin: 10mm auto; box-shadow: 0 10px 40px rgba(0,0,0,.4); } }
</style></head>
<body><main class="sheet"><section class="frame">
  <i class="corner c-tl"></i><i class="corner c-tr"></i><i class="corner c-bl"></i><i class="corner c-br"></i>
  <div class="watermark">⚡</div>
  <header>
    <div class="brand">POLIEDRO <span>SKILLS</span></div>
    <div class="kicker">Certificado de Participação e Desempenho</div>
    <div class="rule"></div>
  </header>
  <p class="intro">Certificamos que</p>
  <h1 class="name">${txt(aluno.nome)}</h1>
  <p class="desc">da turma <strong>${txt(aluno.turma)}</strong>, categoria <strong>${txt(aluno.categoria)}</strong>, concluiu o
     <strong>Circuito Oficial de Habilidades Esportivas de ${txt(aluno.modalidade)}</strong> do Colégio Poliedro,
     demonstrando dedicação, técnica e espírito esportivo.</p>
  <div class="stats">
    <div class="stat stat--main"><small>Tempo final oficial</small><b>${seg(aluno.tempoFinal)}</b><em>${pos ? `${pos}º lugar de ${grupo.length} na categoria` : 'Resultado oficial'}</em></div>
    <div class="stat"><small>Tempo cronometrado</small><b>${seg(aluno.tempoBase)}</b><em>Prova em ${escapeHTML(dataProva)}</em></div>
    <div class="stat"><small>Acertos / Bônus</small><b>${qtdAcertos}</b><em>−${seg(aluno.bonus ?? 0)} no tempo</em></div>
    <div class="stat"><small>Penalidades</small><b>${qtdPenal}</b><em>+${seg(aluno.penalidade ?? 0)} no tempo</em></div>
  </div>
  <footer>
    <div class="meta">Emitido em ${escapeHTML(hoje)}<br>Código: <code>${escapeHTML(codigo)}</code></div>
    <div class="sign"><div class="line"></div><b>Coordenação de Educação Física</b><span>Colégio Poliedro</span></div>
    <div class="meta meta--right">Poliedro Skills<br>Circuito Oficial de Habilidades</div>
  </footer>
</section></main>
<script>
  window.addEventListener('afterprint', () => window.close());
  window.addEventListener('load', () => {
    const go = () => setTimeout(() => window.print(), 150);
    (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]) : Promise.resolve()).then(go);
  });
<\/script>
</body></html>`;
  }

  function imprimirCertificado(aluno) {
    if (!aluno || aluno.statusParticipacao !== 'ja_participou') {
      alert('O certificado só pode ser emitido para alunos com status "Já participou".');
      return;
    }
    const win = window.open('', '_blank', 'width=1123,height=794');
    if (!win) { alert('O navegador bloqueou a janela do certificado. Permita pop-ups para este site e tente novamente.'); return; }
    win.document.open();
    win.document.write(buildCertificadoHTML(aluno));
    win.document.close();
  }
  window.imprimirCertificado = imprimirCertificado;

  function renderAdmin() {
    const body = $('admin-table-body'); if (!body) return;
    const q = ($('admin-search')?.value || '').trim().toLowerCase();
    const sport = $('admin-sport')?.value || 'todos';
    const status = $('admin-status')?.value || 'todos';
    let list = [...currentAtletas];
    if (q) list = list.filter(a => `${a.nome} ${a.turma} ${a.categoria}`.toLowerCase().includes(q));
    if (sport !== 'todos') list = list.filter(a => a.modalidade === sport);
    if (status !== 'todos') list = list.filter(a => a.statusParticipacao === status);
    list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    body.innerHTML = list.map(a => `<tr><td><strong>${escapeHTML(a.nome)}</strong><br><small>${escapeHTML(a.turma)}</small></td><td>${escapeHTML(a.categoria)}</td><td>${MODALIDADES_EMOJIS[a.modalidade] || ''} ${escapeHTML(a.modalidade)}</td><td><span class="participation-status participation-status--${a.statusParticipacao}">${STATUS_LABELS[a.statusParticipacao] || a.statusParticipacao}</span></td><td>${a.statusParticipacao === 'ja_participou' ? formatSeconds(a.tempoFinal) : '—'}</td><td class="admin-actions"><button class="btn-icon" data-admin-edit="${a.id}" title="Editar">✏️</button><button class="btn-icon" data-admin-cert="${a.id}" title="${a.statusParticipacao === 'ja_participou' ? 'Imprimir certificado' : 'Disponível após o registro do resultado'}" ${a.statusParticipacao === 'ja_participou' ? '' : 'disabled aria-disabled="true" style="opacity:.35;cursor:not-allowed;"'}>🎓</button><button class="btn-icon" data-admin-reopen="${a.id}" title="Reabrir tentativa">↺</button><button class="btn-icon btn-icon--danger" data-admin-delete="${a.id}" title="Excluir">🗑</button></td></tr>`).join('');
    $('admin-empty')?.classList.toggle('hidden', Boolean(list.length));
    setText('admin-total', currentAtletas.length);
    setText('admin-pendentes', currentAtletas.filter(a => ['nao_participou', 'em_andamento'].includes(a.statusParticipacao)).length);
    setText('admin-participaram', currentAtletas.filter(a => a.statusParticipacao === 'ja_participou').length);
    const activeRecords = new Set(
      currentAtletas
        .filter(a => a.statusParticipacao === 'ja_participou' && Number.isFinite(Number(a.tempoFinal)))
        .map(a => `${a.modalidade}__${a.categoria}`)
    ).size;
    setText('admin-recordes', activeRecords);
  }

  $('admin-btn-novo')?.addEventListener('click', () => adminOpenModal());
  $('admin-modal-close')?.addEventListener('click', adminCloseModal);
  $('admin-modal')?.addEventListener('click', e => { if (e.target === $('admin-modal')) adminCloseModal(); });
  $('admin-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = $('admin-edit-id').value;
    const nome = $('admin-nome').value.trim();
    const turma = $('admin-turma').value.trim();
    const categoria = normalizeCategoria($('admin-categoria').value);
    const modalidade = normalizeModalidade($('admin-modalidade').value);
    const statusParticipacao = $('admin-status-edit').value;
    const data = { nome, turma, categoria, modalidade, statusParticipacao };
    if (!data.nome || !data.turma || !data.categoria || !data.modalidade) return alert('Preencha todos os campos.');

    if (id) {
      const a = currentAtletas.find(x => x.id === id);
      if (!a) return;
      if (isDuplicateAthlete(nome, turma, modalidade, id)) {
        return alert(`Já existe outro cadastro de "${nome}" (${turma}) em ${modalidade}.`);
      }
      if ((a.modalidade !== modalidade || a.categoria !== categoria) && a.tempoFinal !== null) {
        if (!confirm('A modalidade ou categoria foi alterada para um aluno que já possui tempo registrado. Isso redefinirá a tentativa para "Não participou". Deseja continuar?')) {
          return;
        }
        resetParticipation(a);
      }
      Object.assign(a, data);
      if (data.statusParticipacao === 'nao_participou') resetParticipation(a);
    } else {
      if (isDuplicateAthlete(nome, turma, modalidade)) {
        return alert(`O aluno "${nome}" (${turma}) já está cadastrado em ${modalidade}.`);
      }
      currentAtletas.push(normalizeAthlete({ id: generateId(), ...data, tempoBase: null, bonus: 0, penalidade: 0, tempoFinal: null, dataRegistro: null, detalhes: {} }));
    }
    saveAtletas(currentAtletas); adminCloseModal(); refreshAll(); renderAdmin();
  });
  $('admin-table-body')?.addEventListener('click', e => {
    const cert = e.target.closest('[data-admin-cert]');
    if (cert) { const a = currentAtletas.find(x => x.id === cert.dataset.adminCert); if (a) imprimirCertificado(a); return; }
    const edit = e.target.closest('[data-admin-edit]'); const reopen = e.target.closest('[data-admin-reopen]'); const del = e.target.closest('[data-admin-delete]');
    if (edit) { const a = currentAtletas.find(x => x.id === edit.dataset.adminEdit); if (a) adminOpenModal(a); }
    if (reopen) { const a = currentAtletas.find(x => x.id === reopen.dataset.adminReopen); if (a && confirm(`Reabrir a tentativa de ${a.nome}?`)) { resetParticipation(a); saveAtletas(currentAtletas); refreshAll(); renderAdmin(); } }
    if (del) { const a = currentAtletas.find(x => x.id === del.dataset.adminDelete); if (a && confirm(`Excluir permanentemente ${a.nome}?`)) { deleteAthlete(a.id); renderAdmin(); } }
  });
  ['admin-sport', 'admin-status'].forEach(id => $(id)?.addEventListener('change', renderAdmin));
  $('admin-search')?.addEventListener('input', debounce(renderAdmin));
  const buildBackupData = () => ({
    sistema: 'Poliedro Skills',
    versao: '4.20',
    dataExportacao: new Date().toISOString(),
    totalAtletas: currentAtletas.length,
    atletas: currentAtletas,
    circuitos: CIRCUITOS
  });
  ['admin-backup', 'admin-hero-backup'].forEach(id => $(id)?.addEventListener('click', () => {
    const backupData = buildBackupData();
    downloadFile(`backup-poliedro-skills-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backupData, null, 2), 'application/json');
  }));

  // ===== Backup na nuvem (Supabase) — envio manual, somente inserção =====
  const CLOUD_BACKUP_KEY = 'poliedroskills_ultimo_backup_nuvem';
  const renderCloudStatus = () => {
    const el = $('admin-cloud-status');
    if (!el) return;
    const last = localStorage.getItem(CLOUD_BACKUP_KEY);
    el.textContent = last ? `Último backup na nuvem: ${new Date(last).toLocaleString('pt-BR')}` : 'Nenhum backup enviado para a nuvem ainda.';
  };
  renderCloudStatus();
  $('admin-cloud-backup')?.addEventListener('click', async e => {
    const btn = e.currentTarget;
    const cfg = window.POLIEDRO_SUPABASE || {};
    if (!cfg.url || !cfg.anonKey) { alert('Backup na nuvem não configurado. Preencha supabase-config.js com a URL e a anon key do projeto Supabase.'); return; }
    if (!navigator.onLine) { alert('Sem conexão com a internet. Use "Baixar backup JSON" para salvar localmente.'); return; }
    const data = buildBackupData();
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = '⏳ Enviando...';
    try {
      const res = await fetch(`${cfg.url.replace(/\/$/, '')}/rest/v1/backups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, Prefer: 'return=minimal' },
        body: JSON.stringify({ versao: data.versao, origem: cfg.origem || null, total_atletas: data.totalAtletas, payload: data })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      localStorage.setItem(CLOUD_BACKUP_KEY, new Date().toISOString());
      renderCloudStatus();
      alert('Backup enviado para a nuvem com sucesso.');
    } catch (err) {
      console.error('Falha no backup na nuvem:', err);
      alert('Não foi possível enviar o backup para a nuvem. Use "Baixar backup JSON" como alternativa.');
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
  ['admin-export-csv', 'admin-hero-export'].forEach(id => $(id)?.addEventListener('click', exportCSV));
  $('admin-restore')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const athleteList = Array.isArray(data) ? data : (Array.isArray(data?.atletas) ? data.atletas : null);
        if (!athleteList) throw new Error();
        currentAtletas = athleteList.map(normalizeAthlete);
        if (data?.circuitos && typeof data.circuitos === 'object') {
          saveCircuitos(data.circuitos);
        }
        saveAtletas(currentAtletas);
        refreshAll();
        renderAdmin();
        alert('Backup restaurado com sucesso.');
      } catch {
        alert('Arquivo de backup inválido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
  $('admin-clear-results')?.addEventListener('click', () => {
    if (!confirm('Limpar todos os resultados e manter os cadastros?')) return;
    currentAtletas.forEach(resetParticipation);
    saveAtletas(currentAtletas);
    try {
      localStorage.removeItem(LIVE_STATE_KEY);
      liveChannel?.postMessage({ type: 'live-state', state: {} });
    } catch (_) { }
    refreshAll();
    renderAdmin();
    alert('Resultados removidos. Todos os alunos voltaram para Não participou.');
  });
  renderAdmin();

  // ===== CONFIGURADOR DINÂMICO DE CIRCUITOS =====
  let activeEditorSport = 'Basquete';
  let editorCircuits = JSON.parse(JSON.stringify(CIRCUITOS));

  function syncEditorFromActiveInputs() {
    const list = $('circuit-stations-list');
    if (!list) return;
    const cards = list.querySelectorAll('.station-edit-card');
    const updated = [];
    cards.forEach((card, idx) => {
      const nome = card.querySelector('.station-input-name')?.value.trim() || `Estação ${idx + 1}`;
      const icon = card.querySelector('.station-input-icon')?.value.trim() || '⚡';
      const impact = card.querySelector('.station-input-impact')?.value || 'bonus';
      const format = card.querySelector('.station-input-format')?.value || 'attempts';
      const unit = Math.max(0.5, Number(card.querySelector('.station-input-unit')?.value) || 2);
      const attempts = format === 'attempts' ? Math.max(1, Number(card.querySelector('.station-input-attempts')?.value) || 5) : 1;
      const labelOrItem = card.querySelector('.station-input-item')?.value.trim() || (impact === 'penalty' ? 'Erro' : 'Acerto');
      const desc = card.querySelector('.station-input-desc')?.value.trim() || '';

      const station = {
        nome,
        icon,
        desc,
        unit,
        type: impact === 'penalty' ? (format === 'standard' ? 'standard' : 'penalty') : (format === 'standard' ? 'standard' : 'attempts'),
        impact
      };

      if (impact === 'penalty') {
        station.attempts = format === 'standard' ? 1 : attempts;
        station.label = labelOrItem;
      } else if (format === 'standard') {
        station.bonus = unit;
      } else {
        station.attempts = attempts;
        station.item = labelOrItem;
      }

      updated.push(station);
    });

    editorCircuits[activeEditorSport] = updated;
  }

  function renderCircuitEditor() {
    const container = $('circuit-stations-list');
    if (!container) return;

    // Atualiza botões de modalidade ativa
    document.querySelectorAll('.circuit-sport-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sport === activeEditorSport);
    });

    const stations = editorCircuits[activeEditorSport] || [];

    // Renderiza indicadores/resumo
    const metaContainer = $('circuit-editor-meta');
    if (metaContainer) {
      let maxBonus = 0;
      let maxPenalty = 0;
      stations.forEach(st => {
        const isPenalty = st.type === 'penalty' || st.impact === 'penalty';
        const unit = Number(st.unit || st.bonus || 2);
        const count = st.attempts && st.type !== 'standard' ? Number(st.attempts) : 1;
        if (isPenalty) maxPenalty += count * unit;
        else maxBonus += count * unit;
      });

      metaContainer.innerHTML = `
        <span class="circuit-meta-badge">📍 <strong>${stations.length}</strong> estações configuradas</span>
        <span class="circuit-meta-badge circuit-meta-badge--bonus">🟢 Até <strong>-${maxBonus}s</strong> de bônus</span>
        <span class="circuit-meta-badge circuit-meta-badge--penalty">🔴 Até <strong>+${maxPenalty}s</strong> de penalidades</span>
      `;
    }

    // Renderiza cards de cada estação
    container.innerHTML = stations.map((st, idx) => {
      const isPenalty = st.type === 'penalty' || st.impact === 'penalty';
      const hasAttempts = Boolean(st.attempts && Number(st.attempts) > 1 && st.type !== 'standard');
      const unit = Number(st.unit || st.bonus || 2);
      const itemLabel = st.item || st.label || (isPenalty ? 'Erro' : 'Acerto');

      return `
        <div class="station-edit-card" data-index="${idx}">
          <div class="station-edit-card__head">
            <div class="station-edit-card__num">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;background:var(--poliedro-blue);color:#fff;border-radius:50%;font-size:0.8rem;font-weight:800;">${idx + 1}</span>
              <strong class="station-preview-title">${escapeHTML(st.nome || 'Nova Estação')}</strong>
              <span class="station-type-tag" style="font-size:0.75rem; padding: 3px 8px; border-radius: 6px; font-weight:700; ${isPenalty ? 'background:#fef2f2; color:#b42318; border:1px solid #fecaca;' : 'background:#ecfdf5; color:#067647; border:1px solid #a7f3d0;'}">
                ${isPenalty ? '🔴 Penalidade (+s)' : '🟢 Bônus (-s)'}
              </span>
            </div>
            <button type="button" class="btn-icon btn-icon--danger" data-remove-station="${idx}" title="Excluir Estação">🗑</button>
          </div>

          <div class="station-edit-grid">
            <div class="form-group">
              <label>Nome da Estação</label>
              <input type="text" class="station-input-name" value="${escapeHTML(st.nome)}" placeholder="Nome da estação">
            </div>

            <div class="form-group">
              <label>Tipo de Pontuação</label>
              <select class="station-input-impact">
                <option value="bonus" ${!isPenalty ? 'selected' : ''}>🟢 Bônus (- segundos)</option>
                <option value="penalty" ${isPenalty ? 'selected' : ''}>🔴 Penalidade (+ segundos)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Formato de Avaliação</label>
              <select class="station-input-format">
                <option value="standard" ${!hasAttempts ? 'selected' : ''}>1 Ativação (Sim / Não)</option>
                <option value="attempts" ${hasAttempts ? 'selected' : ''}>Tentativas / Repetições</option>
              </select>
            </div>

            <div class="form-group">
              <label>Tempo (s)</label>
              <div class="input-suffix-wrapper">
                <input type="number" class="station-input-unit" value="${unit}" min="0.5" max="30" step="0.5">
                <span>seg</span>
              </div>
            </div>

            <div class="form-group station-field-attempts" style="${!hasAttempts ? 'opacity:0.4; pointer-events:none;' : ''}">
              <label>Tentativas</label>
              <input type="number" class="station-input-attempts" value="${st.attempts || 5}" min="1" max="25" ${!hasAttempts ? 'disabled' : ''}>
            </div>

            <div class="form-group station-field-item" style="${!hasAttempts ? 'opacity:0.4; pointer-events:none;' : ''}">
              <label>Rótulo</label>
              <input type="text" class="station-input-item" value="${escapeHTML(itemLabel)}" placeholder="Ex: Passe, Cesta" ${!hasAttempts ? 'disabled' : ''}>
            </div>
          </div>

          <div class="station-edit-extra" style="margin-top: 12px; display: flex; gap: 12px; align-items: center;">
            <div style="flex: 1;">
              <input type="text" class="station-input-desc" value="${escapeHTML(st.desc || '')}" placeholder="Breve explicação da estação para o regulamento e atletas" style="width: 100%; border: 1px solid var(--border-color); border-radius: 8px; padding: 8px 12px; font-size: 0.85rem; background:#fff;">
            </div>
            <div style="width: 70px;">
              <input type="text" class="station-input-icon" value="${escapeHTML(st.icon || '⚡')}" title="Emoji" maxlength="4" style="width: 100%; text-align: center; border: 1px solid var(--border-color); border-radius: 8px; padding: 8px 12px; font-size: 0.85rem; background:#fff;">
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Alternância de abas na Administração (Alunos vs Circuitos)
  $('tab-btn-alunos')?.addEventListener('click', () => {
    $('tab-btn-alunos')?.classList.add('active');
    $('tab-btn-circuitos')?.classList.remove('active');
    $('admin-view-alunos')?.classList.remove('hidden');
    $('admin-view-circuitos')?.classList.add('hidden');
  });

  $('tab-btn-circuitos')?.addEventListener('click', () => {
    $('tab-btn-circuitos')?.classList.add('active');
    $('tab-btn-alunos')?.classList.remove('active');
    $('admin-view-circuitos')?.classList.remove('hidden');
    $('admin-view-alunos')?.classList.add('hidden');
    editorCircuits = JSON.parse(JSON.stringify(CIRCUITOS));
    renderCircuitEditor();
  });

  // Seletor de modalidade no editor
  $('circuit-sport-selector')?.addEventListener('click', e => {
    const btn = e.target.closest('.circuit-sport-btn');
    if (!btn) return;
    syncEditorFromActiveInputs();
    activeEditorSport = btn.dataset.sport;
    renderCircuitEditor();
  });

  // Eventos nos cards de estações
  $('circuit-stations-list')?.addEventListener('input', e => {
    const card = e.target.closest('.station-edit-card');
    if (!card) return;
    if (e.target.classList.contains('station-input-name')) {
      const preview = card.querySelector('.station-preview-title');
      if (preview) preview.textContent = e.target.value.trim() || 'Nova Estação';
    }
  });

  $('circuit-stations-list')?.addEventListener('change', e => {
    const card = e.target.closest('.station-edit-card');
    if (!card) return;
    if (e.target.classList.contains('station-input-format') || e.target.classList.contains('station-input-impact')) {
      syncEditorFromActiveInputs();
      renderCircuitEditor();
    }
  });

  $('circuit-stations-list')?.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-remove-station]');
    if (!delBtn) return;
    const idx = Number(delBtn.dataset.removeStation);
    syncEditorFromActiveInputs();
    const stations = editorCircuits[activeEditorSport] || [];
    if (stations.length <= 1) {
      return alert('O circuito precisa ter pelo menos 1 estação.');
    }
    const st = stations[idx];
    if (confirm(`Remover a estação "${st.nome || 'Estação ' + (idx + 1)}"?`)) {
      stations.splice(idx, 1);
      renderCircuitEditor();
    }
  });

  // Adicionar nova estação
  $('circuit-btn-add')?.addEventListener('click', () => {
    syncEditorFromActiveInputs();
    const current = editorCircuits[activeEditorSport] || [];
    current.push({
      nome: `Nova Estação ${current.length + 1}`,
      icon: '⚡',
      type: 'attempts',
      impact: 'bonus',
      attempts: 5,
      unit: 2,
      item: 'Acerto',
      desc: 'Descrição técnica da execução'
    });
    renderCircuitEditor();
  });

  // Restaurar padrão oficial de fábrica
  $('circuit-btn-reset')?.addEventListener('click', () => {
    if (!confirm('Deseja restaurar as estações e pontuações originais de fábrica para todos os circuitos?')) return;
    editorCircuits = JSON.parse(JSON.stringify(DEFAULT_CIRCUITOS));
    saveCircuitos(editorCircuits);
    renderCircuitEditor();
    renderCircuitosPage();
    alert('Configurações originais de circuito restauradas com sucesso!');
  });

  // Salvar alterações
  $('circuit-btn-save')?.addEventListener('click', () => {
    syncEditorFromActiveInputs();
    const current = editorCircuits[activeEditorSport] || [];
    if (!current.length) return alert('O circuito deve ter pelo menos 1 estação.');
    for (let i = 0; i < current.length; i++) {
      if (!current[i].nome || !current[i].nome.trim()) {
        return alert(`A estação #${i + 1} precisa ter um nome preenchido.`);
      }
    }
    saveCircuitos(editorCircuits);
    renderCircuitEditor();
    renderCircuitosPage();
    alert(`Circuito de ${activeEditorSport} salvo com sucesso!\nAs novas regras já estão em vigor no Painel do Árbitro e no Regulamento.`);
  });

  if ($('circuit-stations-list')) {
    renderCircuitEditor();
  }


  // Animação leve, sem interferir no conteúdo original.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animate-in'); observer.unobserve(entry.target); } }), { threshold: .08 });
    document.querySelectorAll('.stat-card,.station-card,.semana-card,section h2').forEach(el => { el.classList.add('pre-animate'); observer.observe(el); });
  }

  btnPausar && (btnPausar.disabled = true); refreshAll(); updateCalculations();
});
