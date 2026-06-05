// ===== Navegação mobile & smooth =====
// ===== Imports =====
import { formatarDataParaISO } from './utils/date.js';
import { getState, setState, subscribe } from './core/store.js';
import { setProfissional, setCliente, setAgendamento } from './services/agendamento.service.js';
import { showToast } from './ui/toast.js';
// ===== Testes temporários =====
console.log('Teste data:', formatarDataParaISO('15/04/2026'));
console.log('Store carregado:', getState());

subscribe((state) => {
  console.log('STORE ATUALIZADO:', state);
  validarFormularioAgendamento();
});

// ===== Navegação mobile & smooth =====
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

menuToggle?.addEventListener('click', () => {
  navLinks.classList.toggle('active');
  const icon = menuToggle.querySelector('i');
  navLinks.classList.contains('active')
    ? icon.classList.replace('bx-menu', 'bx-x')
    : icon.classList.replace('bx-x', 'bx-menu');
});

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');

    if (!id || id === "#") return;

    const t = document.querySelector(id);
    if (!t) return;

    e.preventDefault();

    window.scrollTo({
      top: t.getBoundingClientRect().top + window.pageYOffset - 80,
      behavior: 'smooth'
    });

    navLinks?.classList.remove('active');
  });
});

// ===== Estado =====
let ctx = {
  profissionalNome: null,
  profissionalId: null,
  profissionalDocId: null,
  wa: null,
  colecao: null,
  profKey: null,
  fimExpediente: null,
  diasFolga: null
};

let agendamentoContexto = {
  nomeCliente: '',
  sobrenomeCliente: '',
  telefoneCliente: '',
  raclub: { status: 'nao' },
  servico: null // {nome, valor, tempoMin}
};

let servicoCatalogoSelecionado = null;

// ===== Elementos principais =====
const dataInput = document.getElementById('data');
const horaSelect = document.getElementById('hora');

dataInput?.addEventListener('input', (event) => {
  let valor = event.target.value.replace(/\D/g, '').slice(0, 8);

  if (valor.length >= 5) {
    valor = `${valor.slice(0, 2)}/${valor.slice(2, 4)}/${valor.slice(4)}`;
  } else if (valor.length >= 3) {
    valor = `${valor.slice(0, 2)}/${valor.slice(2)}`;
  }

  event.target.value = valor;
});

horaSelect?.addEventListener('change', () => {
  const atual = getState();

  setAgendamento({
    dataBR: atual.selecao.dataBR,
    dataISO: atual.selecao.dataISO,
    hora: horaSelect.value
  });
});

window.addEventListener("servico-catalogo-selecionado", (e) => {
  servicoCatalogoSelecionado = e.detail;
});

// ===== Constantes =====
const REVIEW_URL = document.getElementById('btnAvaliarGoogle')?.getAttribute('href') || '';

const SERVICOS = [
  // vazio (carrega do Firestore)
];

// ===== Dados dinâmicos (Firestore) =====
let HORARIO_FUNCIONAMENTO = { inicio: '09:00', fim: '18:30' };
let SERVICOS_REMOTE = null;
let PROFISSIONAIS_REMOTE = null;

const toBRL = (n) => (Number(n) || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

// ===== Helpers (profissionalId) =====
function getProfIdFromCollection(col) {
  const c = (col || '').trim();
  if (!c) return null;
  if (c.startsWith('reservas_')) return c.replace(/^reservas_/, '').trim() || null;
  return null;
}

// ===== Helpers (nome para regras) =====
function getProfKeyFromName(nome) {
  const n = (nome || '').trim();
  if (!n) return null;
  return n.split(/\s+/)[0].trim();
}

function getFimExpedienteEfetivo() {
  return ctx.fimExpediente || HORARIO_FUNCIONAMENTO.fim || '18:30';
}

// ===== Helpers de modal =====
let __lastActiveEl = null;

function __getFocusable(container) {
  return container.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );
}

function __trapKeydown(e) {
  if (e.key !== 'Tab') return;
  const focusables = __getFocusable(e.currentTarget);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function abrirModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  __lastActiveEl = document.activeElement;

  el.style.display = 'flex';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.removeAttribute('aria-hidden');

  const focusables = __getFocusable(el);
  (focusables[0] || el).focus();

  el.addEventListener('keydown', __trapKeydown);

  el.__escHandler = (ev) => {
    if (ev.key === 'Escape') fecharModal(id);
  };
  document.addEventListener('keydown', el.__escHandler);
}

function fecharModal(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.style.display = 'none';
  el.setAttribute('aria-hidden', 'true');
  el.removeAttribute('aria-modal');
  el.removeEventListener('keydown', __trapKeydown);

  if (el.__escHandler) {
    document.removeEventListener('keydown', el.__escHandler);
    delete el.__escHandler;
  }

  if (__lastActiveEl && typeof __lastActiveEl.focus === 'function') {
    __lastActiveEl.focus();
  }
}

window.fecharModal = fecharModal;

// ===== Persistência (RA Club) =====
function salvarContextoSessao() {
  try {
    sessionStorage.setItem('agendamentoCtx', JSON.stringify(agendamentoContexto));
    sessionStorage.setItem('ctx', JSON.stringify(ctx));
  } catch { }
}

function restaurarContextoSessao() {
  try {
    const c1 = sessionStorage.getItem('agendamentoCtx');
    const c2 = sessionStorage.getItem('ctx');
    if (c1) agendamentoContexto = JSON.parse(c1);
    if (c2) ctx = JSON.parse(c2);
  } catch { }
}

