const CHAVES = {
  theme: "pi4_a11y_theme",
  fontScale: "pi4_a11y_font_scale",
  fontFamily: "pi4_a11y_font_family",
  letterSpacing: "pi4_a11y_letter_spacing",
  lineHeight: "pi4_a11y_line_height",
  paragraphWidth: "pi4_a11y_paragraph_width",
  fontColor: "pi4_a11y_font_color",
};

const ESCALAS = ["sm", "md", "lg", "xl"];
const ROTULOS_ESCALA = ["Pequena", "Padrão", "Grande", "Maior"];

const PADRAO = {
  theme: "default",
  fontScale: "md",
  fontFamily: "sans",
  letterSpacing: 0,
  lineHeight: 1.5,
  paragraphWidth: 0,
  fontColor: "",
};

function ler(chave, padrao) {
  try {
    const valor = localStorage.getItem(chave);
    return valor == null || valor === "" ? padrao : valor;
  } catch {
    return padrao;
  }
}

function gravar(chave, valor) {
  try {
    if (valor === "" || valor == null) {
      localStorage.removeItem(chave);
      return;
    }
    localStorage.setItem(chave, String(valor));
  } catch {
    /* preferência visual fica só nesta visita */
  }
}

function numero(valor, padrao) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

function limitar(valor, min, max) {
  return Math.min(max, Math.max(min, valor));
}

function estadoInicial() {
  const escala = ler(CHAVES.fontScale, PADRAO.fontScale);
  return {
    theme:
      ler(CHAVES.theme, PADRAO.theme) === "high-contrast"
        ? "high-contrast"
        : "default",
    fontScale: ESCALAS.includes(escala) ? escala : PADRAO.fontScale,
    fontFamily: ["sans", "serif", "dyslexic"].includes(
      ler(CHAVES.fontFamily, "sans"),
    )
      ? ler(CHAVES.fontFamily, "sans")
      : "sans",
    letterSpacing: limitar(numero(ler(CHAVES.letterSpacing, "0"), 0), -1, 4),
    lineHeight: limitar(numero(ler(CHAVES.lineHeight, "1.5"), 1.5), 1.1, 2.2),
    paragraphWidth: limitar(numero(ler(CHAVES.paragraphWidth, "0"), 0), 0, 120),
    fontColor: ler(CHAVES.fontColor, ""),
  };
}

function aplicar(estado, emitir) {
  const root = document.documentElement;
  root.setAttribute("data-theme", estado.theme);
  root.setAttribute("data-font-scale", estado.fontScale);
  root.setAttribute("data-font-family", estado.fontFamily);
  root.style.setProperty("--a11y-letter-spacing", `${estado.letterSpacing}px`);
  root.style.setProperty("--a11y-line-height", String(estado.lineHeight));
  if (estado.paragraphWidth > 0) {
    root.setAttribute("data-paragraph-limit", "1");
    root.style.setProperty(
      "--a11y-paragraph-width",
      `${estado.paragraphWidth}ch`,
    );
  } else {
    root.removeAttribute("data-paragraph-limit");
    root.style.removeProperty("--a11y-paragraph-width");
  }
  if (estado.fontColor) {
    root.setAttribute("data-font-color", "1");
    root.style.setProperty("--a11y-font-color", estado.fontColor);
  } else {
    root.removeAttribute("data-font-color");
    root.style.removeProperty("--a11y-font-color");
  }
  gravar(CHAVES.theme, estado.theme);
  gravar(CHAVES.fontScale, estado.fontScale);
  gravar(CHAVES.fontFamily, estado.fontFamily);
  gravar(CHAVES.letterSpacing, estado.letterSpacing);
  gravar(CHAVES.lineHeight, estado.lineHeight);
  gravar(CHAVES.paragraphWidth, estado.paragraphWidth);
  gravar(CHAVES.fontColor, estado.fontColor);
  if (emitir) {
    window.dispatchEvent(new Event("pi4-acessibilidade"));
  }
}

function botao(texto, classe, aoClicar) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = classe;
  el.textContent = texto;
  el.addEventListener("click", aoClicar);
  return el;
}

function secao(titulo) {
  const bloco = document.createElement("section");
  bloco.className = "a11y-secao";
  const heading = document.createElement("h3");
  heading.textContent = titulo;
  bloco.append(heading);
  return bloco;
}

