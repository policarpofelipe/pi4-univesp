import "../styles/main.css";
import { aceitarConvite, validarConvite } from "../api/convites.js";

const aviso = document.getElementById("aviso-convite");
const formulario = document.getElementById("form-aceite");
const blocoCarregando = document.getElementById("bloco-carregando");
const blocoInvalido = document.getElementById("bloco-invalido");
const blocoExpirado = document.getElementById("bloco-expirado");
const blocoUtilizado = document.getElementById("bloco-utilizado");
const blocoErro = document.getElementById("bloco-erro");
const blocoFormulario = document.getElementById("bloco-formulario");
const blocoSucesso = document.getElementById("bloco-sucesso");
const nomeEl = document.getElementById("nome-convidado");
const emailEl = document.getElementById("email-convidado");
const botao = formulario.querySelector('button[type="submit"]');

function ocultarEstados() {
  blocoCarregando.hidden = true;
  blocoInvalido.hidden = true;
  blocoExpirado.hidden = true;
  blocoUtilizado.hidden = true;
  blocoErro.hidden = true;
  blocoFormulario.hidden = true;
  blocoSucesso.hidden = true;
}

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
  ocultarEstados();
  if (!token) {
    blocoInvalido.hidden = false;
    return;
  }
  blocoCarregando.hidden = false;
  try {
    const dados = await validarConvite(token);
    ocultarEstados();
    if (!dados.valido) {
      if (dados.motivo === "expirado") {
        blocoExpirado.hidden = false;
      } else if (dados.motivo === "utilizado") {
        blocoUtilizado.hidden = false;
      } else {
        blocoInvalido.hidden = false;
      }
      return;
    }
    nomeEl.textContent = dados.nome;
    emailEl.textContent = dados.email;
    blocoFormulario.hidden = false;
    formulario.dataset.token = token;
  } catch {
    ocultarEstados();
    blocoErro.hidden = false;
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
  botao.disabled = true;
  mostrarAviso("Enviando — aguarde…", "carregando");
  try {
    await aceitarConvite(token, senha, confirmacao);
    ocultarEstados();
    blocoSucesso.hidden = false;
  } catch (erro) {
    mostrarAviso(`Erro — ${erro.message}`, "erro");
    botao.disabled = false;
  }
});

iniciar();
