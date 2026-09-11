import "./styles/main.css";
import { obterStatusBackend, obterStatusBanco } from "./api/client.js";

function definirEstado(item, saida, estado, texto) {
  item.dataset.estado = estado;
  saida.textContent = texto;
}

async function atualizarStatus() {
  const itemBackend = document.getElementById("item-backend");
  const itemBanco = document.getElementById("item-banco");
  const saidaBackend = document.getElementById("backend");
  const saidaBanco = document.getElementById("banco");

  definirEstado(
    itemBackend,
    saidaBackend,
    "carregando",
    "Carregando — verificando backend…",
  );
  definirEstado(
    itemBanco,
    saidaBanco,
    "carregando",
    "Carregando — verificando banco…",
  );

  try {
    const backend = await obterStatusBackend();
    definirEstado(
      itemBackend,
      saidaBackend,
      "ok",
      `OK — ${backend.status} | ${backend.backend} | Python ${backend.python}`,
    );
  } catch (erro) {
    definirEstado(itemBackend, saidaBackend, "erro", `Erro — ${erro.message}`);
  }

  try {
    const banco = await obterStatusBanco();
    definirEstado(
      itemBanco,
      saidaBanco,
      "ok",
      `OK — ${banco.status} | ${banco.servidor} | ${banco.versao}`,
    );
  } catch (erro) {
    definirEstado(itemBanco, saidaBanco, "erro", `Erro — ${erro.message}`);
  }
}

document.getElementById("atualizar-status").addEventListener("click", () => {
  atualizarStatus();
});

atualizarStatus();
