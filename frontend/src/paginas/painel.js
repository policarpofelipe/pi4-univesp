import "../styles/main.css";
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
      baseline_dia_hora: "média do mesmo dia da semana e da mesma hora",
      ridge: "regressão Ridge",
      hist_gradient_boosting: "árvore de boosting",
    }[chave] || chave
  );
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
  const raiz = document.getElementById("inteligencia");
  raiz.hidden = false;
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
    return;
  }
  agora.hidden = false;
  previsao.hidden = false;
  evidencia.hidden = false;
  document.getElementById("acao-previsao").hidden = true;
  awaitDesenho.length = 0;

  document.getElementById("intro-pontos").textContent =
    "Cada ponto compara o caso com o próprio histórico. Volume alto, sozinho, não entra na lista.";
  const pontos = dados.pontos || [];
  document.getElementById("lista-pontos").innerHTML = pontos.length
    ? pontos
        .map(
          (item) => `<li class="ponto">
            <p class="ponto-tipo">${escapar(item.tipo)}</p>
            <h3>${escapar(item.titulo)}</h3>
            <p>${escapar(item.detalhe)}</p>
            <p>${escapar(item.evidencia)}</p>
          </li>`,
        )
        .join("")
    : `<li class="ponto"><p>Nenhum ponto pelas regras desta versão.</p></li>`;

  const dia = dados.ultimo_dia;
  const metodo = dados.modelo;
  const mae = metodo.metricas[metodo.publicado].mae;
  document.getElementById("aviso-agora").textContent = dados.aviso_tempo_real;
  paresLeitura(document.getElementById("leitura-agora"), [
    ["Real, 8h–19h", numero(dia.real)],
    ["Esperado, 8h–19h", decimal(dia.esperado)],
    [
      "Diferença",
      dia.desvio_percentual == null
        ? "—"
        : `${dia.desvio_percentual > 0 ? "+" : ""}${decimal(dia.desvio_percentual)}%`,
    ],
  ]);
  const folga = Math.abs(dia.real - dia.esperado);
  const faixa = mae * 12;
  const sentido =
    dia.real > dia.esperado
      ? "acima"
      : dia.real < dia.esperado
        ? "abaixo"
        : "igual";
  document.getElementById("texto-agora").textContent =
    folga > faixa
      ? `Em ${dataCurta(dia.data)}, o volume diurno ficou ${sentido} do esperado para esse dia da semana, além do erro típico de ± ${decimal(mae)} atendimentos por hora.`
      : `Em ${dataCurta(dia.data)}, a diferença entre real e esperado cabe no erro típico do método publicado (± ${decimal(mae)} atendimentos por hora, cerca de ± ${decimal(faixa)} no dia).`;

  const dias = dados.futuro_diario || [];
  const picoDia = dias.reduce((melhor, item) =>
    item.pico > melhor.pico ? item : melhor,
  );
  const acima = dias.filter((item) => item.acima_do_ritmo);
  document.getElementById("texto-previsao").textContent =
    `Horizonte: sete dias depois de ${momentoCurto(dados.fim_carga)}, não o dia corrente. ` +
    `Maior hora prevista: ${numero(picoDia.pico)} atendimentos às ${String(picoDia.pico_hora).padStart(2, "0")}h de ${dataCurta(picoDia.data)}. ` +
    (acima.length
      ? `Dias com alguma hora acima do ritmo típico: ${acima.map((item) => dataCurta(item.data)).join(", ")}.`
      : "Nenhum desses dias tem hora acima do ritmo típico da equipe.");

  const horas = dados.futuro_horario || [];
  const estouradas = horas.filter(
    (item) => item.capacidade != null && item.previsto > item.capacidade,
  );
  document.getElementById("texto-capacidade").textContent = estouradas.length
    ? `${estouradas.length} horas previstas ficam acima do ritmo × operadores típicos. A estimativa de pessoas é o teto da demanda prevista dividido por esse ritmo; a escala continua sendo uma decisão humana.`
    : "Nenhuma hora prevista supera o ritmo × operadores típicos. A escala continua sendo uma decisão humana.";

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
      .map(
        (item) => `<tr>
          <td>${escapar(dataCurta(item.data))}</td>
          <td>${escapar(decimal(item.previsto))}</td>
          <td>${escapar(decimal(item.pico))} /h</td>
          <td>${escapar(String(item.pico_hora).padStart(2, "0"))}h</td>
          <td>${item.acima_do_ritmo ? "Acima do ritmo típico" : "Dentro do ritmo típico"}</td>
        </tr>`,
      )
      .join("")}</tbody>
  </table></div>`;

  document.getElementById("tabela-horas").innerHTML =
    `<div class="tabela-envolve"><table>
    <caption>Demanda prevista e ritmo estimado, em atendimentos por hora</caption>
    <thead><tr>
      <th scope="col">Hora</th>
      <th scope="col">Previsto</th>
      <th scope="col">Ritmo da equipe típica</th>
      <th scope="col">Operadores típicos</th>
      <th scope="col">Operadores estimados</th>
      <th scope="col">Situação</th>
    </tr></thead>
    <tbody>${horas
      .map((item) => {
        const acimaHora =
          item.capacidade != null && item.previsto > item.capacidade;
        return `<tr>
          <td>${escapar(momentoCurto(item.inicio))}</td>
          <td>${escapar(decimal(item.previsto))}</td>
          <td>${escapar(decimal(item.capacidade))}</td>
          <td>${escapar(decimal(item.operadores_tipicos))}</td>
          <td>${escapar(item.operadores_estimados == null ? "—" : numero(item.operadores_estimados))}</td>
          <td>${acimaHora ? "Acima do ritmo" : "Dentro do ritmo"}</td>
        </tr>`;
      })
      .join("")}</tbody>
  </table></div>`;

  const metricas = metodo.metricas;
  paresLeitura(document.getElementById("leitura-modelo"), [
    ["Método publicado", nomeMetodo(metodo.publicado)],
    [
      "Treino",
      `${dataCurta(metodo.treino_de)} – ${dataCurta(metodo.treino_ate)}`,
    ],
    ["Teste", `${dataCurta(metodo.teste_de)} – ${dataCurta(metodo.teste_ate)}`],
    ["Erro médio publicado", `± ${decimal(mae)} atendimentos/hora`],
    [
      "Baseline",
      `± ${decimal(metricas.baseline_dia_hora.mae)} atendimentos/hora`,
    ],
    ["Ridge", `± ${decimal(metricas.ridge.mae)} atendimentos/hora`],
    [
      "Árvore de boosting",
      `± ${decimal(metricas.hist_gradient_boosting.mae)} atendimentos/hora`,
    ],
  ]);
  document.getElementById("texto-modelo").textContent =
    metodo.ml_superou_baseline
      ? `O aprendizado reduziu o erro médio em pelo menos ${numero(metodo.melhora_minima * 100)}% em relação ao baseline, na janela ${metodo.janela}. ${metodo.nota_importancia} Ritmo usado na capacidade: ${decimal(metodo.ritmo_por_operador_hora)} atendimentos por operador ativo por hora. ${metodo.regra_capacidade}`
      : `O aprendizado não reduziu o MAE em ${numero(metodo.melhora_minima * 100)}% na janela ${metodo.janela}. A previsão publicada é o baseline. ${metodo.nota_importancia} Ritmo usado na capacidade: ${decimal(metodo.ritmo_por_operador_hora)} atendimentos por operador ativo por hora. ${metodo.regra_capacidade}`;

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
          name: "Previsto",
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
          hovertemplate: "Previsto %{x}<br>%{y} /h<extra></extra>",
        },
        {
          type: "scatter",
          mode: "lines",
          name: "Ritmo da equipe típica",
          x: horas.map((item) => momentoCurto(item.inicio)),
          y: horas.map((item) => item.capacidade),
          line: { color: corCapacidade, width: 2, dash: "dot" },
          hovertemplate: "Ritmo %{x}<br>%{y} /h<extra></extra>",
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
          name: "Real",
          x: teste.map((item) => momentoCurto(item.inicio)),
          y: teste.map((item) => item.real),
          line: { color: corReal, width: 2 },
          hovertemplate: "Real %{x}<br>%{y}<extra></extra>",
        },
        {
          type: "scatter",
          mode: "lines",
          name: "Previsto",
          x: teste.map((item) => momentoCurto(item.inicio)),
          y: teste.map((item) => item.previsto),
          line: { color: corPrevisto, width: 2, dash: "dash" },
          hovertemplate: "Previsto %{x}<br>%{y}<extra></extra>",
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
    "As duas linhas usam a mesma escala de segundos.";

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
  await desenhar(
    "plot-tempos",
    [
      {
        type: "scatter",
        mode: "lines",
        name: "Espera",
        x: resumo.tempos_por_hora.map((item) => horaTexto(item.hora)),
        y: resumo.tempos_por_hora.map((item) => item.espera_media_segundos),
        line: { color: corEspera, width: 2 },
        hovertemplate: "Espera %{x}<br>%{y} s<extra></extra>",
      },
      {
        type: "scatter",
        mode: "lines",
        name: "Atendimento",
        x: resumo.tempos_por_hora.map((item) => horaTexto(item.hora)),
        y: resumo.tempos_por_hora.map(
          (item) => item.atendimento_medio_segundos,
        ),
        line: { color: corLinha, width: 2 },
        hovertemplate: "Atendimento %{x}<br>%{y} s<extra></extra>",
      },
    ],
    layoutBase({ legenda: true, margemInferior: 72 }),
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
  renderizarKpis(resumo.kpis);
  renderizarTabela(
    "tabela-operadores",
    resumo.operadores,
    "Nenhum operador neste recorte.",
  );
  renderizarTabela(
    "tabela-contatos",
    resumo.contatos,
    "Nenhum contato neste recorte.",
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

iniciar();