function tentarRetomarPosCheckout() {
  const flag = sessionStorage.getItem('raclubCheckoutRedirect');
  if (flag === '1') {
    sessionStorage.removeItem('raclubCheckoutRedirect');
    restaurarContextoSessao();

    if (ctx?.colecao && (ctx?.profissionalNome || ctx?.profissionalId)) {

      agendamentoContexto.raclub = { status: 'assinar_link' };

      fecharModal('modalRAClub');

      abrirModalAgendamento();
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') tentarRetomarPosCheckout();
});

// ===== Fluxo Nome → RA Club → Agendamento =====
const nomeClienteInput = document.getElementById('nomeCliente');
const sobrenomeClienteInput = document.getElementById('sobrenomeCliente');
const telefoneClienteInput = document.getElementById('telefoneCliente');

const onlyDigits = (s) => (s || '').replace(/\D/g, '');

document.getElementById('btnClienteContinuar')?.addEventListener('click', () => {
  const nome = (nomeClienteInput.value || '').trim();
  const sobrenome = (sobrenomeClienteInput.value || '').trim();
  const telefoneRaw = (telefoneClienteInput.value || '').trim();
  const telDigits = onlyDigits(telefoneRaw);

  if (!nome) {
    showToast('Informe o nome.', 'warning');
    nomeClienteInput.focus();
    return;
  }

  if (!sobrenome) {
    showToast('Informe o sobrenome.', 'warning');
    sobrenomeClienteInput.focus();
    return;
  }

  if (telDigits.length < 10 || telDigits.length > 13) {
    showToast('Informe um telefone válido com DDD.', 'warning');
    telefoneClienteInput.focus();
    return;
  }

  agendamentoContexto.nomeCliente = nome;
  agendamentoContexto.sobrenomeCliente = sobrenome;
  agendamentoContexto.telefoneCliente = telDigits.startsWith('55') ? telDigits : ('55' + telDigits);

  setCliente({
    nome,
    sobrenome,
    telefone: agendamentoContexto.telefoneCliente
  });

  if (window.appState?.setAgendamento) {
    window.appState.setAgendamento({
      nomeCliente: agendamentoContexto.nomeCliente,
      sobrenomeCliente: agendamentoContexto.sobrenomeCliente,
      telefoneCliente: agendamentoContexto.telefoneCliente
    });
  }

  fecharModal('modalCliente');
  abrirModalRAClub();
});

// ===== RA Club =====
const btnRAJaMembro = document.getElementById('btnRAJaMembro');
const btnRANao = document.getElementById('btnRANao');
const btnRAAssinar = document.getElementById('btnRAAssinar');

function abrirModalRAClub() {
  abrirModal('modalRAClub');
}

btnRAJaMembro?.addEventListener('click', () => {
  agendamentoContexto.raclub = { status: 'membro' };

  if (window.appState?.setAgendamento) {
    window.appState.setAgendamento({
      raclub: { status: 'membro' }
    });
  }

  fecharModal('modalRAClub');
  abrirModalAgendamento();
});

btnRANao?.addEventListener('click', () => {
  agendamentoContexto.raclub = { status: 'nao' };

  if (window.appState?.setAgendamento) {
    window.appState.setAgendamento({
      raclub: { status: 'nao' }
    });
  }

  fecharModal('modalRAClub');
  abrirModalAgendamento();
});

if (btnRAAssinar) {
  const RA_CLUB_CHECKOUT_URL = btnRAAssinar.getAttribute('href') || '';
  btnRAAssinar.addEventListener('click', () => {
    agendamentoContexto.raclub = { status: 'assinar_link' };
    salvarContextoSessao();
    sessionStorage.setItem('raclubCheckoutRedirect', '1');
    if (!RA_CLUB_CHECKOUT_URL) {
      showToast('Link de checkout não configurado.', 'warning');
    }
  });
}

// ===== Regras de horários =====
const STEP_MIN = 30;

function folgaMsg(profNome) {
  const key = getProfKeyFromName(profNome) || profNome;

  if (key === 'Elza') {
    return 'Elza não atende aos domingos. Por favor, escolha outro dia.';
  }

  if (key === 'Rafaela') {
    return 'Rafaela não atende neste dia. Por favor, escolha outro dia.';
  }

  return 'Profissional indisponível para esta data. Escolha outro dia.';
} const hhmmToMin = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (h * 60) + (m || 0);
};

const minToHHMM = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

function getServicoSelecionadoTempoMin() {
  const t = Number(agendamentoContexto?.servico?.tempoMin);
  return Number.isFinite(t) && t > 0 ? t : 30;
}

function gerarSlotsDoDia(inicioHHMM, fimHHMM, passoMin, duracaoMin) {
  const ini = hhmmToMin(inicioHHMM);
  const fim = hhmmToMin(fimHHMM);
  const ultimoInicio = fim - duracaoMin;
  const out = [];

  for (let t = ini; t <= ultimoInicio; t += passoMin) {
    out.push(minToHHMM(t));
  }
  return out;
}

// Compat: reagendamento
function fillHorasForProf(profNome, selectEl, duracaoMinOpt) {
  const dur = Number(duracaoMinOpt) || 30;
  const passo = STEP_MIN;

  const fimEfetivo = getFimExpedienteEfetivo();
  const lista = gerarSlotsDoDia(
    HORARIO_FUNCIONAMENTO.inicio || '09:00',
    fimEfetivo || '18:30',
    passo,
    dur
  );

  const target = selectEl || horaSelect;
  if (!target) return;

  target.innerHTML =
    `<option value="">Selecione um horário</option>` +
    lista.map(h => `<option value="${h}">${h}</option>`).join('');
}

function intervalosConflitam(aIni, aFim, bIni, bFim) {
  return aIni < bFim && bIni < aFim;
}

async function getReservasIntervalosByDate(colecao, ymd) {
  const col = (colecao || '').trim();
  if (!col) return [];

  const q = query(collection(db, col), where("data", "==", ymd));
  const snap = await getDocs(q);
  const items = [];

  snap.forEach(d => {
    const row = d.data() || {};

    if (row.status === "cancelado") {
      return;
    }

    const h = row.hora;
    if (!h) return;

    const tempo = Number(
      row.servicoTempoMin ??
      row.tempoMin ??
      row.duracaoMin
    );

    const dur =
      Number.isFinite(tempo) && tempo > 0
        ? tempo
        : 30;

    const ini = hhmmToMin(h);

    items.push({
      ini,
      fim: ini + dur
    });
  });

  return items;
}

// ===== Disponibilidade via Firestore =====
const CFG_SEMANA_DOC = ['config', 'semana'];
const CFG_HORARIOS_DOC = ['config', 'horarios'];
const CFG_EXCECOES_BASE = ['config', 'excecoes', 'dias'];

async function readSemana() {
  try {
    const ref = doc(db, ...CFG_SEMANA_DOC);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data() || null;
  } catch { }

  try {
    const ref = doc(db, ...CFG_HORARIOS_DOC);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data() || {};
      return {
        weekdays: [1, 2, 3, 4, 5, 6],
        dayStart: d.inicio || '09:00',
        dayEnd: d.fim || '18:30'
      };
    }
  } catch { }

  return null;
}

async function readExcecaoGeral(ymd) {
  try {
    const ref = doc(db, ...CFG_EXCECOES_BASE, ymd);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() || null) : null;
  } catch {
    return null;
  }
}

async function readExcecaoProf(profDocId, ymd) {
  if (!profDocId) return null;
  try {
    const ref = doc(db, 'profissionais', profDocId, 'excecoes', ymd);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() || null) : null;
  } catch {
    return null;
  }
}

// prioridade: prof > geral > semana
async function getDisponibilidadeDia(ymd, profDocId) {
  const semana = await readSemana();
  const excG = await readExcecaoGeral(ymd);
  const excP = await readExcecaoProf(profDocId, ymd);

  if (excP && excP.fechado === true) return { fechado: true };
  if (excP && excP.inicio && excP.fim) return { fechado: false, inicio: excP.inicio, fim: excP.fim, fonte: 'prof' };

  if (excG && excG.fechado === true) return { fechado: true };
  if (excG && excG.inicio && excG.fim) return { fechado: false, inicio: excG.inicio, fim: excG.fim, fonte: 'geral' };

  const w = weekdayFromYMD(ymd);
  const weekdays = Array.isArray(semana?.weekdays) ? semana.weekdays : [1, 2, 3, 4, 5, 6];
  if (!weekdays.includes(w)) return { fechado: true };

  return {
    fechado: false,
    inicio: semana?.dayStart || HORARIO_FUNCIONAMENTO.inicio || '09:00',
    fim: semana?.dayEnd || HORARIO_FUNCIONAMENTO.fim || '18:30',
    fonte: 'semana'
  };
}

function dataPermitidaParaProf(ymd) {
  if (!ymd) return true;

  const folgas = Array.isArray(ctx.diasFolga) ? ctx.diasFolga : [];
  const w = weekdayFromYMD(ymd);

  return !folgas.includes(w);
}

