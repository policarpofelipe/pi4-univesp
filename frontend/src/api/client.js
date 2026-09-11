const API_BASE = "/api";

function urlDaApi(caminho) {
  if (caminho.startsWith("/api/")) {
    return caminho;
  }
  const sufixo = caminho.startsWith("/") ? caminho : `/${caminho}`;
  return `${API_BASE}${sufixo}`;
}

async function interpretarErro(resposta) {
  try {
    const corpo = await resposta.json();
    if (typeof corpo.detail === "string") {
      return corpo.detail;
    }
  } catch {
    /* resposta não JSON */
  }
  return `A API retornou HTTP ${resposta.status}.`;
}

export async function getJson(caminho) {
  let resposta;
  try {
    resposta = await fetch(urlDaApi(caminho), {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error("Não foi possível conectar à API.");
  }
  if (!resposta.ok) {
    throw new Error(await interpretarErro(resposta));
  }
  return resposta.json();
}

export async function postJson(caminho, corpo) {
  let resposta;
  try {
    resposta = await fetch(urlDaApi(caminho), {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new Error("Não foi possível conectar à API.");
  }
  if (!resposta.ok) {
    throw new Error(await interpretarErro(resposta));
  }
  if (resposta.status === 204) {
    return null;
  }
  const texto = await resposta.text();
  return texto ? JSON.parse(texto) : null;
}

export function obterStatusBackend() {
  return getJson("/api/status");
}

export function obterStatusBanco() {
  return getJson("/api/status/banco");
}
