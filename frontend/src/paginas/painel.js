import "../styles/main.css";
import { iniciarAcessibilidade } from "../acessibilidade.js";
import Plotly from "plotly.js-dist-min";
import {
  obterInteligencia,
  obterMetaAnalise,
  obterResumoAnalise,
  treinarInteligencia,
} from "../api/analise.js";
import { sair, usuarioAtual } from "../api/autenticacao.js";

const nomeEl = document.getElementById("nome-usuario");
const perfilEl = document.getElementById("perfil-usuario");
const navConvites = document.getElementById("nav-convites");
const botaoSair = document.getElementById("botao-sair");
const aviso = document.getElementById("aviso-painel");
const formulario = document.getElementById("form-filtros");
const analise = document.getElementById("analise");
const botaoAplicar = document.getElementById("aplicar-filtros");
const botaoLimpar = document.getElementById("limpar-filtros");
const reduzirMovimento = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

let meta = null;
let ultimoResumo = null;
let ultimaInteligencia = null;

function token(nome) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(nome)
    .trim();
}

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

function decimal(valor) {
  if (valor == null) {
    return "—";
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(valor);
}

function duracao(segundos) {
  if (segundos == null) {
    return "—";
  }
  const total = Math.round(segundos);
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  if (minutos === 0) {
    return `${resto} s`;
  }
  return `${minutos} min ${resto} s`;
}

function horaTexto(hora) {
  return `${String(hora).padStart(2, "0")}h`;
}

function preencherSelect(id, valores) {
  const select = document.getElementById(id);
  const atual = select.value;
  select.replaceChildren(select.querySelector("option"));
  valores.forEach((valor) => {
    const opcao = document.createElement("option");
    opcao.value = valor;
    opcao.textContent = valor;
    select.append(opcao);
  });
  if (valores.includes(atual)) {
    select.value = atual;
  }
}

function filtrosDoFormulario() {
  const dados = new FormData(formulario);
  return {
    de: dados.get("de"),
    ate: dados.get("ate"),
    origem: dados.get("origem"),
    conexao: dados.get("conexao"),
    setores: dados.get("setores"),
    user_id: dados.get("user_id"),
    rating: dados.get("rating"),
  };
}

function aplicarPeriodoPadrao() {
  document.getElementById("filtro-de").value = meta?.de || "";
  document.getElementById("filtro-ate").value = meta?.ate || "";
  [
    "filtro-origem",
    "filtro-conexao",
    "filtro-setores",
    "filtro-operador",
    "filtro-rating",
  ].forEach((id) => {
    document.getElementById(id).value = "";
  });
}

function layoutBase({ legenda = false, margemInferior = 48 } = {}) {
  const grade = token("--color-border");
  const texto = token("--color-text");
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: token("--font-sans"), color: texto, size: 13 },
    margin: { t: 8, r: 16, b: margemInferior, l: 52 },
    autosize: true,
    showlegend: legenda,
    legend: { orientation: "h", y: -0.25 },
    transition: { duration: reduzirMovimento ? 0 : 0 },
    xaxis: { gridcolor: grade, zeroline: false, automargin: true },
    yaxis: { gridcolor: grade, zeroline: false, automargin: true },
  };
}

const configPlot = {
  responsive: true,
  displayModeBar: false,
};

function desenhar(id, data, layout) {
  const el = document.getElementById(id);
  const comando = el.data ? Plotly.react : Plotly.newPlot;
  return comando(el, data, layout, configPlot);
}

function limparPlots() {
  [
    "plot-hora",
    "plot-dia",
    "plot-serie",
    "plot-calor",
    "plot-tempos",
    "plot-rating",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el.data) {
      Plotly.purge(el);
    }
  });
}

function dataCurta(iso) {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function momentoCurto(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 13)}h`;
}

function nomeMetodo(chave) {
  return (
    {
      baseline_dia_hora: "padrão histórico do mesmo dia e horário",
      ridge: "regressão Ridge",
      hist_gradient_boosting: "árvore de boosting",
    }[chave] || chave
  );
}

function aproximado(valor) {
  if (valor == null || Number.isNaN(Number(valor))) {
    return "—";
  }
  const numeroValor = Number(valor);
  if (Number.isInteger(numeroValor)) {
    return numero(numeroValor);
  }
  return decimal(numeroValor);
}

function juntar(partes) {
  if (partes.length <= 1) {
    return partes[0] || "";
  }
  if (partes.length === 2) {
    return `${partes[0]} e ${partes[1]}`;
  }
  return `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}

function faixasHoras(horas) {
  const ordenadas = [...new Set(horas)].sort((a, b) => a - b);
  if (!ordenadas.length) {
    return [];
  }
  const faixas = [];
  let inicio = ordenadas[0];
  let anterior = ordenadas[0];
  ordenadas.slice(1).forEach((hora) => {
    if (hora === anterior + 1) {
      anterior = hora;
      return;
    }
    faixas.push([inicio, anterior]);
    inicio = hora;
    anterior = hora;
  });
  faixas.push([inicio, anterior]);
  return faixas;
}

function textoFaixas(faixas) {
  return juntar(
    faixas.map(([inicio, fim]) =>
      inicio === fim ? `às ${inicio}h` : `entre ${inicio}h e ${fim}h`,
    ),
  );
}