function resetSelectVisual(selectEl) {
  const target = selectEl || horaSelect;
  if (!target) return;

  for (const opt of target.options) {
    if (!opt.value) continue;
    opt.disabled = false;
    opt.classList.remove('reservado');
  }
}

function weekdayFromYMD(ymd) {
  return new Date(`${ymd}T12:00:00`).getDay();
}

async function abrirModalAgendamento() {
  if (!dataInput || !horaSelect) return;

  const servicoCatalogo = sessionStorage.getItem("servicoSelecionadoCatalogo");

  if (servicoCatalogo) {
    const servico = JSON.parse(servicoCatalogo);

    if (
      servico.profissionalId &&
      ctx.profissionalDocId &&
      servico.profissionalId !== ctx.profissionalDocId
    ) {
      showToast(
        `Esse serviço pertence à ${servico.profissionalNome}. Escolha a profissional correta.`,
        "warning"
      );

      sessionStorage.removeItem("servicoSelecionadoCatalogo");
      agendamentoContexto.servico = null;
      return;
    }

    agendamentoContexto.servico = servico;
    sessionStorage.removeItem("servicoSelecionadoCatalogo");
  }

  dataInput.value = "";

  const folgas = Array.isArray(ctx.diasFolga) ? ctx.diasFolga : [];

  if (folgas.length) {
    dataInput.title = "Este profissional não atende em alguns dias da semana.";
  } else {
    dataInput.removeAttribute("title");
  }

  const display = document.getElementById("servicoDisplay");

  display.value = agendamentoContexto.servico
    ? `${agendamentoContexto.servico.nome} — ${toBRL(agendamentoContexto.servico.valor)}`
    : "";

  horaSelect.innerHTML = `<option value="">Selecione a data e depois o serviço</option>`;
  horaSelect.value = "";
  horaSelect.disabled = true;
  resetSelectVisual(horaSelect);

  abrirModal("modal");
}

// ===== Firebase =====
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc, getDoc, setDoc, serverTimestamp,
  collection, query, where, getDocs, writeBatch, runTransaction, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBKJQLcMdWCziHnZxGRe1CZyp4y8-HWKAA",
  authDomain: "salao-saas-everton.firebaseapp.com",
  projectId: "salao-saas-everton",
  storageBucket: "salao-saas-everton.firebasestorage.app",
  messagingSenderId: "323769254134",
  appId: "1:323769254134:web:078c3b3094e0beb7022cd7"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== Carregar Config/Serviços/Profissionais do Firestore =====
async function carregarServicos() {
  try {
    const snap = await getDocs(collection(db, "servicos"));
    const arr = [];
    snap.forEach((docu) => {
      const d = docu.data() || {};

      arr.push({
        id: docu.id,
        nome: (d.nome || d.servicoNome || "").trim(),
        valor: Number(d.valor ?? d.preco ?? d.servicoValor ?? 0),
        tempoMin: Number(d.tempoMin ?? d.tempo ?? d.duracaoMin ?? 30),

        profissionalId: d.profissionalId || "",
        profissionalNome: d.profissionalNome || "",

        categoria: d.categoria || "",
        fotoUrl: d.fotoUrl || "",
      });
    });

    arr.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    SERVICOS_REMOTE = arr.filter((s) => s.nome);

  } catch (e) {
    console.warn("[SERVICOS] Não foi possível carregar serviços:", e);
    SERVICOS_REMOTE = null;
  }
}
function weekdayLabelShort(w) {
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][Number(w)];
}
function formatWeekdaysRange(weekdays) {
  if (!Array.isArray(weekdays) || !weekdays.length) return "";
  const sorted = [...new Set(weekdays.map(Number))].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (sorted.length === 1) return `${weekdayLabelShort(first)}`;
  return `${weekdayLabelShort(first)}-${weekdayLabelShort(last)}`;
}

async function carregarHorarioFuncionamento() {
  let diasTxt = "Seg-Sáb";

  // defaults
  let inicio = HORARIO_FUNCIONAMENTO.inicio || "09:00";
  let fim = HORARIO_FUNCIONAMENTO.fim || "18:30";

  // 1) tenta ler config/semana (melhor: dias + horas)
  try {
    const refSemana = doc(db, "config", "semana");
    const snapSemana = await getDoc(refSemana);

    if (snapSemana.exists()) {
      const s = snapSemana.data() || {};

      if (Array.isArray(s.weekdays) && s.weekdays.length) {
        diasTxt = formatWeekdaysRange(s.weekdays);
      }
      if (s.dayStart) inicio = s.dayStart;
      if (s.dayEnd) fim = s.dayEnd;
    }
  } catch (e) {
    console.warn("[CFG] Falha ao ler config/semana:", e);
  }

  // 2) fallback: config/horarios (se não vier do semana)
  try {
    const refHor = doc(db, "config", "horarios");
    const snapHor = await getDoc(refHor);

    if (snapHor.exists()) {
      const h = snapHor.data() || {};
      if (!inicio && h.inicio) inicio = h.inicio;
      if (!fim && h.fim) fim = h.fim;
    }
  } catch (e) {
    console.warn("[CFG] Falha ao ler config/horarios:", e);
  }

  // aplica no estado global usado pelo resto do sistema
  HORARIO_FUNCIONAMENTO.inicio = inicio;
  HORARIO_FUNCIONAMENTO.fim = fim;

  // atualiza UI
  const elTxt = document.getElementById("horarioFuncionamentoTexto");
  if (elTxt) {
    elTxt.textContent = `${diasTxt}: ${inicio} às ${fim}`;
  }
}
async function carregarProfissionais() {
  try {
    const snap = await getDocs(collection(db, 'profissionais'));
    const arr = [];

    snap.forEach(docu => {
      const d = docu.data() || {};
      arr.push({
        id: docu.id,
        nome: (d.nome || '').trim(),
        fotoUrl: (d.fotoUrl || d.foto || '').trim(),
        whatsapp: (d.whatsapp || d.wa || '').trim(),
        colecao: (d.colecao || d.collection || (d.slug ? `reservas_${d.slug}` : '')).trim(),
        fimExpediente: (d.fimExpediente || d.fim || d.horarioFim || '').trim() || null,
        diasFolga: Array.isArray(d.diasFolga) ? d.diasFolga : (Array.isArray(d.folgas) ? d.folgas : null),
      });
    });

    arr.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
    PROFISSIONAIS_REMOTE = arr.filter(p => p.nome && p.colecao);
  } catch (e) {
    console.warn('[PROFISSIONAIS] Não foi possível carregar profissionais:', e);
    PROFISSIONAIS_REMOTE = null;
  }
}

function getServicosAtivos() {

  const todosServicos =
    Array.isArray(SERVICOS_REMOTE) && SERVICOS_REMOTE.length
      ? SERVICOS_REMOTE.map(s => ({
        nome: s.nome,
        valor: s.valor,
        tempoMin: s.tempoMin,
        profissionalId: s.profissionalId || "",
        profissionalNome: s.profissionalNome || ""
      }))
      : SERVICOS.slice(1).map(s => ({
        ...s,
        tempoMin: s.tempoMin ?? 30
      }));

  const profissionalAtualId = ctx.profissionalDocId || "";

  const servicosFiltrados = profissionalAtualId
    ? todosServicos.filter(s =>
      !s.profissionalId ||
      s.profissionalId === profissionalAtualId
    )
    : todosServicos;

  return [
    {
      nome: "Selecionar...",
      valor: null,
      tempoMin: null,
      placeholder: true
    },
    ...servicosFiltrados
  ];
}

