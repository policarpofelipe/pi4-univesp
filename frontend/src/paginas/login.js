import "../styles/main.css";
import { entrar } from "../api/autenticacao.js";

const formulario = document.getElementById("form-login");
const aviso = document.getElementById("aviso-login");
const botao = formulario.querySelector('button[type="submit"]');

function mostrarAviso(texto, estado) {
  aviso.hidden = false;
  aviso.dataset.estado = estado;
  aviso.textContent = texto;
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const dados = new FormData(formulario);
  botao.disabled = true;
  mostrarAviso("Entrando — aguarde…", "carregando");
  try {
    await entrar(dados.get("email"), dados.get("senha"));
    mostrarAviso("OK — redirecionando.", "ok");
    window.location.href = "/painel.html";
  } catch (erro) {
    mostrarAviso(`Erro — ${erro.message}`, "erro");
    botao.disabled = false;
  }
});