function horaDeIso(iso) {
  return Number(iso.slice(11, 13));
}

function htmlPonto(cartao) {
  const frases = cartao.frases
    .filter(Boolean)
    .map((frase) => `<p>${escapar(frase)}</p>`)
    .join("");
  const acao = cartao.acao
    ? `<p class="ponto-acao">${escapar(cartao.acao)}</p>`
    : "";
  return `<li class="ponto">
    <p class="ponto-tipo">${escapar(cartao.tipo)}</p>
    <h3>${escapar(cartao.titulo)}</h3>
    ${frases}
    ${acao}
    <p class="ponto-evidencia">${escapar(cartao.evidencia)}</p>
  </li>`;
}

function htmlDetalhe(rotulo, cartoes) {
  if (!cartoes.length) {
    return "";
  }
  return `<details class="tabela-detalhe">
    <summary>${escapar(rotulo)}</summary>
    <ul class="lista-pontos">${cartoes.map(htmlPonto).join("")}</ul>
  </details>`;
}

function cartaoBruto(ponto) {
  return {
    tipo: ponto.tipo,
    titulo: ponto.titulo,
    frases: [ponto.detalhe],
    acao: "",
    evidencia: ponto.evidencia,
  };
}

function agruparPressao(horas) {
  const mapa = new Map();
  horas
    .filter(
      (item) => item.capacidade != null && item.previsto > item.capacidade,
    )
    .forEach((item) => {
      const dia = item.inicio.slice(0, 10);
      const lista = mapa.get(dia) || [];
      lista.push(item);
      mapa.set(dia, lista);
    });
  return [...mapa.entries()].map(([dia, lista]) => {
    const maior = lista.reduce((atual, item) =>
      item.previsto - item.capacidade > atual.previsto - atual.capacidade
        ? item
        : atual,
    );
    return {
      dia,
      lista,
      maior,
      folga: maior.previsto - maior.capacidade,
    };
  });
}

function cartaoCapacidade(grupo, principal) {
  const pico = grupo.lista.reduce((atual, item) =>
    item.previsto > atual.previsto ? item : atual,
  );
  const hora = horaDeIso(pico.inicio);
  const periodos = faixasHoras(
    grupo.lista.map((item) => horaDeIso(item.inicio)),
  );
  const faixas = textoFaixas(periodos);
  const equipe = pico.operadores_tipicos;
  const estimada = pico.operadores_estimados;
  return {
    tipo: "! Risco de pressão na equipe",
    titulo: `${dataCurta(grupo.dia)} merece atenção ${faixas}`,
    frases: [
      principal
        ? "Este é o dia com a maior diferença entre a demanda prevista e a capacidade habitual."
        : "",
      `Em ${dataCurta(grupo.dia)} às ${hora}h, a previsão indica cerca de ${aproximado(pico.previsto)} atendimentos por hora.`,
      equipe == null
        ? ""
        : `Nesse horário, a operação costuma contar com cerca de ${aproximado(equipe)} pessoas.`,
      estimada == null
        ? ""
        : `Para acompanhar essa demanda considerando o ritmo histórico, a estimativa é de aproximadamente ${numero(estimada)} pessoas.`,
      periodos.length > 1
        ? "Esse dia concentra mais de um período em que a demanda prevista supera a capacidade habitual estimada."
        : "",
    ],
    acao: "Avaliar reforço de capacidade nesse horário. A escala continua sendo uma decisão humana.",
    evidencia: `Demanda prevista: ${aproximado(pico.previsto)} por hora. Capacidade habitual estimada: ${aproximado(pico.capacidade)} por hora.`,
  };
}

function lerEspera(ponto) {
  const espera = ponto.evidencia.match(
    /Espera:\s*(\d+)\s*s contra\s*(\d+)\s*s/,
  );
  if (!espera) {
    return null;
  }
  const atendimento = ponto.evidencia.match(
    /Atendimento, no mesmo recorte:\s*(\d+)\s*s contra\s*(\d+)\s*s/,
  );
  return {
    depois: Number(espera[1]),
    antes: Number(espera[2]),
    atendimentoDepois: atendimento ? Number(atendimento[1]) : null,
    atendimentoAntes: atendimento ? Number(atendimento[2]) : null,
  };
}

function cartaoEspera(ponto) {
  const lido = lerEspera(ponto);
  if (!lido) {
    return cartaoBruto(ponto);
  }
  const frases = [
    `Nas últimas duas semanas, a espera média passou de ${duracao(lido.antes)} para ${duracao(lido.depois)}.`,
  ];
  if (lido.atendimentoAntes != null && lido.atendimentoDepois != null) {
    frases.push(
      `O tempo de atendimento passou de ${duracao(lido.atendimentoAntes)} para ${duracao(lido.atendimentoDepois)}.`,
    );
    const razaoEspera = lido.antes ? lido.depois / lido.antes : null;
    const razaoAtendimento = lido.atendimentoAntes
      ? lido.atendimentoDepois / lido.atendimentoAntes
      : null;
    if (razaoEspera != null && razaoAtendimento != null) {
      if (razaoEspera > razaoAtendimento) {
        frases.push(
          "A maior mudança observada está no tempo de espera, antes do início do atendimento.",
        );
      } else if (razaoAtendimento > razaoEspera) {
        frases.push(
          "A maior mudança observada está no tempo de atendimento, não na espera.",
        );
      }
    }
  }
  return {
    tipo: "! Tempo de espera",
    titulo:
      lido.antes && lido.depois >= lido.antes * 2
        ? "O tempo de espera mais que dobrou"
        : "O tempo de espera subiu",
    frases,
    acao: "Acompanhar a espera antes do início do atendimento.",
    evidencia: `Espera: ${duracao(lido.depois)} contra ${duracao(lido.antes)}.${
      lido.atendimentoAntes == null
        ? ""
        : ` Atendimento: ${duracao(lido.atendimentoDepois)} contra ${duracao(lido.atendimentoAntes)}.`
    }`,
  };
}