function controlePasso(
  titulo,
  min,
  max,
  step,
  casas,
  lerValor,
  gravarValor,
  estado,
) {
  const bloco = secao(titulo);
  const linha = document.createElement("div");
  linha.className = "a11y-linha";
  const valor = document.createElement("span");
  valor.className = "a11y-valor";
  const controle = document.createElement("input");
  controle.type = "range";
  controle.min = String(min);
  controle.max = String(max);
  controle.step = String(step);
  controle.setAttribute("aria-label", titulo);

  function sincronizar() {
    const atual = lerValor(estado);
    controle.value = String(atual);
    valor.textContent = Number(atual).toFixed(casas);
  }

  function mudar(proximo) {
    gravarValor(estado, limitar(Number(proximo.toFixed(casas)), min, max));
    aplicar(estado, true);
    sincronizar();
  }

  linha.append(
    botao("−", "a11y-passo", () => mudar(lerValor(estado) - step)),
    controle,
    botao("+", "a11y-passo", () => mudar(lerValor(estado) + step)),
    valor,
  );
  linha
    .querySelectorAll(".a11y-passo")[0]
    .setAttribute("aria-label", `Diminuir ${titulo}`);
  linha
    .querySelectorAll(".a11y-passo")[1]
    .setAttribute("aria-label", `Aumentar ${titulo}`);
  controle.addEventListener("input", () => mudar(Number(controle.value)));
  bloco.append(
    linha,
    botao("Redefinir", "a11y-redefinir", () => mudar(lerValor(PADRAO))),
  );
  sincronizar();
  return bloco;
}