async function renderProfissionaisNoSite() {

  const container = document.getElementById('profissionaisContainer');
  if (!container) return;

  const lista = Array.isArray(PROFISSIONAIS_REMOTE) && PROFISSIONAIS_REMOTE.length
    ? PROFISSIONAIS_REMOTE
    : [
      {
        id: '',
        nome: 'Elza Brogni de Sena',
        fotoUrl: './assets/elza-sena.png',
        whatsapp: '554899106-0294',
        colecao: 'reservas_elza-b-sena',
        fimExpediente: '18:30',
        diasFolga: [0]
      }
    ];

  container.innerHTML = `
    <div class="skeleton-grid">

      <div class="skeleton-card">
        <div class="skeleton-image"></div>

        <div class="skeleton-content">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>

          <div class="skeleton-btn"></div>
          <div class="skeleton-btn"></div>
        </div>
      </div>

      <div class="skeleton-card">
        <div class="skeleton-image"></div>

        <div class="skeleton-content">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>

          <div class="skeleton-btn"></div>
          <div class="skeleton-btn"></div>
        </div>
      </div>

    </div>
  `;

  await new Promise(resolve => setTimeout(resolve, 1000));

  container.innerHTML = '';

  lista.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'haircut';

    const dataFim = p.fimExpediente ? `data-fim="${p.fimExpediente}"` : '';
    const dataFolga = Array.isArray(p.diasFolga) ? `data-folgas='${JSON.stringify(p.diasFolga)}'` : '';

    card.innerHTML = `
      <img src="${p.fotoUrl || './assets/logo-pro.jpeg'}" alt="${p.nome}" class="service-img"
>
      <div class="haircut-info">
        <strong>${p.nome}</strong>
        <div class="btn-actions">

          <button class="button-contact openModalBtn"
            data-pro="${p.nome}"
            data-prodoc="${p.id || ''}"
            data-wa="${p.whatsapp || ''}"
            data-col="${p.colecao}"
            ${dataFim}
            ${dataFolga}
          >
            <i class='bx bx-calendar'></i> Agende Seu Horário
          </button>

          <button class="button-secondary openReagendaBtn"
            data-pro="${p.nome}"
            data-prodoc="${p.id || ''}"
            data-wa="${p.whatsapp || ''}"
            data-col="${p.colecao}"
            ${dataFim}
            ${dataFolga}
          >
            <i class='bx bx-refresh'></i> Reagendar seu horário
          </button>

        </div>
      </div>
    `;
    container.appendChild(card);
  });

  bindProfButtons();
  bindReagendaButtons();
}

function bindProfButtons() {
  document.querySelectorAll('.openModalBtn').forEach(btn => {
    if (btn.__boundAgendar) return;
    btn.__boundAgendar = true;

    btn.addEventListener('click', () => {
      ctx.profissionalNome = (btn.dataset.pro || 'Profissional').trim();
      ctx.profissionalDocId = (btn.dataset.prodoc || '').trim() || null;

      ctx.profKey = getProfKeyFromName(ctx.profissionalNome);
      ctx.wa = (btn.dataset.wa || '5581999999999').trim();
      ctx.colecao = (btn.dataset.col || 'reservas').trim();
      ctx.profissionalId = getProfIdFromCollection(ctx.colecao) || null;

      ctx.fimExpediente = (btn.dataset.fim || '').trim() || null;

      try {
        ctx.diasFolga = btn.dataset.folgas ? JSON.parse(btn.dataset.folgas) : null;
      } catch {
        ctx.diasFolga = null;
      }

      setProfissional(ctx);

      if (window.appState?.setCtx) {
        window.appState.setCtx({
          profissionalNome: ctx.profissionalNome,
          profissionalDocId: ctx.profissionalDocId,
          profKey: ctx.profKey,
          wa: ctx.wa,
          colecao: ctx.colecao,
          profissionalId: ctx.profissionalId,
          fimExpediente: ctx.fimExpediente,
          diasFolga: ctx.diasFolga
        });
      }

      if (
        servicoCatalogoSelecionado?.profissionalId &&
        servicoCatalogoSelecionado.profissionalId !== ctx.profissionalDocId
      ) {

        showToast(
          `Esse serviço pertence à ${servicoCatalogoSelecionado.profissionalNome}. Escolha a profissional correta.`,
          "warning"
        );

        return;
      }

      salvarContextoSessao();
      abrirModal('modalCliente');
    });
  });
}

function bindReagendaButtons() {
  document.querySelectorAll('.openReagendaBtn').forEach(btn => {
    if (btn.__boundReagendar) return;
    btn.__boundReagendar = true;

    btn.addEventListener('click', () => {
      ctx.profissionalNome = (btn.dataset.pro || 'Profissional').trim();
      ctx.profissionalDocId = (btn.dataset.prodoc || '').trim() || null;

      ctx.profKey = getProfKeyFromName(ctx.profissionalNome);
      ctx.wa = (btn.dataset.wa || '5581999999999').trim();
      ctx.colecao = (btn.dataset.col || 'reservas').trim();
      ctx.profissionalId = getProfIdFromCollection(ctx.colecao) || null;

      ctx.fimExpediente = (btn.dataset.fim || '').trim() || null;
      try {
        ctx.diasFolga = btn.dataset.folgas ? JSON.parse(btn.dataset.folgas) : null;
      } catch {
        ctx.diasFolga = null;
      }

      reaResultados.innerHTML = '';
      reaStepBusca.classList.remove('hidden');
      reaStepMover.classList.add('hidden');
      reaNome.value = '';
      reaSobrenome.value = '';

      abrirModal('modalReagendar');
    });
  });
}

// ===== Inicialização =====
(async function initSite() {

  const savedCtx = sessionStorage.getItem('ctx');
  const savedAgendamento = sessionStorage.getItem('agendamentoCtx');

  if (savedCtx) {
    Object.assign(ctx, JSON.parse(savedCtx));
  }

  if (savedAgendamento) {
    Object.assign(agendamentoContexto, JSON.parse(savedAgendamento));
  }

  await Promise.all([
    carregarHorarioFuncionamento(),
    carregarServicos(),
    carregarProfissionais(),
  ]);

  renderProfissionaisNoSite();

  if (ctx?.profissionalNome && agendamentoContexto?.nomeCliente) {

    setTimeout(() => {

      abrirModalAgendamento();

      if (agendamentoContexto.nomeCliente && nomeClienteInput) {
        nomeClienteInput.value = agendamentoContexto.nomeCliente || '';
      }

      if (agendamentoContexto.sobrenomeCliente && sobrenomeClienteInput) {
        sobrenomeClienteInput.value = agendamentoContexto.sobrenomeCliente || '';
      }

      if (agendamentoContexto.telefoneCliente && telefoneClienteInput) {
        telefoneClienteInput.value = agendamentoContexto.telefoneCliente || '';
      }

      if (agendamentoContexto.servico && servicoDisplay) {
        servicoDisplay.value =
          `${agendamentoContexto.servico.nome} — ${toBRL(agendamentoContexto.servico.valor)}`;
      }

      if (agendamentoContexto.dataBR && dataInput) {
        dataInput.value = agendamentoContexto.dataBR;
      }

      if (agendamentoContexto.hora && horaSelect) {
        horaSelect.value = agendamentoContexto.hora;
      }

    }, 700);
  }

})();


