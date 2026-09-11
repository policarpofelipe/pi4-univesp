# Roadmap

Estado atual, fases e dependências. Não avançar uma fase estrutural sem autorização e sem os pré-requisitos.

---

## Estado atual

### Concluído (infraestrutura)

Itens abaixo são informação de ambiente fornecida e já validada, salvo onde a inspeção confirmou.

| Item | Situação |
|---|---|
| Subdomínio + HTTPS | OK (ambiente) |
| Frontend HTML publicado | OK — confirmado nesta inspeção (página de fumaça) |
| Python 3.12 em paralelo + venv | OK (ambiente) |
| FastAPI + Uvicorn + systemd | OK (ambiente) |
| MariaDB 10.11, banco e usuário exclusivos | OK (ambiente) |
| SQLAlchemy / PyMySQL + `.env` fora do Git | OK no código; `.env` real só no runtime |
| Apache reverse proxy `/api/*` | OK (ambiente) |
| Browser chamando API | OK — `GET /api/status` confirmado nesta inspeção |
| Git + GitHub (`main` sincronizado) | OK — confirmado no clone local |
| Stack frontend (Vite 8 / Node 24 LTS / Vanilla / WCAG 2.2 AA) | OK **documental** (ADR-013–016); código ainda é smoke test |

`GET /api/status/banco` não respondeu a tempo nesta inspeção; a validação prévia do grupo permanece como referência de ambiente.

### Segurança (em correção — bloqueia a fase 1)

| Item | Situação |
|---|---|
| `backend/.env.example` com placeholder | OK no working tree (`altere-esta-senha`) |
| `.gitignore` reforçado para `.env.*` | OK no working tree |
| Commit/push do exemplo sanitizado | Pendente de autorização |
| Rotação da senha de `flivocom_pi4app` na VPS | Pendente |
| Atualizar `.env` de runtime e reiniciar o serviço | Pendente |

Não avançar à modelagem enquanto a senha antiga (já presente no histórico do Git) não for invalidada no MariaDB.

### Não concluído (domínio do PI)

| Item | Situação |
|---|---|
| Inventário da fonte real de dados | Não iniciado |
| Schema definitivo | Não iniciado |
| Processo de importação | Não iniciado |
| Anonimização definitiva | Não iniciado |
| Endpoints reais do dashboard | Não iniciado |
| Layout/dashboard | Não iniciado (só smoke test; stack Vite ainda não inicializada) |
| Node.js 24 LTS / npm na VPS e no PC de desenvolvimento | Não auditado |
| Inicialização Vite + Plotly + tooling frontend | Bloqueada até a auditoria |
| Análises estatísticas | Não iniciado |
| Problema de ML fechado | Não iniciado |
| Treino, avaliação e integração de ML | Não iniciado |
| Processo formal de deploy | Não iniciado |
| Documentação acadêmica final | Não iniciado |
| Testes finais | Não iniciado |

Pastas planejadas `sql/` e `ml/` **não existem** no repositório. Isso é ausência de fase, não bug a "corrigir" agora.

---

## Fases

```
0. Base documental (.cursor/)
0.1 Congelar stack frontend / UI / WCAG     ← concluído (documental)
0.2 Auditoria Node.js 24 LTS + npm           ← próxima etapa de toolchain
        ↓
1. Análise e modelagem dos dados             ← ainda bloqueada pela rotação da senha (ADR-012)
        ↓
2. Schema analítico mínimo + importação
        ↓
3. API de consulta para o dashboard
        ↓
4. Dashboard (Vite + filtros, KPIs, gráficos)
        ↓
5. EDA formal e definição do problema de ML
        ↓
6. Treino, avaliação, interpretação
        ↓
7. Integração pontual dos resultados de ML
        ↓
8. Deploy simples, testes e texto acadêmico
```

A auditoria 0.2 **não** cria schema nem dashboard. Pode ocorrer em paralelo à correção de senha (ADR-012). **Não** inicializar Vite até 0.2 concluir.

Dependência dura no domínio: **1 bloqueia 2**. **2 bloqueia 3 e 5**. **3 e 4 podem se sobrepor** depois do contrato mínimo da API. **5 bloqueia 6**. **6 bloqueia 7**. Inicialização Vite (após 0.2) pode existir como esqueleto vazio antes da fase 4, sem fingir dados.

---

## Próxima tarefa (fase 0.2) — não executar até autorização

**Objetivo:** auditar o ambiente e só então propor instalação **segura** da toolchain frontend.

**Trabalho:**

1. na VPS: `node --version` e `npm --version` (sem instalar nada ainda);
2. no desenvolvimento local: mesma verificação;
3. registrar se Node.js 24 LTS já existe, se é outra linha, ou se está ausente;
4. se 24 LTS não estiver na VPS, propor forma de instalá-lo **sem** comprometer cPanel, Python 3.9 do sistema ou outros sites;
5. só depois de aprovado: inicializar Vite Vanilla, versionar `package-lock.json`, incluir `node_modules/` e `dist/` no `.gitignore`, instalar Plotly.js e o tooling (ESLint, Prettier, …).

**Critério de conclusão da fase 0.2:**

- versões de Node/npm documentadas (VPS e local);
- decisão explícita de como obter Node 24 LTS, se faltar;
- nenhuma instalação feita sem autorização;
- Apache, systemd e MariaDB intocados;
- frontend publicado ainda pode ser o smoke test.

A fase 1 (dados) permanece válida e continua bloqueada enquanto a senha do ADR-012 não for rotacionada.

### Critério da fase 1 (quando autorizada)

Fonte identificada; dicionário de campos; volume, período e qualidade; o que anonimizar; schema analítico mínimo justificado pelos dados reais; nada identificável no GitHub; nenhuma tabela no chute. Ver `DATA.md`.

---

## Trabalho paralelo possível (depois da fase 1)

Sem conflito, após o dicionário de dados:

- esboço de contrato da API (nomes de endpoints e filtros) em documento;
- esboço de layout no papel, alinhado a `UI.md`, **sem** fingir dados reais;
- texto acadêmico de introdução/metodologia.

Ainda assim, implementação de API analítica, gráficos com dados e ML esperam as fases 2+. `npm create vite` espera a fase 0.2 autorizada.

---

## O que nenhum agente deve fazer até a fase correspondente

- criar tabelas ou "completar" o modelo;
- implementar dashboard Plotly;
- treinar ou escolher algoritmo de ML como decisão fechada;
- gerar dados fictícios para parecer pronto;
- redesenhar stack, Apache, systemd ou Python do sistema;
- introduzir React, Streamlit, Redis, filas, TypeScript, Tailwind, etc.;
- executar `npm create vite` / instalar Plotly ou ESLint antes da auditoria 0.2.