export function iniciarAcessibilidade() {
  if (document.querySelector(".botao-acessibilidade")) {
    return;
  }
  const estado = estadoInicial();
  aplicar(estado, false);

  const ancora = document.getElementById("controle-acessibilidade");
  const abrir = document.createElement("button");
  abrir.type = "button";
  abrir.className = "botao-acessibilidade";
  abrir.setAttribute("aria-haspopup", "dialog");
  abrir.setAttribute("aria-expanded", "false");
  abrir.setAttribute("aria-label", "Abrir acessibilidade");
  abrir.title = "Acessibilidade";
  const icone = document.createElement("img");
  icone.src = new URL("./assets/Accessibility_logo.svg", import.meta.url).href;
  icone.alt = "";
  abrir.append(icone);

  const dialog = document.createElement("dialog");
  dialog.className = "a11y-dialog";
  dialog.setAttribute("aria-labelledby", "a11y-titulo");

  const cabeca = document.createElement("header");
  cabeca.className = "a11y-cabeca";
  const titulo = document.createElement("h2");
  titulo.id = "a11y-titulo";
  titulo.textContent = "Acessibilidade";
  const fechar = botao("Fechar", "a11y-fechar", () => dialog.close());
  cabeca.append(titulo, fechar);

  const corpo = document.createElement("div");
  corpo.className = "a11y-corpo";

  const contraste = botao("", "botao botao-secundario", () => {
    estado.theme =
      estado.theme === "high-contrast" ? "default" : "high-contrast";
    aplicar(estado, true);
    sincronizarContraste();
  });
  contraste.setAttribute("role", "switch");

  function sincronizarContraste() {
    const ativo = estado.theme === "high-contrast";
    contraste.setAttribute("aria-checked", ativo ? "true" : "false");
    contraste.textContent = ativo
      ? "Desativar alto contraste"
      : "Ativar alto contraste";
  }

  const blocoContraste = secao("Alto contraste");
  blocoContraste.append(contraste);
  sincronizarContraste();

  const blocoFonte = controlePasso(
    "Tamanho da fonte",
    0,
    3,
    1,
    0,
    (item) => Math.max(0, ESCALAS.indexOf(item.fontScale)),
    (item, indice) => {
      item.fontScale = ESCALAS[indice] || "md";
    },
    estado,
  );
  const indiceEscala = () => Math.max(0, ESCALAS.indexOf(estado.fontScale));
  const valorFonte = blocoFonte.querySelector(".a11y-valor");
  const sincronizarEscala = () => {
    const rotulo = ROTULOS_ESCALA[indiceEscala()];
    valorFonte.textContent = rotulo;
    blocoFonte.querySelector("input").setAttribute("aria-valuetext", rotulo);
  };
  blocoFonte
    .querySelector("input")
    .addEventListener("input", sincronizarEscala);
  blocoFonte.querySelectorAll(".a11y-passo, .a11y-redefinir").forEach((el) => {
    el.addEventListener("click", sincronizarEscala);
  });
  sincronizarEscala();

  const blocoFamilia = secao("Tipo de fonte");
  const opcoes = document.createElement("div");
  opcoes.className = "a11y-opcoes";
  [
    ["sans", "Sem serifa"],
    ["serif", "Serifada"],
    ["dyslexic", "Dislexia (OpenDyslexic)"],
  ].forEach(([valor, rotulo]) => {
    const label = document.createElement("label");
    label.className = "a11y-opcao";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "pi4-tipo-fonte";
    radio.value = valor;
    radio.checked = estado.fontFamily === valor;
    radio.addEventListener("change", () => {
      estado.fontFamily = valor;
      aplicar(estado, true);
    });
    const texto = document.createElement("span");
    texto.textContent = rotulo;
    label.append(radio, texto);
    opcoes.append(label);
  });
  blocoFamilia.append(
    opcoes,
    botao("Redefinir", "a11y-redefinir", () => {
      estado.fontFamily = PADRAO.fontFamily;
      aplicar(estado, true);
      opcoes.querySelector('input[value="sans"]').checked = true;
    }),
  );

  const blocoCor = secao("Cor da fonte");
  const linhaCor = document.createElement("div");
  linhaCor.className = "a11y-cor";
  const cor = document.createElement("input");
  cor.type = "color";
  cor.value = estado.fontColor || "#15202b";
  cor.setAttribute("aria-label", "Selecionar cor da fonte");
  cor.addEventListener("input", () => {
    estado.fontColor = cor.value;
    aplicar(estado, true);
  });
  linhaCor.append(
    cor,
    botao("Redefinir", "a11y-redefinir", () => {
      estado.fontColor = "";
      cor.value = "#15202b";
      aplicar(estado, true);
    }),
  );
  blocoCor.append(linhaCor);

  corpo.append(
    botao("Redefinir tudo", "botao botao-secundario", () => {
      Object.assign(estado, {
        theme: PADRAO.theme,
        fontScale: PADRAO.fontScale,
        fontFamily: PADRAO.fontFamily,
        letterSpacing: PADRAO.letterSpacing,
        lineHeight: PADRAO.lineHeight,
        paragraphWidth: PADRAO.paragraphWidth,
        fontColor: PADRAO.fontColor,
      });
      aplicar(estado, true);
      dialog.close();
      iniciarDeNovo();
    }),
    blocoFonte,
    blocoContraste,
    blocoFamilia,
    controlePasso(
      "Espaçamento entre letras",
      -1,
      4,
      0.2,
      1,
      (item) => item.letterSpacing,
      (item, valor) => {
        item.letterSpacing = valor;
      },
      estado,
    ),
    controlePasso(
      "Altura da linha",
      1.1,
      2.2,
      0.1,
      1,
      (item) => item.lineHeight,
      (item, valor) => {
        item.lineHeight = valor;
      },
      estado,
    ),
    controlePasso(
      "Largura do parágrafo",
      0,
      120,
      5,
      0,
      (item) => item.paragraphWidth,
      (item, valor) => {
        item.paragraphWidth = valor;
      },
      estado,
    ),
    blocoCor,
  );

  dialog.append(cabeca, corpo);
  abrir.addEventListener("click", () => {
    if (!dialog.open) {
      dialog.showModal();
    }
    abrir.setAttribute("aria-expanded", "true");
  });
  dialog.addEventListener("close", () => {
    abrir.setAttribute("aria-expanded", "false");
    abrir.focus();
  });
  dialog.addEventListener("toggle", (evento) => {
    abrir.setAttribute(
      "aria-expanded",
      evento.newState === "open" ? "true" : "false",
    );
  });

  document.body.append(dialog);
  if (ancora) {
    ancora.replaceChildren(abrir);
  } else {
    document.body.append(abrir);
  }

  function iniciarDeNovo() {
    dialog.remove();
    abrir.remove();
    iniciarAcessibilidade();
  }
}
