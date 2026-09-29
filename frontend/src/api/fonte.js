import { getJson, postArquivo } from "./client.js";

export function obterFonte() {
  return getJson("/api/fonte");
}

export function importarFonte(arquivo) {
  return postArquivo("/api/fonte/importar", "arquivo", arquivo);
}