const confirmarBtn = document.getElementById('confirmarBtn');

function validarFormularioAgendamento() {
  const state = getState();

  const temData = !!state.selecao.dataISO;
  const temHora = !!state.selecao.hora;
  const temServico = !!agendamentoContexto.servico;
  const temCliente = !!(state.cliente.nome && state.cliente.telefone);

  const valido = temData && temHora && temServico && temCliente;

  if (confirmarBtn) {
    confirmarBtn.disabled = !valido;
    confirmarBtn.style.opacity = valido ? '1' : '0.5';
    confirmarBtn.style.cursor = valido ? 'pointer' : 'not-allowed';
  }
}

validarFormularioAgendamento();

const toKey = (ymd, hhmm) => `${ymd}_${hhmm}`;
const normalizeHora = (h) => (h || '').padStart(5, "0");


// ---- consultar horários ocupados para a data
async function getReservasByDate(colecao, ymd) {
  const col = (colecao || '').trim();
  if (!col) return new Set();

  const q = query(collection(db, col), where("data", "==", ymd));
  const snap = await getDocs(q);
  const horasOcupadas = new Set();

  snap.forEach(d => {
    const row = d.data();
    if (row?.hora) horasOcupadas.add(row.hora);
  });

  return horasOcupadas;
}

async function preencherHorasDisponiveis() {
  const ymd = formatarDataParaISO(dataInput?.value);
  const col = ctx?.colecao;
  const dur = getServicoSelecionadoTempoMin();
  const passo = STEP_MIN;

  if (!horaSelect) return;

  horaSelect.innerHTML = `<option value="">Selecione um horário</option>`;

  if (!ymd) {
    horaSelect.disabled = true;
    horaSelect.innerHTML = `<option value="">Selecione a data primeiro</option>`;
    return;
  }

  if (!col) {
    horaSelect.disabled = true;
    horaSelect.innerHTML = `<option value="">Profissional não definido</option>`;
    return;
  }

  if (!agendamentoContexto.servico) {
    horaSelect.innerHTML = `<option value="">Selecione o serviço para ver os horários</option>`;
    horaSelect.value = "";
    horaSelect.disabled = true;
    return;
  }

  horaSelect.disabled = false;

  let disp = null;
  try {
    disp = await getDisponibilidadeDia(ymd, ctx.profissionalDocId);
  } catch (e) {
    console.warn('[DISP] Falha ao ler disponibilidade, usando fallback.', e);
  }

  if (disp?.fechado === true) {
    horaSelect.innerHTML = `<option value="">Indisponível nesta data</option>`;
    horaSelect.disabled = true;
    return;
  }

  const inicioEfetivo = (disp?.inicio || HORARIO_FUNCIONAMENTO.inicio || '09:00');
  const fimEfetivo = (disp?.fim || getFimExpedienteEfetivo() || '18:30');

  const lista = gerarSlotsDoDia(inicioEfetivo, fimEfetivo, passo, dur);

  horaSelect.innerHTML =
    `<option value="">Selecione um horário</option>` +
    lista.map(h => `<option value="${h}">${h}</option>`).join('');

  try {
    const reservas = await getReservasIntervalosByDate(col, ymd);

    for (const opt of horaSelect.options) {
      const val = opt.value;
      if (!val) continue;

      const ini = hhmmToMin(val);

      const ocupado = reservas.some(
        r => ini >= r.ini && ini < r.fim
      );

      if (ocupado) {
        opt.disabled = true;
        opt.classList.add('reservado');
        opt.textContent = `${val} — reservado`;
      } else {
        opt.disabled = false;
        opt.classList.remove('reservado');
        opt.textContent = val;
      }

      if (ocupado && horaSelect.value === val) {
        horaSelect.value = '';
        showToast('Esse horário acabou de ser ocupado. Escolha outro.', 'warning');
      }
    }
  } catch (e) {
    console.error("Erro ao carregar horários:", e);
    showToast("Não foi possível consultar os horários agora.", "error");
  }
}

window.preencherHorasDisponiveis = preencherHorasDisponiveis;

async function carregarIndisponiveis() {
  await preencherHorasDisponiveis();
}

dataInput?.addEventListener('change', async () => {
  if (!dataInput.value || dataInput.value.length !== 10) return;

  const dataISO = formatarDataParaISO(dataInput.value);

  setAgendamento({
    dataBR: dataInput.value,
    dataISO,
    hora: ''
  });

  if (!dataISO) return;

  try {
    const disp = await getDisponibilidadeDia(dataISO, ctx.profissionalDocId);
    if (disp?.fechado === true) {
      showToast('Indisponível nesta data. Escolha outro dia.', 'warning');
      dataInput.value = "";
      horaSelect.innerHTML = `<option value="">Selecione a data e depois o serviço</option>`;
      horaSelect.value = "";
      horaSelect.disabled = true;
      resetSelectVisual(horaSelect);
      return;
    }
  } catch { }

  horaSelect.innerHTML = `<option value="">Selecione o serviço para ver os horários</option>`;
  horaSelect.value = "";
  horaSelect.disabled = true;
  resetSelectVisual(horaSelect);

  if (!agendamentoContexto.servico) {
    horaSelect.innerHTML = `<option value="">Selecione o serviço para ver os horários</option>`;
    horaSelect.value = "";
    horaSelect.disabled = true;
    return;
  }

  await preencherHorasDisponiveis();
});

// ===== Modal de Serviço =====
const servicoDisplay = document.getElementById('servicoDisplay');
const servicoLista = document.getElementById('servicoLista');
const servicoCancelar = document.getElementById('servicoCancelar');
const servicoConfirmarWpp = document.getElementById('servicoConfirmarWpp');

const svcSearch = document.getElementById('svcSearch');
let svcFilterText = "";
const norm = (s) => (s || "").normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function getFilteredServicos() {
  const base = getServicosAtivos().slice(1);
  if (!svcFilterText.trim()) return [{ nome: 'Selecionar...', valor: null, placeholder: true }, ...base];

  const f = norm(svcFilterText);
  const filtered = base.filter(s => norm(s.nome).includes(f));
  return [{ nome: 'Selecionar...', valor: null, placeholder: true }, ...filtered];
}

function renderListaServicos() {
  const items = getFilteredServicos();

  servicoLista.innerHTML = items.map((s) => {
    const checked = agendamentoContexto.servico
      ? (agendamentoContexto.servico.nome === s.nome ? 'checked' : '')
      : (s.placeholder ? 'checked' : '');

    const sub = s.placeholder ? '' : `<div class="svc-muted">${s.valor != null ? toBRL(s.valor) : ''}</div>`;

    return `
      <label class="svc-row" data-nome="${s.nome}">
        <div class="svc-left">
          <div class="svc-name">${s.nome}</div>
          ${sub}
        </div>
        <input class="svc-radio" type="radio" name="svc" value="${s.nome}" ${checked} />
      </label>
    `;
  }).join('');

  servicoLista.querySelectorAll('.svc-row').forEach(row => {
    row.addEventListener('click', () => {
      const radio = row.querySelector('input[type="radio"]');
      if (!radio) return;
      radio.checked = true;
    });
  });
}

