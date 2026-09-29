import "../styles/main.css";
import { sair, usuarioAtual } from "../api/autenticacao.js";
import { importarFonte, obterFonte } from "../api/fonte.js";

const nomeEl = document.getElementById("nome-usuario");
const perfilEl = document.getElementById("perfil-usuario");
const navConvites = document.getElementById("nav-convites");
const botaoSair = document.getElementById("botao-sair");
const aviso = document.getElementById("aviso-fonte");
const formulario = document.getElementById("form-importar");
const botaoEnviar = document.getElementById("enviar-csv");
const arquivoEl = document.getElementById("arquivo-csv");
const botaoModelo = document.getElementById("baixar-modelo");

let colunas = [];

function mostrarAviso(texto, estado) {
  aviso.hidden = false;
  aviso.dataset.estado = estado;
  aviso.textContent = texto;
}

function limparAviso() {
  aviso.hidden = true;
  aviso.textContent = "";
  delete aviso.dataset.estado;
}

function escapar(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function numero(valor) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

function periodo(fonte) {
  if (!fonte.de || !fonte.ate) {
    return "Sem registros";
  }
  return `${fonte.de} a ${fonte.ate}`;
}

function tabelaGrupo(titulo, linhas, vazio) {
  if (!linhas.length) {
    return `<section><h3>${escapar(titulo)}</h3><p class="cartao">${escapar(vazio)}</p></section>`;
  }
  const corpo = linhas
    .map(
      (item) =>
        `<tr><td>${escapar(item.nome)}</td><td>${escapar(numero(item.volume))}</td></tr>`,
    )
    .join("");
  return `<section><h3>${escapar(titulo)}</h3><div class="tabela-envolve"><table>
    <thead><tr><th scope="col">Nome</th><th scope="col">Volume</th></tr></thead>
    <tbody>${corpo}</tbody>
  </table></div></section>`;
}

function renderizar(fonte) {
  colunas = fonte.colunas;
  const indicadores = [
    ["Protocolos", numero(fonte.total)],
    ["Período", periodo(fonte)],
    ["Com avaliação", numero(fonte.com_rating)],
    ["Sem avaliação", numero(fonte.sem_rating)],
    ["Sem origem", numero(fonte.sem_origem)],
  ];
  document.getElementById("retrato-fonte").innerHTML = indicadores
    .map(
      ([rotulo, valor]) =>
        `<p class="kpi"><span class="kpi-rotulo">${escapar(rotulo)}</span><strong class="kpi-valor">${escapar(valor)}</strong></p>`,
    )
    .join("");
  document.getElementById("composicao-fonte").innerHTML = [
    tabelaGrupo("Origem", fonte.origens, "Nenhuma origem informada."),
    tabelaGrupo("Conexão", fonte.conexoes, "Nenhuma conexão informada."),
    tabelaGrupo("Setor", fonte.setores, "Nenhum setor informado."),
    tabelaGrupo("Operador", fonte.operadores, "Nenhum operador informado."),
  ].join("");
  document.getElementById("lista-colunas").textContent =
    fonte.colunas.join(", ");
}

function renderizarResultado(resultado) {
  const erros = resultado.erros
    .map(
      (item) =>
        `<li>Linha ${escapar(item.linha)}: ${escapar(item.motivo)}</li>`,
    )
    .join("");
  const duplicados = resultado.protocolos_duplicados
    .map((item) => escapar(item))
    .join(", ");
  const extraErros =
    resultado.erros_omitidos > 0
      ? `<p>Mais ${escapar(numero(resultado.erros_omitidos))} linhas inválidas não listadas.</p>`
      : "";
  const extraDuplicados = duplicados
    ? `<p>Protocolos já existentes nesta amostra: ${duplicados}.</p>`
    : "";
  document.getElementById("resultado-importacao").innerHTML =
    `<div class="cartao">
    <p>Inseridos: ${escapar(numero(resultado.inseridos))}. Já existentes: ${escapar(numero(resultado.duplicados))}. Inválidos: ${escapar(numero(resultado.invalidos))}.</p>
    ${extraDuplicados}
    ${erros ? `<ul>${erros}</ul>` : ""}
    ${extraErros}
  </div>`;
}

async function carregar() {
  const fonte = await obterFonte();
  renderizar(fonte);
}

async function iniciar() {
  try {
    const usuario = await usuarioAtual();
    nomeEl.textContent = usuario.nome;
    perfilEl.textContent = usuario.perfil;
    if (usuario.perfil === "mestre" && navConvites) {
      navConvites.hidden = false;
    }
  } catch {
    window.location.href = "/";
    return;
  }
  try {
    await carregar();
    limparAviso();
  } catch (erro) {
    mostrarAviso(`Erro — ${erro.message}`, "erro");
  }
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const arquivo = arquivoEl.files[0];
  if (!arquivo) {
    mostrarAviso("Erro — escolha um arquivo CSV.", "erro");
    return;
  }
  botaoEnviar.disabled = true;
  mostrarAviso("Importando — aguarde…", "carregando");
  try {
    const resultado = await importarFonte(arquivo);
    renderizarResultado(resultado);
    mostrarAviso("OK — importação concluída.", "ok");
    formulario.reset();
    await carregar();
  } catch (erro) {
    mostrarAviso(`Erro — ${erro.message}`, "erro");
  } finally {
    botaoEnviar.disabled = false;
  }
});

botaoModelo.addEventListener("click", () => {
  if (!colunas.length) {
    return;
  }
  const blob = new Blob([`${colunas.join(",")}\n`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-atendimentos.csv";
  link.click();
  URL.revokeObjectURL(url);
});

botaoSair.addEventListener("click", async () => {
  mostrarAviso("Encerrando sessão…", "carregando");
  botaoSair.disabled = true;
  try {
    await sair();
  } finally {
    window.location.href = "/";
  }
});

iniciar();
