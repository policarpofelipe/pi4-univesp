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
| Stack frontend (Vite 8 / Node 24 LTS / Vanilla / WCAG 2.2 AA) | OK no repositório (toolchain); build **não** publicado |

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
| Layout/dashboard | Não iniciado (status de ambiente com Vite; sem gráficos) |
| Node.js 24 LTS / npm na VPS e no PC de desenvolvimento | VPS: 24.21.0 (NVM); local observado: 24.16.0 |
| Inicialização Vite + Plotly + tooling frontend | Vite/ESLint/Prettier no repo; Plotly nas deps, sem gráfico; **sem deploy** |
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
0.2 Auditoria Node.js 24 LTS + npm           ← concluída (ambiente)
0.3 Toolchain Vite no repositório            ← concluída (sem publish)
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

A auditoria 0.2 e a toolchain 0.3 **não** criam schema nem dashboard. O `dist/` **não** foi copiado para a VPS.

Dependência dura no domínio: **1 bloqueia 2**. **2 bloqueia 3 e 5**. **3 e 4 podem se sobrepor** depois do contrato mínimo da API. **5 bloqueia 6**. **6 bloqueia 7**.

---

## Próxima tarefa na VPS — não executar até autorização

Publicar o `frontend/dist` no document root só depois de `npm ci` + `npm run build` na VPS (Node 24 via NVM do `flivocom`), sem alterar Apache de outros sítios nem o backend.

A fase 1 (dados) permanece bloqueada enquanto a senha do ADR-012 não for rotacionada. Critério: fonte, dicionário, volume/qualidade, anonimização, schema mínimo justificado; ver `DATA.md`.

---

## Trabalho paralelo possível (depois da fase 1)

Sem conflito, após o dicionário de dados:

- esboço de contrato da API (nomes de endpoints e filtros) em documento;
- esboço de layout no papel, alinhado a `UI.md`, **sem** fingir dados reais;
- texto acadêmico de introdução/metodologia.

Ainda assim, implementação de API analítica, gráficos com dados e ML esperam as fases 2+. Não publicar `dist/` sem autorização.

---

## O que nenhum agente deve fazer até a fase correspondente

- criar tabelas ou "completar" o modelo;
- implementar dashboard Plotly;
- treinar ou escolher algoritmo de ML como decisão fechada;
- gerar dados fictícios para parecer pronto;
- redesenhar stack, Apache, systemd ou Python do sistema;
- introduzir React, Streamlit, Redis, filas, TypeScript, Tailwind, etc.;
- executar `npm create vite` de novo ou instalar Playwright/Vitest/axe sem necessidade.