async function abrirServico() {
  if (!SERVICOS_REMOTE) {
    await carregarServicos();
  }

  svcFilterText = "";
  if (svcSearch) svcSearch.value = "";
  renderListaServicos();
  abrirModal('servicoModal');
}

servicoDisplay?.addEventListener('click', () => {
  if (!dataInput?.value) {
    showToast('Selecione a data primeiro.', 'warning');
    dataInput?.focus();
    return;
  }
  abrirServico();
});

servicoCancelar?.addEventListener('click', () => fecharModal('servicoModal'));

svcSearch?.addEventListener('input', (e) => {
  svcFilterText = e.target.value || "";
  renderListaServicos();
});

servicoConfirmarWpp?.addEventListener('click', async () => {
  const sel = servicoLista.querySelector('input[name="svc"]:checked');
  if (!sel) {
    showToast('Selecione um serviço.', 'warning');
    return;
  }

  const nomeSel = sel.value;
  const s = getServicosAtivos().find(x => x.nome === nomeSel);
  if (!s || s.placeholder) {
    showToast('Selecione um serviço.', 'warning');
    return;
  }

  agendamentoContexto.servico = {
    nome: s.nome,
    valor: s.valor,
    tempoMin: s.tempoMin ?? 30
  };

  if (window.appState?.setAgendamento) {
    window.appState.setAgendamento({
      servico: agendamentoContexto.servico
    });
  }

  servicoDisplay.value = `${s.nome} — ${toBRL(s.valor)}`;
  fecharModal('servicoModal');

  if (!dataInput.value) {
    horaSelect.innerHTML = `<option value="">Selecione a data primeiro</option>`;
    horaSelect.value = '';
    horaSelect.disabled = true;
    return;
  }

  horaSelect.disabled = false;
  await preencherHorasDisponiveis();

  if (dataInput.value && horaSelect.value) {
    confirmarBtn.click();
  }
});

// ===== Confirmar agendamento =====
const confResumo = document.getElementById('confResumo');
const btnOkConfirmacao = document.getElementById('btnOkConfirmacao');

btnOkConfirmacao?.addEventListener('click', () => fecharModal('modalConfirmacao'));

confirmarBtn?.addEventListener('click', async () => {

  const dataBR = dataInput?.value;
  const data = formatarDataParaISO(dataBR);
  const hora = horaSelect?.value;

  if (!data) {
    showToast("Selecione a data primeiro.", "warning");
    dataInput?.focus();
    return;
  }

  if (!agendamentoContexto.servico) {
    showToast("Selecione o serviço.", "warning");
    abrirServico();
    return;
  }

  if (!hora) {
    showToast("Selecione o horário.", "warning");
    horaSelect?.focus();
    return;
  }

  if (!dataPermitidaParaProf(data, ctx.profissionalNome)) {
    showToast(folgaMsg(ctx.profissionalNome), "warning");
    return;
  }

  if (!(agendamentoContexto.nomeCliente && agendamentoContexto.sobrenomeCliente)) {
    showToast("Informe nome e sobrenome.", "warning");
    abrirModal('modalCliente');
    return;
  }

  if (!agendamentoContexto.telefoneCliente || agendamentoContexto.telefoneCliente.length < 12) {
    showToast("Informe um telefone válido com DDD.", "warning");
    abrirModal('modalCliente');
    return;
  }

  if (!ctx.colecao) {
    showToast("Profissional não definido.", "error");
    return;
  }

  if (!ctx.profissionalId) ctx.profissionalId = getProfIdFromCollection(ctx.colecao) || null;

  const originalText = confirmarBtn.textContent;

  confirmarBtn.disabled = true;
  confirmarBtn.textContent = "Agendando...";
  document.body.classList.add('modal-loading');

  try {

    const hhmm = normalizeHora(hora);
    const col = (ctx.colecao || '').trim();
    const ref = doc(db, col, toKey(data, hhmm));

    const reservas = await getReservasIntervalosByDate(col, data);

    const inicioSelecionado = hhmmToMin(hhmm);
    const fimSelecionado =
      inicioSelecionado +
      (Number(agendamentoContexto.servico?.tempoMin) || 30);

    const conflitoDuracao = reservas.some((r) =>
      intervalosConflitam(
        inicioSelecionado,
        fimSelecionado,
        r.ini,
        r.fim
      )
    );

    if (conflitoDuracao) {
      confirmarBtn.disabled = false;
      confirmarBtn.textContent = originalText || "Agendar";

      showToast(
        `Este serviço necessita de ${Number(agendamentoContexto.servico?.tempoMin) || 30} minutos.

    O horário seguinte já está reservado.

    Escolha outro horário ou consulte a profissional sobre a possibilidade de encaixe.`,
        "warning"
      );

      return;
    }

    const snap = await getDoc(ref);

    if (snap.exists()) {

      const reservaExistente = snap.data() || {};

      if (reservaExistente.status !== "cancelado") {

        confirmarBtn.disabled = false;
        confirmarBtn.textContent = originalText || "Agendar";

        showToast(
          "Esse horário acabou de ser reservado. Escolha outro horário.",
          "warning"
        );

        await preencherHorasDisponiveis();

        return;

      }

    }

    const isRaClub = agendamentoContexto?.raclub?.status === 'membro';
    const nomeCompleto = `${agendamentoContexto.nomeCliente} ${agendamentoContexto.sobrenomeCliente}`.trim();

    sessionStorage.setItem(
      'nv_agendamento_state',
      JSON.stringify({
        ctx,
        agendamentoContexto
      })
    );

    await setDoc(ref, {

      data,
      hora: hhmm,

      profissional: ctx.profissionalId || null,
      profissionalNome: ctx.profissionalNome || null,

      clienteNome: agendamentoContexto.nomeCliente,
      clienteSobrenome: agendamentoContexto.sobrenomeCliente,
      clienteNomeCompleto: nomeCompleto,
      clienteNomeLower: (agendamentoContexto.nomeCliente || '').toLowerCase(),
      clienteSobrenomeLower: (agendamentoContexto.sobrenomeCliente || '').toLowerCase(),
      clienteTelefone: agendamentoContexto.telefoneCliente,

      servicoNome: agendamentoContexto.servico?.nome || null,
      servicoValor: agendamentoContexto.servico?.valor ?? null,
      servicoTempoMin: Number(agendamentoContexto.servico?.tempoMin) || 30,

      raclub: agendamentoContexto.raclub || { status: 'nao' },
      raclubMembro: isRaClub,
      clienteTipo: isRaClub ? 'raclub' : 'cliente',
      tags: isRaClub ? ['raclub'] : [],
      createdAt: serverTimestamp()
    });

    await carregarIndisponiveis();

    const dataFormatadaBR = new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
    const servicoTxt = agendamentoContexto.servico
      ? `${agendamentoContexto.servico.nome} (${toBRL(agendamentoContexto.servico.valor)})`
      : '—';

    let raclubTxt = "Não";
    if (agendamentoContexto.raclub.status === 'membro') raclubTxt = "Membro";
    else if (agendamentoContexto.raclub.status === 'assinar' || agendamentoContexto.raclub.status === 'assinar_link') raclubTxt = "Deseja assinar";

    if (confResumo) {
      confResumo.innerHTML = `
        <div class="line"><span class="label">Cliente:</span> <span>${nomeCompleto}</span></div>
        <div class="line"><span class="label">Profissional:</span> <span>${ctx.profissionalNome}</span></div>
        <div class="line"><span class="label">Profissional ID:</span> <span>${ctx.profissionalId}</span></div>
        <div class="line"><span class="label">Data:</span> <span>${dataFormatadaBR}</span></div>
        <div class="line"><span class="label">Hora:</span> <span>${hhmm}</span></div>
        <div class="line"><span class="label">Serviço:</span> <span>${servicoTxt}</span></div>
        <div class="line"><span class="label">RA Club:</span> <span>${raclubTxt}</span></div>
      `;
    }

    const mensagemWhatsApp = `
    Olá! Tudo bem? 😊

    Acabei de realizar meu agendamento pelo site do Salão de Beleza Novo Visual e gostaria de confirmar meu horário.

    💇 Serviço: ${agendamentoContexto.servico?.nome || 'Não informado'}

    📅 Data: ${dataFormatadaBR}
    ⏰ Hora: ${hhmm}

    👤 Cliente: ${nomeCompleto}
    📞 Telefone: ${agendamentoContexto.telefoneCliente}

    ${isRaClub ? '💎 Sou membro do Clube de Beleza.' : ''}

    `.trim();

    const numeroProfissional = onlyDigits(ctx.wa || '');

    if (!numeroProfissional) {
      showToast('WhatsApp do profissional não configurado.', 'warning');
    } else {
      const whatsappUrl = `https://wa.me/${numeroProfissional}?text=${encodeURIComponent(mensagemWhatsApp)}`;

      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
      }, 800);
    }

    fecharModal('modal');
    abrirModal('modalConfirmacao');

    const modalConfirmacao = document.querySelector('#modalConfirmacao .modal-content');

    if (modalConfirmacao) {
      modalConfirmacao.innerHTML = `
        <div class="modal-confirmacao-sucesso">
          <div class="success-icon">✓</div>

          <h2>Agendamento confirmado!</h2>

          <p>
            Seu horário foi reservado com sucesso.<br>
            A profissional recebeu a solicitação no WhatsApp.
          </p>
        </div>
      `;
    }


  } catch (err) {
    console.error("[RESERVA]", err);
    showToast("Não foi possível concluir a reserva. Tente novamente.", "error");
  } finally {
    confirmarBtn.disabled = false;
    confirmarBtn.textContent = originalText || "Agendar";
    document.body.classList.remove('modal-loading');
  }
});


