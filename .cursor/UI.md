# Interface, visualização e acessibilidade

Fonte de verdade visual e de acessibilidade do PI4. Arquitetura: `ARCHITECTURE.md`. Decisões: `DECISIONS.md`.

Antes de alterar UI, o agente deve ler este arquivo.

A interface do PI4 será desenvolvida tendo como referência os critérios de conformidade **WCAG 2.2 nível AA** do W3C/WAI.

Não declarar automaticamente “100% acessível”. Conformidade deve ser avaliada.

---

## Distinção normativa

| Tipo | O que é | Exemplos |
|---|---|---|
| Requisito WCAG 2.2 AA | Critério da norma; deve ser atendido e avaliado | contraste de texto 4,5:1; foco visível; reflow; alvo 24×24 CSS px (com exceções da norma) |
| Padrão ergonômico interno | Decisão do PI, mais rigorosa ou específica; **não** é cláusula WCAG | alvo primário 40–44 px; anel de foco ≈ 2 CSS px e contraste ≥ 3:1; fonte base ≈ 16px; line-height ≈ 1,5 |

Não atribuir à WCAG o que for só decisão interna.

---

## Objetivo visual

Dashboard analítico: sóbrio, moderno, profissional, legível, acessível, com alta clareza informacional.

**Informação > decoração.**

Não deve parecer landing page comercial, template administrativo genérico, relatório de Word, interface excessivamente colorida nem conjunto de cards decorativos.

---

## Semântica e teclado

- `lang="pt-BR"`.
- HTML5 semântico (`header`, `nav`, `main`, `section`, `article`, `form`, `label`, `button`, `table`, …).
- Hierarquia correta de headings.
- ARIA só quando o HTML semântico não bastar.
- Não substituir `button` por `div` clicável.
- Toda funcionalidade utilizável por teclado; ordem de foco lógica; foco sempre visível.
- WCAG 2.2 AA: Focus Visible e Focus Not Obscured.
- Padrão interno de foco: indicador claramente perceptível, de preferência ≥ ~2 CSS px e contraste mínimo 3:1 em relação ao estado sem foco.

---

## Contraste, cor e movimento

Texto normal: mínimo **4,5:1**. Texto grande: mínimo **3:1**. Controles, bordas e informação visual necessária: mínimo **3:1** contra cores adjacentes.

Cor **nunca** é a única forma de transmitir significado. Proibido: verde = bom / vermelho = ruim, sem ícone, texto ou outro sinal. Preferir símbolo + texto + cor (ex.: ▲ Aumento, ▼ Redução, ! Atenção).

Respeitar `prefers-reduced-motion`. Evitar animação decorativa ou movimento sem função analítica.

---

## Layout, zoom e alvos

- Interface funcional com texto ampliado em **200%**.
- Responsiva (WCAG Reflow): sem perda de conteúdo/função em larguras reduzidas; evitar rolagem horizontal da página.
- Exceções justificáveis: tabelas largas, certas visualizações, elementos que exigem duas dimensões.
- Desktop: múltiplas colunas quando favorecer comparação. Telas menores: reorganizar para uma coluna; não apenas encolher tudo. Gráficos que precisam de largura ocupam a linha inteira.
- WCAG 2.2 AA: alvo mínimo de referência **24 × 24 CSS px**, observadas as exceções da norma.
- Padrão interno: controles primários de preferência **40–44 px** de altura/alvo, se não comprometer a interface.

---

## Páginas desta etapa (MPA)

Home pública: **login** (`index.html`) — bloco institucional (título do PI e integrantes com RA) + formulário Entrar. Sem cadastro e sem “esqueci senha”.

Autenticadas: `painel.html` (placeholder do dashboard) e `convites.html` (só perfil mestre).

Pública com token: `convite.html` lê `#token=`, valida, remove o fragmento da barra (`replaceState`), pede senha definitiva (`autocomplete="new-password"`).

Estados de formulário: texto + `data-estado` (`ok` / `erro` / `carregando`). A cor não é o único sinal — as mensagens começam com “OK —”, “Erro —” ou “Enviando —”.

---

## Formulários

Todo `input` com `label` identificável. Placeholder não substitui label. Erro não pode ser só pela cor. Mensagens devem dizer o problema com clareza.

---

## Gráficos (Plotly.js)

Plotly.js é a biblioteca oficial. O gráfico **não** pode ser a única forma de comunicar uma conclusão importante.

Para cada visualização analítica relevante, considerar: título claro; pergunta que responde; eixos e unidades; legenda; tooltip; estados de loading, sem dados e erro; informação não baseada só em cor.

Quando relevante: resumo textual do resultado principal e/ou tabela equivalente.

Não usar gráfico 3D, gauges decorativos, excesso de cores, animação sem função, nem visualização só por impacto.

Tipos preferenciais: linha (séries temporais); barras (comparações); heatmap (dia × horário); scatter (relação entre variáveis); tabelas (detalhe).

O gráfico existe porque responde uma pergunta de `PROJECT.md`.

---

## Hierarquia conceitual da tela

Direção — os dados reais definirão o dashboard; não implementar cegamente:

1. identificação da análise;
2. filtros globais;
3. KPIs principais;
4. análises/gráficos;
5. detalhamento;
6. informações metodológicas, se necessário.

Possível ordem: header compacto → filtros (período, setor, operador, cliente, categoria; demais só se justificados) → KPIs → gráficos → clientes/pontos de atenção → tabelas.

---

## Design tokens

Quando a implementação visual começar, CSS Custom Properties como fonte única. Não espalhar hex e medidas arbitrárias. Não fixar valores definitivos enquanto não houver design.

Categorias: cores, tipografia, espaçamentos, raios, bordas, sombras, larguras máximas, breakpoints se necessário.

Exemplo conceitual de nomes (sem valores):

`--color-background`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-primary`, `--color-success`, `--color-warning`, `--color-danger`, `--space-xs` … `--space-xl`.

---

## Tipografia (orientação interna, não WCAG)

Uma família principal; sem fontes decorativas extras. Base ≈ 16px. Line-height ≈ 1,5 em texto corrido. Hierarquia consistente: título da aplicação, seção, gráfico, KPI, texto, legenda, metadado.

---

## Avaliação de acessibilidade

Ferramentas automáticas **não** provam conformidade WCAG. Combinar: análise automatizada; teclado; inspeção de foco; contraste; zoom; reflow; HTML semântico; avaliação humana.