function lerCliente(ponto) {
  const recente = ponto.evidencia.match(
    /Últimos 14 dias da carga:\s*(\d+)\s*atendimentos\s*\(([\d.]+)\/semana\)/,
  );
  const anterior = ponto.evidencia.match(
    /Período anterior:\s*(\d+)\s*\(([\d.]+)\/semana\)/,
  );
  if (!recente || !anterior) {
    return null;
  }
  return {
    contato: ponto.titulo,
    recentes: Number(recente[1]),
    taxaRecente: Number(recente[2]),
    anteriores: Number(anterior[1]),
    taxaAnterior: Number(anterior[2]),
  };
}

function cartaoCliente(ponto) {
  const lido = lerCliente(ponto);
  if (!lido) {
    return cartaoBruto(ponto);
  }
  return {
    tipo: "! Procura do contato",
    titulo: `${lido.contato} aumentou a procura pelo suporte`,
    frases: [
      `Nas últimas duas semanas, registrou cerca de ${aproximado(lido.taxaRecente)} atendimentos por semana.`,
      `Antes, o ritmo desse contato era próximo de ${aproximado(lido.taxaAnterior)} por semana.`,
    ],
    acao: "Vale investigar se existe recorrência ainda não resolvida. Isso não confirma a causa.",
    evidencia: `${numero(lido.recentes)} atendimentos nas últimas duas semanas, contra ${numero(lido.anteriores)} no período anterior.`,
  };
}

function lerDesvio(ponto) {
  const valores = ponto.evidencia.match(
    /Real:\s*(\d+(?:\.\d+)?)\.\s*Esperado pelo baseline:\s*(\d+(?:\.\d+)?)\.\s*Diferença:\s*(\d+(?:\.\d+)?)/,
  );
  if (!valores) {
    return null;
  }
  const [dia, hora] = ponto.titulo.split(" ");
  return {
    quando: hora ? `${dia} às ${hora}` : ponto.titulo,
    real: Number(valores[1]),
    esperado: Number(valores[2]),
    folga: Number(valores[3]),
  };
}

function cartaoDesvio(ponto) {
  const lido = lerDesvio(ponto);
  if (!lido) {
    return cartaoBruto(ponto);
  }
  return {
    tipo: "! Volume acima do padrão",
    titulo: `${lido.quando} ficou acima do padrão daquela hora`,
    frases: [
      `Nesse horário do período de teste, houve ${aproximado(lido.real)} atendimentos. O padrão histórico indicava cerca de ${aproximado(lido.esperado)}.`,
    ],
    acao: "Acompanhar se esse horário volta a se repetir. A diferença, sozinha, não explica a causa.",
    evidencia: `Registrado: ${aproximado(lido.real)}. Padrão histórico: ${aproximado(lido.esperado)}. Diferença: ${aproximado(lido.folga)}.`,
  };
}

function sinteses(dados) {
  const pontos = dados.pontos || [];
  const grupos = agruparPressao(dados.futuro_horario || []);
  const porFolga = [...grupos].sort((a, b) => b.folga - a.folga);
  const espera = pontos.filter((item) => item.tipo === "Tempo");
  const clientes = pontos.filter((item) => item.tipo === "Cliente");
  const desvios = pontos.filter((item) => item.tipo === "Desvio");
  const principais = [];
  const detalhes = [];
  if (porFolga.length) {
    principais.push(cartaoCapacidade(porFolga[0], true));
    const outrosDias = grupos.filter((item) => item.dia !== porFolga[0].dia);
    if (outrosDias.length) {
      detalhes.push(
        htmlDetalhe(
          `Ver os outros dias com demanda acima da capacidade habitual (${outrosDias.length})`,
          outrosDias.map((item) => cartaoCapacidade(item, false)),
        ),
      );
    }
  } else {
    const brutos = pontos.filter((item) => item.tipo === "Capacidade");
    if (brutos.length) {
      principais.push(cartaoBruto(brutos[0]));
      if (brutos.length > 1) {
        detalhes.push(
          htmlDetalhe(
            `Ver os outros dias em atenção (${brutos.length - 1})`,
            brutos.slice(1).map(cartaoBruto),
          ),
        );
      }
    }
  }
  if (espera[0]) {
    principais.push(cartaoEspera(espera[0]));
  }
  if (clientes[0]) {
    principais.push(cartaoCliente(clientes[0]));
  }
  if (clientes.length > 1) {
    detalhes.push(
      htmlDetalhe(
        `Ver os outros contatos em atenção (${clientes.length - 1})`,
        clientes.slice(1).map(cartaoCliente),
      ),
    );
  }
  if (desvios[0]) {
    principais.push(cartaoDesvio(desvios[0]));
  }
  if (desvios.length > 1) {
    detalhes.push(
      htmlDetalhe(
        `Ver os outros horários acima do padrão histórico (${desvios.length - 1})`,
        desvios.slice(1).map(cartaoDesvio),
      ),
    );
  }
  return { principais, detalhes, maior: porFolga[0]?.maior || null };
}