// ===== Util =====
function formatDateBR(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

// Fechar modal clicando fora
window.addEventListener('click', (e) => {
  document.querySelectorAll('.modal').forEach(m => {
    if (e.target === m) m.style.display = 'none';
  });
});

// Retomar fluxo pós-checkout
tentarRetomarPosCheckout();

// ---------------------------------------------------------------------
//        REAGENDAMENTO
// ---------------------------------------------------------------------
const reaStepBusca = document.getElementById('reaStepBusca');
const reaStepMover = document.getElementById('reaStepMover');
const reaNome = document.getElementById('reaNome');
const reaSobrenome = document.getElementById('reaSobrenome');
const reaBuscarBtn = document.getElementById('reaBuscarBtn');
const reaResultados = document.getElementById('reaResultados');
const reaEscolhido = document.getElementById('reaEscolhido');
const reaData = document.getElementById('reaData');
const reaHora = document.getElementById('reaHora');
const reaConfirmarBtn = document.getElementById('reaConfirmarBtn');

let reservaSelecionada = null;

async function buscarAgendamentosPorNome(colecao, nomeLower, sobrenomeLower) {
  const q1 = query(collection(db, colecao), where('clienteNomeLower', '==', nomeLower));
  const snap = await getDocs(q1);
  const out = [];

  snap.forEach(d => {
    const row = d.data();
    if ((row?.clienteSobrenomeLower || '') === sobrenomeLower) {
      out.push({ id: d.id, ref: d.ref, ...row });
    }
  });

  return out;
}

function renderResultados(list) {
  if (!list.length) {
    reaResultados.innerHTML = `<div class="muted">Nenhum agendamento encontrado para esse nome.</div>`;
    return;
  }

  list.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  reaResultados.innerHTML = list.map((r, idx) => `
    <div class="rea-item">
      <div class="rea-line"><strong>Data:</strong> ${formatDateBR(r.data)} • <strong>Hora:</strong> ${r.hora}</div>
      <div class="rea-line"><strong>Serviço:</strong> ${r.servicoNome || '—'}</div>
      <button type="button" data-i="${idx}" class="reaSelectBtn">Selecionar</button>
    </div>
  `).join('');

  document.querySelectorAll('.reaSelectBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.i);
      const chosen = list[i];

      reservaSelecionada = {
        idAntigo: chosen.id,
        refAntigo: chosen.ref,
        dataAntiga: chosen.data,
        horaAntiga: chosen.hora,
        docData: chosen
      };

      const hoje = new Date();
      const y = hoje.getFullYear();
      const m = String(hoje.getMonth() + 1).padStart(2, "0");
      const d = String(hoje.getDate()).padStart(2, "0");
      reaData.min = `${y}-${m}-${d}`;
      reaData.value = '';

      reaEscolhido.innerHTML = `
        <strong>Agendamento atual:</strong> ${formatDateBR(chosen.data)} às ${chosen.hora}
        ${chosen.servicoNome ? ` • ${chosen.servicoNome}` : ''}
      `;

      fillHorasForProf(
        ctx.profissionalNome,
        reaHora,
        reservaSelecionada?.docData?.servicoTempoMin || 30
      );

      resetSelectVisual(reaHora);

      reaStepBusca.classList.add('hidden');
      reaStepMover.classList.remove('hidden');
    });
  });
}

reaBuscarBtn?.addEventListener('click', async () => {
  const nome = (reaNome.value || '').trim().toLowerCase();
  const sobrenome = (reaSobrenome.value || '').trim().toLowerCase();

  if (!nome || !sobrenome) {
    showToast('Informe nome e sobrenome para buscar.', 'warning');
    return;
  }
  if (!ctx.colecao) {
    showToast('Profissional não definido.', 'warning');
    return;
  }

  try {
    reaResultados.innerHTML = 'Carregando...';
    const itens = await buscarAgendamentosPorNome(ctx.colecao, nome, sobrenome);
    renderResultados(itens);
  } catch (e) {
    console.error('[Reagendar][buscar]', e);
    reaResultados.innerHTML = '<div class="muted">Erro ao buscar. Tente novamente.</div>';
  }
});

