import { getJson, postJson } from "./client.js";

export function criarConvite(nome, email) {
  return postJson("/api/convites", { nome, email });
}

export function listarConvites() {
  return getJson("/api/convites");
}

export function validarConvite(token) {
  return postJson("/api/convites/validar", { token });
}

export function aceitarConvite(token, senha, confirmacao_senha) {
  return postJson("/api/convites/aceitar", {
    token,
    senha,
    confirmacao_senha,
  });
}