function paresLeitura(destino, pares) {
  destino.innerHTML = pares
    .map(
      ([rotulo, valor]) =>
        `<div><dt>${escapar(rotulo)}</dt><dd>${escapar(valor)}</dd></div>`,
    )
    .join("");
}

function renderizarInteligencia(dados) {
  ultimaInteligencia = dados;
  const raiz = document.getElementById("inteligencia");
  raiz.hidden = false;
  document.getElementById("secao-pontos").hidden = false;
  const agora = document.getElementById("secao-agora");
  const previsao = document.getElementById("secao-previsao");
  const evidencia = document.getElementById("secao-evidencia");
  if (!dados.disponivel) {
    agora.hidden = true;
    previsao.hidden = true;
    evidencia.hidden = true;
    document.getElementById("acao-previsao").hidden = Boolean(dados.erro);
    document.getElementById("intro-pontos").textContent = dados.erro
      ? dados.motivo
      : "A previsão ainda não foi treinada. O treino usa os atendimentos já gravados e leva alguns segundos.";
    document.getElementById("lista-pontos").replaceChildren();
    document.getElementById("detalhes-pontos").replaceChildren();
    return;
  }
  agora.hidden = false;
  previsao.hidden = false;
  evidencia.hidden = false;
  document.getElementById("acao-previsao").hidden = true;
  awaitDesenho.length = 0;

  document.getElementById("intro-pontos").textContent =
    "Cada leitura compara o caso com o próprio histórico. Volume alto, sozinho, não entra na lista.";
  const leitura = sinteses(dados);
  document.getElementById("lista-pontos").innerHTML = leitura.principais.length
    ? leitura.principais.map(htmlPonto).join("")
    : `<li class="ponto"><p>Nada nesta carga passou das comparações já definidas com o próprio histórico.</p></li>`;
  document.getElementById("detalhes-pontos").innerHTML =
    leitura.detalhes.join("");

  const dia = dados.ultimo_dia;
  const metodo = dados.modelo;
  const mae = metodo.metricas[metodo.publicado].mae;
  const fim = dados.fim_carga;
  document.getElementById("aviso-agora").textContent =
    `Último período disponível: ${dataCurta(fim)} até ${fim.slice(11, 13)}h. A leitura abaixo usa o último dia disponível na base, não o dia de hoje.`;
  paresLeitura(document.getElementById("leitura-agora"), [
    ["Registrado, 8h–19h", numero(dia.real)],
    ["Padrão histórico, 8h–19h", aproximado(dia.esperado)],
    [
      "Diferença",
      dia.desvio_percentual == null
        ? "—"
        : `${dia.desvio_percentual > 0 ? "+" : ""}${decimal(dia.desvio_percentual)}%`,
    ],
  ]);
  const folga = Math.abs(dia.real - dia.esperado);
  const faixa = mae == null ? null : mae * 12;
  const acimaDia = dia.real > dia.esperado;
  const abaixoDia = dia.real < dia.esperado;
  const compativel = faixa != null && folga <= faixa;
  let conclusaoAgora =
    "O volume ficou alinhado ao esperado para esse dia da semana.";
  if (acimaDia && compativel) {
    conclusaoAgora =
      "Movimento acima do esperado, mas sem evidência suficiente de anormalidade.";
  } else if (abaixoDia && compativel) {
    conclusaoAgora =
      "Movimento abaixo do esperado, mas sem evidência suficiente de anormalidade.";
  } else if (acimaDia && faixa != null) {
    conclusaoAgora =
      "O volume ficou acima do esperado, além do erro que esse método costuma apresentar.";
  } else if (abaixoDia && faixa != null) {
    conclusaoAgora =
      "O volume ficou abaixo do esperado, além do erro que esse método costuma apresentar.";
  }
  document.getElementById("texto-agora").textContent = conclusaoAgora;
  const percentual =
    dia.desvio_percentual == null
      ? ""
      : `${dia.desvio_percentual > 0 ? "+" : ""}${decimal(dia.desvio_percentual)}%`;
  document.getElementById("texto-agora-detalhe").textContent =
    `Em ${dataCurta(dia.data)} foram registrados ${numero(dia.real)} atendimentos entre 8h e 19h. O histórico indicava aproximadamente ${aproximado(dia.esperado)}.${
      percentual
        ? compativel
          ? ` Apesar da diferença de ${percentual}, essa variação ainda é compatível com o erro normalmente observado no método de previsão.`
          : ` A diferença de ${percentual} é maior do que o erro que esse método costuma apresentar nesse tipo de dia. Isso não prova uma causa.`
        : ""
    }`;
  document.getElementById("texto-agora-nota").textContent =
    mae == null
      ? "Não há erro médio publicado para comparar este dia."
      : `Erro médio observado nesse método: cerca de ${aproximado(mae)} atendimentos por hora. A comparação do dia usa esse erro nas 12 horas de operação. Não é um intervalo de confiança.`;

  const dias = dados.futuro_diario || [];
  const horas = dados.futuro_horario || [];
  const estouradas = horas.filter(
    (item) => item.capacidade != null && item.previsto > item.capacidade,
  );
  if (!dias.length) {
    document.getElementById("texto-previsao").textContent =
      "Não há dias previstos neste resultado.";
  } else {
    const picoDia = dias.reduce((melhor, item) =>
      item.pico > melhor.pico ? item : melhor,
    );
    const acima = dias.filter((item) => item.acima_do_ritmo);
    document.getElementById("texto-previsao").textContent =
      `Maior pressão prevista: ${dataCurta(picoDia.data)}. ` +
      `O maior pico dos sete dias seguintes ao fim da base está previsto para aproximadamente ${picoDia.pico_hora}h, com cerca de ${aproximado(picoDia.pico)} atendimentos por hora. ` +
      (acima.length
        ? "Esse horizonte tem dias em que a demanda prevista supera a capacidade habitual estimada. "
        : "Nenhum desses dias tem hora com demanda prevista acima da capacidade habitual estimada. ") +
      `A leitura não é o dia de hoje. O horizonte começa depois de ${momentoCurto(dados.fim_carga)}.`;
  }
  document.getElementById("texto-capacidade").textContent = estouradas.length
    ? `${numero(estouradas.length)} horas previstas ficam acima da capacidade habitual estimada. A quantidade de pessoas é uma estimativa a partir do ritmo histórico, não uma escala definida.`
    : "Nenhuma hora prevista supera a capacidade habitual estimada. A escala continua sendo uma decisão humana.";

  document.getElementById("tabela-dias").innerHTML =
    `<div class="tabela-envolve"><table>
    <caption>Volume previsto por dia, em atendimentos, e a hora de maior demanda</caption>
    <thead><tr>
      <th scope="col">Dia</th>
      <th scope="col">Volume previsto</th>
      <th scope="col">Pico</th>
      <th scope="col">Hora do pico</th>
      <th scope="col">Situação</th>
    </tr></thead>
    <tbody>${dias
      .map((item) => {
        const maiorDia =
          leitura.maior && item.data === leitura.maior.inicio.slice(0, 10);
        let situacao = "Dentro da capacidade habitual";
        if (item.acima_do_ritmo && maiorDia) {
          situacao = "▲ Maior diferença: demanda acima da capacidade habitual";
        } else if (item.acima_do_ritmo) {
          situacao = "▲ Demanda acima da capacidade habitual";
        }
        return `<tr>
          <td>${escapar(dataCurta(item.data))}</td>
          <td>${escapar(decimal(item.previsto))}</td>
          <td>${escapar(decimal(item.pico))} /h</td>
          <td>${escapar(String(item.pico_hora).padStart(2, "0"))}h</td>
          <td>${escapar(situacao)}</td>
        </tr>`;
      })
      .join("")}</tbody>
  </table></div>`;

  document.getElementById("tabela-horas").innerHTML =
    `<div class="tabela-envolve"><table>
    <caption>Demanda prevista e capacidade habitual estimada, em atendimentos por hora</caption>
    <thead><tr>
      <th scope="col">Hora</th>
      <th scope="col">Demanda prevista</th>
      <th scope="col">Capacidade habitual estimada</th>
      <th scope="col">Equipe habitual</th>
      <th scope="col">Equipe estimada para a demanda</th>
      <th scope="col">Situação</th>
    </tr></thead>
    <tbody>${horas
      .map((item) => {
        const acimaHora =
          item.capacidade != null && item.previsto > item.capacidade;
        const maiorHora = leitura.maior && item.inicio === leitura.maior.inicio;
        let situacao = "Dentro da capacidade habitual";
        if (acimaHora && maiorHora) {
          situacao = "▲ Maior diferença: demanda acima da capacidade habitual";
        } else if (acimaHora) {
          situacao = "▲ Demanda acima da capacidade habitual";
        }
        return `<tr>
          <td>${escapar(momentoCurto(item.inicio))}</td>
          <td>${escapar(decimal(item.previsto))}</td>
          <td>${escapar(decimal(item.capacidade))}</td>
          <td>${escapar(decimal(item.operadores_tipicos))}</td>
          <td>${escapar(item.operadores_estimados == null ? "—" : numero(item.operadores_estimados))}</td>
          <td>${escapar(situacao)}</td>
        </tr>`;
      })
      .join("")}</tbody>
  </table></div>`;

  const metricas = metodo.metricas;
  paresLeitura(document.getElementById("leitura-modelo"), [
    ["Método usado na previsão", nomeMetodo(metodo.publicado)],
    [
      "Treino",
      `${dataCurta(metodo.treino_de)} – ${dataCurta(metodo.treino_ate)}`,
    ],
    ["Teste", `${dataCurta(metodo.teste_de)} – ${dataCurta(metodo.teste_ate)}`],
    ["Erro médio da previsão", `cerca de ${aproximado(mae)} atendimentos/hora`],
    [
      "Padrão histórico",
      `cerca de ${aproximado(metricas.baseline_dia_hora.mae)} atendimentos/hora`,
    ],
    ["Ridge", `cerca de ${aproximado(metricas.ridge.mae)} atendimentos/hora`],
    [
      "Árvore de boosting",
      `cerca de ${aproximado(metricas.hist_gradient_boosting.mae)} atendimentos/hora`,
    ],
  ]);
  document.getElementById("texto-modelo").textContent =
    metodo.ml_superou_baseline
      ? `O método usado na previsão reduziu o erro de forma relevante em relação ao padrão histórico do mesmo dia da semana e horário. Erro médio observado: aproximadamente ${aproximado(mae)} atendimentos por hora.`
      : `Testamos modelos de aprendizado de máquina, mas eles ainda não melhoraram a previsão de forma relevante. Por enquanto, o método mais confiável continua sendo o padrão histórico do mesmo dia da semana e horário. Erro médio observado: aproximadamente ${aproximado(mae)} atendimentos por hora.`;
  const importancia = metodo.importancia?.length
    ? ` Associação mais forte na previsão publicada: ${metodo.importancia
        .map((item) => `${item.variavel} (${decimal(item.importancia)})`)
        .join(", ")}. Isso mede associação, não causa.`
    : "";
  document.getElementById("nota-metodologia").textContent =
    `O aprendizado só substitui o padrão histórico se o erro médio cair pelo menos ${numero(metodo.melhora_minima * 100)}% entre 8h e 19h. ${metodo.nota_importancia} Capacidade habitual estimada: cerca de ${aproximado(metodo.ritmo_por_operador_hora)} atendimentos por pessoa ativa por hora, vezes a equipe habitual daquela hora. Não é a escala decidida nem um limite máximo.${importancia}`;

  document.getElementById("lista-limites").innerHTML = (
    dados.nao_implementado || []
  )
    .map(
      (item) =>
        `<li><strong>${escapar(item.item)}.</strong> ${escapar(item.motivo)}</li>`,
    )
    .join("");

  const corReal = token("--color-identity");
  const corPrevisto = token("--color-chart-3");
  const corCapacidade = token("--color-chart-1");
  const teste = dados.teste_horario || [];
  awaitDesenho.push(
    desenhar(
      "plot-dias",
      [
        {
          type: "bar",
          name: "Demanda prevista",
          x: dias.map((item) => dataCurta(item.data)),
          y: dias.map((item) => item.previsto),
          marker: { color: corPrevisto },
          hovertemplate: "%{x}<br>%{y} atendimentos<extra></extra>",
        },
      ],
      layoutBase({ margemInferior: 64 }),
    ),
    desenhar(
      "plot-capacidade",
      [
        {
          type: "scatter",
          mode: "lines",
          name: "Demanda prevista",
          x: horas.map((item) => momentoCurto(item.inicio)),
          y: horas.map((item) => item.previsto),
          line: { color: corPrevisto, width: 2 },
          hovertemplate: "Demanda prevista %{x}<br>%{y} /h<extra></extra>",
        },
        {
          type: "scatter",
          mode: "lines",
          name: "Capacidade habitual estimada",
          x: horas.map((item) => momentoCurto(item.inicio)),
          y: horas.map((item) => item.capacidade),
          line: { color: corCapacidade, width: 2, dash: "dot" },
          hovertemplate: "Capacidade habitual %{x}<br>%{y} /h<extra></extra>",
        },
      ],
      layoutBase({ legenda: true, margemInferior: 88 }),
    ),
    desenhar(
      "plot-real",
      [
        {
          type: "scatter",
          mode: "lines",
          name: "Registrado",
          x: teste.map((item) => momentoCurto(item.inicio)),
          y: teste.map((item) => item.real),
          line: { color: corReal, width: 2 },
          hovertemplate: "Registrado %{x}<br>%{y}<extra></extra>",
        },
        {
          type: "scatter",
          mode: "lines",
          name: "Demanda prevista",
          x: teste.map((item) => momentoCurto(item.inicio)),
          y: teste.map((item) => item.previsto),
          line: { color: corPrevisto, width: 2, dash: "dash" },
          hovertemplate: "Demanda prevista %{x}<br>%{y}<extra></extra>",
        },
      ],
      layoutBase({ legenda: true, margemInferior: 88 }),
    ),
  );
}

