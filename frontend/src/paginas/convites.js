import "../styles/main.css";
import { usuarioAtual } from "../api/autenticacao.js";
import { criarConvite, listarConvites } from "../api/convites.js";

const aviso = document.getElementById("aviso-convites");
const formulario = document.getElementById("form-convite");
const lista = document.getElementById("lista-convites");

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

function rotuloStatus(item) {
  if (item.status === "pendente" && item.erro_envio) {
    return "pendente (e-mail não enviado)";
  }
  if (item.status === "pendente" && item.email_enviado) {
    return "pendente (e-mail enviado)";
  }
  return item.status;
}

function formatarData(iso) {
  if (!iso) {
    return "—";
  }
  return iso.replace("T", " ").replace("Z", " UTC");
}

function renderizar(convites) {
  if (!convites.length) {
    lista.innerHTML = "<p>Nenhum convite ainda.</p>";
    return;
  }
  const linhas = convites
    .map(
      (item) => `<tr>
        <td>${escapar(item.nome)}</td>
        <td>${escapar(item.email)}</td>
        <td>${escapar(formatarData(item.criado_em))}</td>
        <td>${escapar(formatarData(item.expira_em))}</td>
        <td>${escapar(rotuloStatus(item))}</td>
      </tr>`,
    )
    .join("");
  lista.innerHTML = `<table>
    <caption>Convites recentes</caption>
    <thead>
      <tr>
        <th scope="col">Nome</th>
        <th scope="col">E-mail</th>
        <th scope="col">Criado em</th>
        <th scope="col">Expira em</th>
        <th scope="col">Status</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>`;
}

async function carregarLista() {
  const convites = await listarConvites();
  renderizar(convites);
}

async function iniciar() {
  try {
    const usuario = await usuarioAtual();
    if (usuario.perfil !== "mestre") {
      document.getElementById("conteudo").innerHTML =
        "<p>Acesso negado. Esta área é restrita ao perfil mestre.</p>";
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
  }
});

iniciar();