reaData?.addEventListener('change', async () => {
  if (!reaData.value) return;

  const ymd = reaData.value;
  const dur = Number(reservaSelecionada?.docData?.servicoTempoMin) || 30;
  const passo = STEP_MIN;

  try {
    const disp = await getDisponibilidadeDia(ymd, ctx.profissionalDocId);
    if (disp?.fechado === true) {
      showToast('Indisponível nesta data. Escolha outro dia.', 'warning');
      reaData.value = '';
      resetSelectVisual(reaHora);
      reaHora.value = '';
      return;
    }
  } catch {
    // segue
  }

  const inicioEfetivo = HORARIO_FUNCIONAMENTO.inicio || '09:00';
  const fimEfetivo = getFimExpedienteEfetivo() || '18:30';

  const lista = gerarSlotsDoDia(inicioEfetivo, fimEfetivo, passo, dur);

  reaHora.innerHTML =
    `<option value="">Selecione um horário</option>` +
    lista.map(h => `<option value="${h}">${h}</option>`).join('');

  try {
    const reservas = await getReservasIntervalosByDate(ctx.colecao, ymd);

    for (const opt of reaHora.options) {
      const val = opt.value;
      if (!val) continue;

      const ini = hhmmToMin(val);
      const fim = ini + dur;

      const conflita = reservas.some(r => intervalosConflitam(ini, fim, r.ini, r.fim));

      const eMesmoSlot =
        reservaSelecionada &&
        reservaSelecionada.dataAntiga === ymd &&
        reservaSelecionada.horaAntiga === val;

      const disabled = conflita && !eMesmoSlot;
      opt.disabled = disabled;
      opt.classList.toggle('reservado', disabled);
    }
  } catch (e) {
    console.error('[Reagendar][disponibilidade]', e);
    showToast('Não foi possível consultar horários desta data.', 'error');
  }
});

function sanitize(obj) {
  Object.keys(obj).forEach(k => {
    if (obj[k] === undefined) delete obj[k];
  });
  return obj;
}

function buildPayloadFromOld(oldDoc = {}, overrides = {}) {
  const nomeCompleto = oldDoc.clienteNomeCompleto ||
    [oldDoc.clienteNome, oldDoc.clienteSobrenome].filter(Boolean).join(' ') || '';

  return sanitize({
    ...oldDoc,
    data: overrides.data,
    hora: normalizeHora(overrides.hora),
    profissional: overrides.profissionalId || oldDoc.profissional,
    profissionalNome: overrides.profissionalNome || oldDoc.profissionalNome || null,
    reagendadoDe: overrides.reagendadoDe || null,
    updatedAt: serverTimestamp(),
    createdAt: oldDoc.createdAt,
    clienteNomeCompleto: nomeCompleto
  });
}

reaConfirmarBtn?.addEventListener('click', async () => {
  if (!reservaSelecionada || !reservaSelecionada.refAntigo) {
    showToast('Selecione um agendamento para reagendar.', 'warning');
    return;
  }

  const novaData = reaData.value;
  const novaHora = normalizeHora(reaHora.value);

  if (!novaData || !novaHora) {
    showToast('Selecione a nova data e hora.', 'warning');
    return;
  }

  if (!dataPermitidaParaProf(novaData, ctx.profissionalNome)) {
    showToast(folgaMsg(ctx.profissionalNome), 'warning');
    return;
  }

  const col = (ctx.colecao || '').trim();
  const idNovo = toKey(novaData, novaHora);
  const refNovo = doc(db, col, idNovo);
  const refAntigo = reservaSelecionada.refAntigo;

  const mudouSlot = !(reservaSelecionada.dataAntiga === novaData && reservaSelecionada.horaAntiga === novaHora);

  if (!ctx.profissionalId) ctx.profissionalId = getProfIdFromCollection(ctx.colecao) || null;

  try {
    await runTransaction(db, async (tx) => {
      const oldSnap = await tx.get(refAntigo);
      if (!oldSnap.exists()) throw new Error('Agendamento original não existe mais.');

      if (mudouSlot) {
        const newSnap = await tx.get(refNovo);
        if (newSnap.exists()) throw new Error('Este novo horário já está reservado.');
      }

      const base = oldSnap.data() || {};

      if (mudouSlot) {
        const payloadNew = buildPayloadFromOld(base, {
          data: novaData,
          hora: novaHora,
          profissionalId: ctx.profissionalId || null,
          profissionalNome: ctx.profissionalNome || null,
          reagendadoDe: refAntigo.id
        });
        tx.set(refNovo, payloadNew);
        tx.delete(refAntigo);
      } else {
        const payloadSame = buildPayloadFromOld(base, {
          data: novaData,
          hora: novaHora,
          profissionalId: ctx.profissionalId || null,
          profissionalNome: ctx.profissionalNome || null,
          reagendadoDe: refAntigo.id
        });
        payloadSame.bloqueado = deleteField();
        tx.set(refAntigo, payloadSame, { merge: true });
      }
    });
  } catch (txErr) {
    console.warn('[Reagendar][transaction falhou], tentando fallback:', txErr?.message || txErr);

    try {
      const oldSnap = await getDoc(refAntigo);
      if (!oldSnap.exists()) throw new Error('Agendamento original não existe mais.');

      if (mudouSlot) {
        const newSnap = await getDoc(refNovo);
        if (newSnap.exists()) throw new Error('Este novo horário já está reservado.');

        const base = oldSnap.data() || {};
        const payload = buildPayloadFromOld(base, {
          data: novaData,
          hora: novaHora,
          profissionalId: ctx.profissionalId || null,
          profissionalNome: ctx.profissionalNome || null,
          reagendadoDe: refAntigo.id
        });

        const batch = writeBatch(db);
        batch.set(refNovo, payload);
        batch.delete(refAntigo);
        await batch.commit();
      } else {
        const base = oldSnap.data() || {};
        const payload = buildPayloadFromOld(base, {
          data: novaData,
          hora: novaHora,
          profissionalId: ctx.profissionalId || null,
          profissionalNome: ctx.profissionalNome || null,
          reagendadoDe: refAntigo.id
        });
        payload.bloqueado = deleteField();
        await setDoc(refAntigo, payload, { merge: true });
      }
    } catch (fbErr) {
      console.error('[Reagendar][fallback erro]', fbErr);
      showToast(
        fbErr?.message || 'Não foi possível reagendar agora. Tente novamente.',
        'error'
      );
      return;
    }
  }

  try {
    const base = reservaSelecionada.docData || {};
    const dataBR = new Date(`${novaData}T00:00:00`).toLocaleDateString('pt-BR');

    if (confResumo) {
      confResumo.innerHTML = `
    <div class="conf-card">

      <div class="conf-line">
        <span class="label">Cliente</span>
        <span class="value">${nomeCompleto}</span>
      </div>

      <div class="conf-line">
        <span class="label">Profissional</span>
        <span class="value">${ctx.profissionalNome}</span>
      </div>

      <div class="conf-line">
        <span class="label">Data</span>
        <span class="value">${dataFormatadaBR}</span>
      </div>

      <div class="conf-line">
        <span class="label">Hora</span>
        <span class="value">${hhmm}</span>
      </div>

      <div class="conf-line">
        <span class="label">Serviço</span>
        <span class="value">${servicoTxt}</span>
      </div>

      <div class="conf-line">
        <span class="label">RA Club</span>
        <span class="value">${raclubTxt}</span>
      </div>

    </div>
  `;
    }

    fecharModal('modalReagendar');
    abrirModal('modalConfirmacao');
  } catch (e) {
    console.error('[Reagendar][resumo]', e);
  }
});