const awaitDesenho = [];

function renderizarKpis(kpis) {
  const itens = [
    ["Volume", numero(kpis.volume)],
    ["Espera média", duracao(kpis.espera_media_segundos)],
    ["Atendimento médio", duracao(kpis.atendimento_medio_segundos)],
    ["Avaliação média", decimal(kpis.rating_medio)],
    ["Com avaliação", numero(kpis.com_rating)],
    ["Sem avaliação", numero(kpis.sem_rating)],
  ];
  document.getElementById("kpis").innerHTML = itens
    .map(
      ([rotulo, valor]) =>
        `<p class="kpi"><span class="kpi-rotulo">${escapar(rotulo)}</span><strong class="kpi-valor">${escapar(valor)}</strong></p>`,
    )
    .join("");
}

function renderizarTabela(id, linhas, vazio) {
  const destino = document.getElementById(id);
  if (!linhas.length) {
    destino.innerHTML = `<p class="cartao">${escapar(vazio)}</p>`;
    return;
  }
  const corpo = linhas
    .map(
      (item) => `<tr>
        <td>${escapar(item.nome)}</td>
        <td>${escapar(numero(item.volume))}</td>
        <td>${escapar(duracao(item.espera_media_segundos))}</td>
        <td>${escapar(duracao(item.atendimento_medio_segundos))}</td>
        <td>${escapar(decimal(item.rating_medio))}</td>
      </tr>`,
    )
    .join("");
  destino.innerHTML = `<div class="tabela-envolve"><table>
    <thead>
      <tr>
        <th scope="col">Nome</th>
        <th scope="col">Volume</th>
        <th scope="col">Espera média</th>
        <th scope="col">Atendimento médio</th>
        <th scope="col">Avaliação média</th>
      </tr>
    </thead>
    <tbody>${corpo}</tbody>
  </table></div>`;
}

