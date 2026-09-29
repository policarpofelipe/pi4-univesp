import "../styles/main.css";
import Plotly from "plotly.js-dist-min";
import { obterMetaAnalise, obterResumoAnalise } from "../api/analise.js";
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

const plots = [
  "plot-hora",
  "plot-dia",
  "plot-serie",
  "plot-calor",
  "plot-tempos",
  "plot-rating",
];

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
    maximumFractionDigits: 1,
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
    showlegend: legenda,
    legend: { orientation: "h", y: -0.25 },
    transition: { duration: reduzirMovimento ? 0 : 0 },
    xaxis: { gridcolor: grade, zeroline: false },
    yaxis: { gridcolor: grade, zeroline: false },
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
  plots.forEach((id) => {
    const el = document.getElementById(id);
    if (el.data) {
      Plotly.purge(el);
    }
  });
}

function maior(lista, ler) {
  return lista.reduce((melhor, item) =>
    ler(item) > ler(melhor) ? item : melhor,
  );
}

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
  const picoHora = maior(resumo.volume_por_hora, (item) => item.volume);
  const picoDia = maior(resumo.volume_por_dia, (item) => item.volume);
  const picoSerie = maior(resumo.serie_diaria, (item) => item.volume);
  const picoCalor = maior(resumo.heatmap, (item) => item.volume);
  const almoco = resumo.comparacoes.almoco;
  const apos = resumo.comparacoes.apos_20h;
  const sabado = resumo.comparacoes.sabado;
  const demais = resumo.comparacoes.demais_dias;

  document.getElementById("resumo-hora").textContent =
    `Maior volume às ${horaTexto(picoHora.hora)} (${numero(picoHora.volume)} atendimentos). ` +
    `Almoço, 12h–13h: ${numero(almoco.volume)}, espera ${duracao(almoco.espera_media_segundos)}. ` +
    `A partir das 20h: ${numero(apos.volume)}, espera ${duracao(apos.espera_media_segundos)}.`;

  document.getElementById("resumo-dia").textContent =
    `Sábado: ${numero(sabado.volume)} atendimentos, espera ${duracao(sabado.espera_media_segundos)}. ` +
    `Demais dias: ${numero(demais.volume)}, espera ${duracao(demais.espera_media_segundos)}. ` +
    `Dia com mais volume: ${picoDia.rotulo} (${numero(picoDia.volume)}).`;

  document.getElementById("resumo-serie").textContent =
    `De ${resumo.serie_diaria[0].data} a ${resumo.serie_diaria.at(-1).data}. ` +
    `Pico em ${picoSerie.data}: ${numero(picoSerie.volume)} atendimentos.`;

  document.getElementById("resumo-calor").textContent =
    `Maior concentração: ${picoCalor.rotulo} às ${horaTexto(picoCalor.hora)} ` +
    `(${numero(picoCalor.volume)} atendimentos).`;

  document.getElementById("resumo-tempos").textContent =
    `No recorte, espera média ${duracao(resumo.kpis.espera_media_segundos)} e ` +
    `atendimento médio ${duracao(resumo.kpis.atendimento_medio_segundos)}. ` +
    `As duas linhas usam a mesma escala de segundos.`;

  const notaCinco = resumo.rating.find((item) => item.nota === 5);
  document.getElementById("resumo-rating").textContent =
    `Média ${decimal(resumo.kpis.rating_medio)} entre ${numero(resumo.kpis.com_rating)} avaliados. ` +
    `${numero(resumo.kpis.sem_rating)} sem nota, fora das barras. ` +
    `Nota 5: ${numero(notaCinco.volume)}.`;

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
    meta = await obterMetaAnalise();
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
