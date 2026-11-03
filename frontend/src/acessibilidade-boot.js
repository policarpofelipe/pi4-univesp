(function () {
  var root = document.documentElement;

  function ler(chave, padrao) {
    try {
      var valor = localStorage.getItem(chave);
      return valor == null || valor === "" ? padrao : valor;
    } catch {
      return padrao;
    }
  }

  root.setAttribute("data-theme", ler("pi4_a11y_theme", "default"));
  root.setAttribute("data-font-scale", ler("pi4_a11y_font_scale", "md"));
  root.setAttribute("data-font-family", ler("pi4_a11y_font_family", "sans"));
  root.style.setProperty(
    "--a11y-letter-spacing",
    ler("pi4_a11y_letter_spacing", "0") + "px",
  );
  root.style.setProperty(
    "--a11y-line-height",
    ler("pi4_a11y_line_height", "1.5"),
  );
  var largura = Number(ler("pi4_a11y_paragraph_width", "0"));
  if (largura > 0) {
    root.setAttribute("data-paragraph-limit", "1");
    root.style.setProperty("--a11y-paragraph-width", largura + "ch");
  }
  var cor = ler("pi4_a11y_font_color", "");
  if (cor) {
    root.setAttribute("data-font-color", "1");
    root.style.setProperty("--a11y-font-color", cor);
  }
})();