async function renderizarGraficos(resumo) {
  const corBarra = token("--color-chart-3");
  const corLinha = token("--color-identity");
  const corEspera = token("--color-chart-1");
  const almoco = resumo.comparacoes.almoco;
  const apos = resumo.comparacoes.apos_20h;
  const sabado = resumo.comparacoes.sabado;
  const demais = resumo.comparacoes.demais_dias;

  document.getElementById("resumo-hora").textContent =
    `Almoço, 12h–13h: ${numero(almoco.volume)} atendimentos, espera ${duracao(almoco.espera_media_segundos)}. ` +
    `A partir das 20h: ${numero(apos.volume)}, espera ${duracao(apos.espera_media_segundos)}.`;

  const esperaSabado = duracao(sabado.espera_media_segundos);
  const esperaDemais = duracao(demais.espera_media_segundos);
  document.getElementById("resumo-dia").textContent =
    sabado.volume === 0 && demais.volume === 0
      ? ""
      : `Sábado: ${numero(sabado.volume)} atendimentos, espera ${esperaSabado}. Demais dias: ${numero(demais.volume)}, espera ${esperaDemais}.`;

  document.getElementById("resumo-serie").hidden = true;
  document.getElementById("resumo-calor").hidden = true;

  document.getElementById("resumo-tempos").textContent =
    "Espera e atendimento usam a mesma escala de tempo.";

  document.getElementById("resumo-rating").textContent =
    `${numero(resumo.kpis.sem_rating)} sem nota, fora das barras.`;

  await desenhar(
    "plot-hora",
    [
      {
        type: "bar",
        x: resumo.volume_por_hora.map((item) => horaTexto(item.hora)),
        y: resumo.volume_por_hora.map((item) => item.volume),
        marker: { color: corBarra },
        hovertemplate: "%{x}<br>%{y} atendimentos<extra></extra>",
      },
    ],
    layoutBase(),
  );
  await desenhar(
    "plot-dia",
    [
      {
        type: "bar",
        x: resumo.volume_por_dia.map((item) => item.rotulo),
        y: resumo.volume_por_dia.map((item) => item.volume),
        marker: { color: corBarra },
        hovertemplate: "%{x}<br>%{y} atendimentos<extra></extra>",
      },
    ],
    layoutBase({ margemInferior: 80 }),
  );
  await desenhar(
    "plot-serie",
    [
      {
        type: "scatter",
        mode: "lines",
        x: resumo.serie_diaria.map((item) => item.data),
        y: resumo.serie_diaria.map((item) => item.volume),
        line: { color: corLinha, width: 2 },
        hovertemplate: "%{x}<br>%{y} atendimentos<extra></extra>",
      },
    ],
    layoutBase(),
  );
  const z = [];
  for (let dia = 0; dia < 7; dia += 1) {
    const linha = [];
    for (let hora = 0; hora < 24; hora += 1) {
      linha.push(resumo.heatmap[dia * 24 + hora].volume);
    }
    z.push(linha);
  }
  await desenhar(
    "plot-calor",
    [
      {
        type: "heatmap",
        x: Array.from({ length: 24 }, (_, hora) => horaTexto(hora)),
        y: resumo.volume_por_dia.map((item) => item.rotulo),
        z,
        colorscale: [
          [0, token("--color-chart-2")],
          [1, token("--color-identity")],
        ],
        hovertemplate: "%{y} %{x}<br>%{z} atendimentos<extra></extra>",
        showscale: true,
        colorbar: { title: "Volume", thickness: 12 },
      },
    ],
    {
      ...layoutBase({ margemInferior: 80 }),
      margin: { t: 8, r: 80, b: 80, l: 110 },
    },
  );
  const layoutTempos = layoutBase({ legenda: true, margemInferior: 72 });
  layoutTempos.yaxis = { ...layoutTempos.yaxis, title: "Minutos" };
  await desenhar(
    "plot-tempos",
    [
      {
        type: "scatter",
        mode: "lines",
        name: "Espera",
        x: resumo.tempos_por_hora.map((item) => horaTexto(item.hora)),
        y: resumo.tempos_por_hora.map((item) =>
          item.espera_media_segundos == null
            ? null
            : item.espera_media_segundos / 60,
        ),
        customdata: resumo.tempos_por_hora.map((item) =>
          duracao(item.espera_media_segundos),
        ),
        line: { color: corEspera, width: 2 },
        hovertemplate: "Espera %{x}<br>%{customdata}<extra></extra>",
      },
      {
        type: "scatter",
        mode: "lines",
        name: "Atendimento",
        x: resumo.tempos_por_hora.map((item) => horaTexto(item.hora)),
        y: resumo.tempos_por_hora.map((item) =>
          item.atendimento_medio_segundos == null
            ? null
            : item.atendimento_medio_segundos / 60,
        ),
        customdata: resumo.tempos_por_hora.map((item) =>
          duracao(item.atendimento_medio_segundos),
        ),
        line: { color: corLinha, width: 2 },
        hovertemplate: "Atendimento %{x}<br>%{customdata}<extra></extra>",
      },
    ],
    layoutTempos,
  );
  await desenhar(
    "plot-rating",
    [
      {
        type: "bar",
        x: resumo.rating.map((item) => `Nota ${item.nota}`),
        y: resumo.rating.map((item) => item.volume),
        marker: { color: corBarra },
        hovertemplate: "%{x}<br>%{y} atendimentos<extra></extra>",
      },
    ],
    layoutBase(),
  );
}

