import "../styles/main.css";
import { sair, usuarioAtual } from "../api/autenticacao.js";

const nomeEl = document.getElementById("nome-usuario");
const perfilEl = document.getElementById("perfil-usuario");
const convitesEl = document.getElementById("acesso-convites");
const botaoSair = document.getElementById("botao-sair");
const aviso = document.getElementById("aviso-painel");

async function iniciar() {
  try {
    const usuario = await usuarioAtual();
    nomeEl.textContent = usuario.nome;
    perfilEl.textContent = usuario.perfil;
    if (usuario.perfil === "mestre") {
      convitesEl.hidden = false;
    }
  } catch {
    window.location.href = "/";
  }
}

botaoSair.addEventListener("click", async () => {
  aviso.hidden = false;
  aviso.textContent = "Encerrando sessão…";
  try {
    await sair();
  } finally {
    window.location.href = "/";
  }
});

iniciar();
