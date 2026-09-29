import { getJson } from "./client.js";

function consulta(caminho, filtros) {
  const params = new URLSearchParams();
  Object.entries(filtros || {}).forEach(([chave, valor]) => {
    if (valor) {
      params.set(chave, valor);
    }
  });
  const texto = params.toString();
  return getJson(texto ? `${caminho}?${texto}` : caminho);
}

export function obterMetaAnalise() {
  return getJson("/api/analise/meta");
}

export function obterResumoAnalise(filtros) {
  return consulta("/api/analise/resumo", filtros);
}