async function renderizar(resumo) {
  ultimoResumo = resumo;
  renderizarKpis(resumo.kpis);
  renderizarTabela(
    "tabela-operadores",
    resumo.operadores,
    "Nenhum operador neste período.",
  );
  renderizarTabela(
    "tabela-contatos",
    resumo.contatos,
    "Nenhum contato neste período.",
  );
  const vazio = resumo.kpis.volume === 0;
  document.getElementById("vazio-analise").hidden = !vazio;
  document.getElementById("graficos-analise").hidden = vazio;
  if (vazio) {
    limparPlots();
    return;
  }
  await renderizarGraficos(resumo);
}

async function carregarResumo() {
  botaoAplicar.disabled = true;
  botaoLimpar.disabled = true;
  mostrarAviso("Carregando análise…", "carregando");
  try {
    const resumo = await obterResumoAnalise(filtrosDoFormulario());
    await renderizar(resumo);
    analise.hidden = false;
    limparAviso();
  } catch (erro) {
    mostrarAviso(`Erro — ${erro.message}`, "erro");
  } finally {
    botaoAplicar.disabled = false;
    botaoLimpar.disabled = false;
  }
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
    const [metaCarregada, inteligencia] = await Promise.all([
      obterMetaAnalise(),
      obterInteligencia().catch((erro) => ({
        disponivel: false,
        erro: true,
        motivo: erro.message,
      })),
    ]);
    meta = metaCarregada;
    renderizarInteligencia(inteligencia);
    await Promise.all(awaitDesenho);
    preencherSelect("filtro-origem", meta.origens || []);
    preencherSelect("filtro-conexao", meta.conexoes || []);
    preencherSelect("filtro-setores", meta.setores || []);
    preencherSelect("filtro-operador", meta.operadores || []);
    aplicarPeriodoPadrao();
    formulario.hidden = false;
    await carregarResumo();
  } catch (erro) {
    formulario.hidden = false;
    mostrarAviso(`Erro — ${erro.message}`, "erro");
  }
}

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();
  carregarResumo();
});

