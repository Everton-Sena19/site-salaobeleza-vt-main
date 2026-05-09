import { db } from "./firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const container = document.getElementById("lista-servicos-site");

async function carregarServicosSite() {
  const snap = await getDocs(collection(db, "servicos"));

  const servicos = [];

  snap.forEach(doc => {
    servicos.push({
      id: doc.id,
      ...doc.data()
    });
  });

  renderizarServicos(servicos);
}

function renderizarServicos(servicos) {
  if (!container) return;

  const grupos = {};

  servicos.forEach(s => {
    const key = s.categoria || "Outros serviços";

    if (!grupos[key]) {
      grupos[key] = [];
    }

    grupos[key].push(s);
  });

  container.innerHTML = Object.keys(grupos).map((categoria, i) => `
  
  <h2 class="servicos-titulo-grupo">${categoria}</h2>

  <div class="servicos-wrapper">
    
    <button class="scroll-btn left" data-target="grid-${i}">‹</button>

    <div class="servicos-grid" id="grid-${i}">
      ${grupos[categoria].map((s, index) => `
        <div class="haircut">
          <img src="${s.fotoUrl || './assets/logo-salao.png'}" class="service-img">
          <div class="haircut-info">
            <strong>${s.nome}</strong>
            <a href="#">R$ ${Number(s.valor).toFixed(2)}</a>

            <button 
              class="agendar-servico-btn"
              data-nome="${s.nome}"
              data-valor="${s.valor}"
              data-tempo="${s.tempoMin || 30}"
              data-profissional-id="${s.profissionalId || ''}"
              data-profissional-nome="${s.profissionalNome || ''}"
            >
              Agendar
            </button>
          </div>
        </div>
      `).join("")}
    </div>

    <button class="scroll-btn right" data-target="grid-${i}">›</button>

  </div>

`).join("");
}

carregarServicosSite();

setTimeout(() => {
  document.querySelectorAll(".servicos-wrapper").forEach(wrapper => {
    const grid = wrapper.querySelector(".servicos-grid");
    const left = wrapper.querySelector(".left");
    const right = wrapper.querySelector(".right");

    if (grid.scrollWidth <= grid.clientWidth) {
      left.style.display = "none";
      right.style.display = "none";
    }
  });
}, 100);

document.addEventListener("click", (e) => {
  if (!e.target.classList.contains("scroll-btn")) return;

  const targetId = e.target.dataset.target;
  const grid = document.getElementById(targetId);

  if (!grid) return;

  const direction = e.target.classList.contains("right") ? 1 : -1;

  grid.scrollBy({
    left: 300 * direction,
    behavior: "smooth"
  });
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".agendar-servico-btn");

  if (!btn) return;

  const servico = {
    nome: btn.dataset.nome,
    valor: Number(btn.dataset.valor),
    tempoMin: Number(btn.dataset.tempo) || 30,
    profissionalId: btn.dataset.profissionalId || "",
    profissionalNome: btn.dataset.profissionalNome || ""
  };

  sessionStorage.setItem("servicoSelecionadoCatalogo", JSON.stringify(servico));

  window.dispatchEvent(
  new CustomEvent("servico-catalogo-selecionado", {
    detail: servico
  })
);

  const secaoAgendamento = document.querySelector("#agendamento");

  if (secaoAgendamento) {
    secaoAgendamento.scrollIntoView({
      behavior: "smooth"
    });
  }
});