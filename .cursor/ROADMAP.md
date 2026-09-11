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
| Identidade e acesso (código + testes SQLite + Alembic) | OK no repositório; **sem** migration/mestre/deploy |

`GET /api/status/banco` não respondeu a tempo nesta inspeção; a validação prévia do grupo permanece como referência de ambiente.

### Segurança

| Item | Situação |
|---|---|
| `backend/.env.example` com placeholder | OK |
| Credencial MariaDB antiga | **Revogada / inutilizável** |
| Runtime `.env` com senha nova | OK — validado em `/api/status/banco` |
| Remoção da credencial revogada do histórico Git | Pendente (higiene) |
| Identidade no MariaDB (Alembic + mestre) | Código pronto; **não aplicado** |

A fase 1 (dados) continua à espera do inventário da fonte. A identidade **não** desbloqueia schema analítico.

### Não concluído (domínio do PI)

| Item | Situação |
|---|---|
| Inventário da fonte real de dados | Não iniciado |
| Schema definitivo | Não iniciado |
| Processo de importação | Não iniciado |
| Anonimização definitiva | Não iniciado |
| Endpoints reais do dashboard | Não iniciado |
| Layout/dashboard | Não iniciado (home = login MPA; sem gráficos) |
| Node.js 24 LTS / npm na VPS e no PC de desenvolvimento | VPS: 24.21.0 (NVM); local observado: 24.16.0 |
| Inicialização Vite + Plotly + tooling frontend | Vite/ESLint/Prettier no repo; Plotly nas deps, sem gráfico; **sem deploy** |
| Análises estatísticas | Não iniciado |
| Problema de ML fechado | Não iniciado |
| Treino, avaliação e integração de ML | Não iniciado |
| Processo formal de deploy | Frontend: workflow SSH (ADR-017). Backend: ainda manual; CI só descrito |
| Testes de identidade | pytest SQLite no repo; **não** valida schema MariaDB |
| Testes finais / dashboard | Não iniciado |
| Documentação acadêmica final | Não iniciado |

Pastas planejadas `sql/` e `ml/` **não existem** no repositório. Isso é ausência de fase, não bug a "corrigir" agora.

---

## Fases

```
0. Base documental (.cursor/)
0.1 Congelar stack frontend / UI / WCAG     ← concluído (documental)
0.2 Auditoria Node.js 24 LTS + npm           ← concluída (ambiente)
0.3 Toolchain Vite no repositório            ← concluída (sem publish)
0.4 Identidade e acesso (código)             ← concluída no Git; sem aplicar na VPS
        ↓
1. Análise e modelagem dos dados             ← inventário da fonte (identidade não substitui)
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

A auditoria 0.2 e a toolchain 0.3 **não** criam schema analítico nem dashboard. A etapa 0.4 versiona identidade (Alembic) **sem** `alembic upgrade` na VPS. O `dist/` **não** foi copiado para a VPS neste passo.

Dependência dura no domínio: **1 bloqueia 2**. **2 bloqueia 3 e 5**. **3 e 4 podem se sobrepor** depois do contrato mínimo da API. **5 bloqueia 6**. **6 bloqueia 7**.

---

## Próxima tarefa na VPS — não executar até autorização desta revisão

Ordem prevista no runtime `/home/flivocom/pi4-backend`:

1. copiar o backend do clone (sem `.env`);
2. `pip install -r requirements.txt` no venv 3.12;
3. completar `SMTP_*`, `APP_URL`, `COOKIE_SECURE=true` no `.env`;
4. `alembic upgrade head` e `SHOW CREATE TABLE`;
5. `python scripts/criar_usuario_mestre.py`;
6. reiniciar `pi4-backend`;
7. republicar `frontend/dist` (identidade visual).

A fase 1 (dados) espera o inventário da fonte; ver `DATA.md`. A credencial MariaDB antiga está revogada.

---

## Trabalho paralelo possível (depois da fase 1)

Sem conflito, após o dicionário de dados:

- esboço de contrato da API (nomes de endpoints e filtros) em documento;
- esboço de layout no papel, alinhado a `UI.md`, **sem** fingir dados reais;
- texto acadêmico de introdução/metodologia.

Ainda assim, implementação de API analítica, gráficos com dados e ML esperam as fases 2+. Não publicar `dist/` sem autorização.

---

## O que nenhum agente deve fazer até a fase correspondente

- criar tabelas analíticas ou "completar" o modelo de chamados;
- aplicar Alembic ou o script do mestre em produção sem autorização explícita;
- implementar dashboard Plotly;
- treinar ou escolher algoritmo de ML como decisão fechada;
- gerar dados fictícios para parecer pronto;
- redesenhar stack, Apache, systemd ou Python do sistema;
- introduzir React, Streamlit, Redis, filas, TypeScript, Tailwind, etc.;
- executar `npm create vite` de novo ou instalar Playwright/Vitest/axe sem necessidade.
