import "../styles/main.css";
import { aceitarConvite, validarConvite } from "../api/convites.js";

const aviso = document.getElementById("aviso-convite");
const formulario = document.getElementById("form-aceite");
const blocoInvalido = document.getElementById("bloco-invalido");
const blocoFormulario = document.getElementById("bloco-formulario");
const blocoSucesso = document.getElementById("bloco-sucesso");
const nomeEl = document.getElementById("nome-convidado");
const emailEl = document.getElementById("email-convidado");

function mostrarAviso(texto, estado) {
  aviso.hidden = false;
  aviso.dataset.estado = estado;
  aviso.textContent = texto;
}

function lerToken() {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return params.get("token") || "";
}

async function iniciar() {
  const token = lerToken();
  history.replaceState(null, "", window.location.pathname);
  if (!token) {
    blocoInvalido.hidden = false;
    return;
  }
  try {
    const dados = await validarConvite(token);
    if (!dados.valido) {
      blocoInvalido.hidden = false;
      return;
    }
    nomeEl.textContent = dados.nome;
    emailEl.textContent = dados.email;
    blocoFormulario.hidden = false;
    formulario.dataset.token = token;
  } catch {
    blocoInvalido.hidden = false;
  }
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const token = formulario.dataset.token;
  const dados = new FormData(formulario);
  const senha = dados.get("senha");
  const confirmacao = dados.get("confirmacao");
  if (senha !== confirmacao) {
    mostrarAviso("Erro — as senhas não coincidem.", "erro");
    return;
  }
  mostrarAviso("Enviando — aguarde…", "carregando");
  try {
    await aceitarConvite(token, senha, confirmacao);
    blocoFormulario.hidden = true;
    blocoSucesso.hidden = false;
    aviso.hidden = true;
  } catch (erro) {
    mostrarAviso(`Erro — ${erro.message}`, "erro");
  }
});

iniciar();
