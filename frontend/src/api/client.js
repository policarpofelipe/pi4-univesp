const API_BASE = "/api";

function urlDaApi(caminho) {
  if (caminho.startsWith("/api/")) {
    return caminho;
  }

  const sufixo = caminho.startsWith("/") ? caminho : `/${caminho}`;
  return `${API_BASE}${sufixo}`;
}

export async function getJson(caminho) {
  let resposta;

  try {
    resposta = await fetch(urlDaApi(caminho), {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error("Não foi possível conectar à API.");
  }

  if (!resposta.ok) {
    throw new Error(`A API retornou HTTP ${resposta.status}.`);
  }

  try {
    return await resposta.json();
  } catch {
    throw new Error("A API retornou uma resposta inválida.");
  }
}

export function obterStatusBackend() {
  return getJson("/api/status");
}

export function obterStatusBanco() {
  return getJson("/api/status/banco");
}
