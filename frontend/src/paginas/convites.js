import "../styles/main.css";
import { usuarioAtual } from "../api/autenticacao.js";
import {
  criarConvite,
  listarConvites,
  reenviarConvite,
} from "../api/convites.js";

const aviso = document.getElementById("aviso-convites");
const formulario = document.getElementById("form-convite");
const lista = document.getElementById("lista-convites");
const nomeEl = document.getElementById("nome-usuario");
const perfilEl = document.getElementById("perfil-usuario");
const botao = formulario.querySelector('button[type="submit"]');

function mostrarAviso(texto, estado) {
  aviso.hidden = false;
  aviso.dataset.estado = estado;
  aviso.textContent = texto;
}

function escapar(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatarData(iso) {
  if (!iso) {
    return "—";
  }
  return iso.replace("T", " ").replace("Z", " UTC");
}

function acaoReenvio(item) {
  if (item.status !== "expirado") {
    return "—";
  }
  const id = Number(item.id);
  if (!Number.isInteger(id)) {
    return "—";
  }
  return `<button type="button" class="botao botao-secundario" data-reenviar="${id}">Reenviar</button>`;
}

function renderizar(convites) {
  if (!convites.length) {
    lista.innerHTML = '<p class="cartao">Nenhum convite ainda.</p>';
    return;
  }
  const linhas = convites
    .map(
      (item) => `<tr>
        <td>${escapar(item.nome)}</td>
        <td>${escapar(item.email)}</td>
        <td>${escapar(formatarData(item.criado_em))}</td>
        <td>${escapar(formatarData(item.expira_em))}</td>
        <td><span class="status-texto">${escapar(item.status)}</span></td>
        <td>${acaoReenvio(item)}</td>
      </tr>`,
    )
    .join("");
  lista.innerHTML = `<div class="tabela-envolve"><table>
    <thead>
      <tr>
        <th scope="col">Nome</th>
        <th scope="col">E-mail</th>
        <th scope="col">Criado em</th>
        <th scope="col">Expira em</th>
        <th scope="col">Status</th>
        <th scope="col">Ação</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table></div>`;
}

async function carregarLista() {
  const convites = await listarConvites();
  renderizar(convites);
}

async function iniciar() {
  try {
    const usuario = await usuarioAtual();
    if (nomeEl) {
      nomeEl.textContent = usuario.nome;
    }
    if (perfilEl) {
      perfilEl.textContent = usuario.perfil;
    }
    if (usuario.perfil !== "mestre") {
      document.getElementById("conteudo").innerHTML =
        "<h1>Acesso negado</h1><p>Esta área é restrita ao perfil mestre.</p>";
      return;
    }
    formulario.hidden = false;
    await carregarLista();
  } catch {
    window.location.href = "/";
  }
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const dados = new FormData(formulario);
  botao.disabled = true;
  mostrarAviso("Enviando — aguarde…", "carregando");
  try {
    await criarConvite(dados.get("nome"), dados.get("email"));
    mostrarAviso("OK — convite enviado.", "ok");
    formulario.reset();
    await carregarLista();
  } catch (erro) {
    mostrarAviso(`Erro — ${erro.message}`, "erro");
    try {
      await carregarLista();
    } catch {
      /* lista opcional após erro */
    }
  } finally {
    botao.disabled = false;
  }
});

lista.addEventListener("click", async (evento) => {
  const botaoReenvio = evento.target.closest("[data-reenviar]");
  if (!botaoReenvio) {
    return;
  }
  botaoReenvio.disabled = true;
  mostrarAviso("Reenviando — aguarde…", "carregando");
  try {
    await reenviarConvite(botaoReenvio.dataset.reenviar);
    mostrarAviso("OK — convite reenviado com um link novo.", "ok");
    await carregarLista();
  } catch (erro) {
    mostrarAviso(`Erro — ${erro.message}`, "erro");
    try {
      await carregarLista();
    } catch {
      botaoReenvio.disabled = false;
    }
  }
});

iniciar();