botaoLimpar.addEventListener("click", () => {
  aplicarPeriodoPadrao();
  carregarResumo();
});

async function treinarPrevisao() {
  const botoes = [
    document.getElementById("botao-treinar"),
    document.getElementById("botao-atualizar-previsao"),
  ];
  botoes.forEach((botao) => {
    botao.disabled = true;
  });
  document.getElementById("intro-pontos").textContent =
    "Treinando a previsão com os atendimentos gravados…";
  try {
    const artefato = await treinarInteligencia();
    renderizarInteligencia(artefato);
    await Promise.all(awaitDesenho);
  } catch (erro) {
    document.getElementById("intro-pontos").textContent = erro.message;
    if (document.getElementById("secao-evidencia").hidden) {
      document.getElementById("acao-previsao").hidden = false;
    }
  } finally {
    botoes.forEach((botao) => {
      botao.disabled = false;
    });
  }
}

document
  .getElementById("botao-treinar")
  .addEventListener("click", treinarPrevisao);
document
  .getElementById("botao-atualizar-previsao")
  .addEventListener("click", treinarPrevisao);

botaoSair.addEventListener("click", async () => {
  mostrarAviso("Encerrando sessão…", "carregando");
  botaoSair.disabled = true;
  try {
    await sair();
  } finally {
    window.location.href = "/";
  }
});

window.addEventListener("pi4-acessibilidade", () => {
  const pendentes = [];
  if (ultimaInteligencia?.disponivel) {
    renderizarInteligencia(ultimaInteligencia);
    pendentes.push(...awaitDesenho);
  }
  if (ultimoResumo && ultimoResumo.kpis.volume !== 0) {
    pendentes.push(renderizarGraficos(ultimoResumo));
  }
  Promise.all(pendentes);
});

iniciarAcessibilidade();
iniciar();
