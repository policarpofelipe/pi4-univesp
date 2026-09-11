import { getJson, postJson } from "./client.js";

export function entrar(email, senha) {
  return postJson("/api/autenticacao/entrar", { email, senha });
}

export function usuarioAtual() {
  return getJson("/api/autenticacao/usuario-atual");
}

export function sair() {
  return postJson("/api/autenticacao/sair", {});
}
