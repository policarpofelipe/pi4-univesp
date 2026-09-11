# Decisões (ADR simplificado)

Registro de decisões já tomadas. Novas decisões estruturais devem ser acrescentadas aqui **antes** de alterar stack, schema, arquitetura ou processo de deploy.

Status: `aceita` | `descartada` | `aberta`.

---

## ADR-001 — Tema: análise de dados do suporte técnico

- **Status:** aceita
- **Contexto:** o PI exige conjunto de dados existente, análise em escala, ML e visualização.
- **Decisão:** trabalhar com chamados reais de suporte técnico e um dashboard de análise operacional.
- **Por quê:** problema real, dados existentes, perguntas explicáveis na banca.
- **Consequência:** o sistema responde perguntas operacionais com evidências; não é um produto genérico de BI.

---

## ADR-002 — Arquitetura dinâmica, não GitHub Pages

- **Status:** aceita (a alternativa está descartada)
- **Contexto:** existiu a hipótese MySQL → Python → JSON/CSV → GitHub Pages → JavaScript.
- **Decisão:** browser → Apache → FastAPI → Python → MariaDB, com consultas durante o uso.
- **Por quê:** filtros reais, backend Python ativo, alinhamento ao objetivo de API e banco.
- **Consequência:** exige VPS, processo de deploy e API estável. GitHub não é o servidor.

---

## ADR-003 — MariaDB 10.11 como banco oficial

- **Status:** aceita
- **Contexto:** o grupo mencionou MySQL; o servidor disponível é MariaDB 10.11.
- **Decisão:** assumir MariaDB 10.11. SQLAlchemy permanece com dialect `mysql+pymysql`.
- **Por quê:** é o SGBD real da VPS; o dialect MySQL é a forma suportada de acesso.
- **Consequência:** documentação e fala de banca devem dizer MariaDB, não "MySQL de produção".

---

## ADR-004 — Sem Streamlit

- **Status:** aceita
- **Contexto:** Streamlit foi hipótese inicial de interface.
- **Decisão:** frontend HTML/CSS/JS + Plotly.js; backend FastAPI.
- **Por quê:** arquitetura com API real, separação de responsabilidades, stack já publicada.
- **Consequência:** não reintroduzir Streamlit "só para o dashboard ficar rápido".

---

## ADR-005 — Frontend deliberadamente simples

- **Status:** aceita
- **Contexto:** frameworks JS aumentariam custo de explicação e manutenção do grupo.
- **Decisão:** HTML, CSS, JavaScript puro, Plotly.js. Sem React/Node/TypeScript.
- **Por quê:** clareza acadêmica; complexidade só com necessidade concreta.
- **Consequência:** o dashboard precisa ser bem estruturado em JS simples, não uma SPA enterprise.

Atualização (2026-09-11): Vanilla JS e Plotly permanecem. **Node.js passou a ser permitido somente como toolchain de frontend** (ADR-013). A proibição de React/TypeScript/frameworks continua (ADR-014).

---

## ADR-006 — Repositório separado dos diretórios de runtime

- **Status:** aceita
- **Contexto:** a VPS já tem document root e backend em caminhos distintos do clone Git.
- **Decisão:** manter `pi4-univesp` (repo), `pi4-backend` (runtime API) e `pi4.flivo.com.br` (runtime frontend).
- **Por quê:** isolamento em hospedagem compartilhada; deploy controlado.
- **Consequência:** publicar não é `git pull` no document root sem processo definido. Não unificar silenciosamente.

---

## ADR-007 — Python 3.12 no venv; Python 3.9 do sistema intocável

- **Status:** aceita
- **Contexto:** AlmaLinux/cPanel oferece Python 3.9 como sistema.
- **Decisão:** o PI usa 3.12 apenas no virtualenv do backend. Não substituir o Python do sistema.
- **Por quê:** não arriscar cPanel e demais sites da VPS.
- **Consequência:** scripts e systemd devem apontar para `/home/flivocom/pi4-backend/.venv`.

---

## ADR-008 — Schema e fonte de dados em aberto

- **Status:** aberta (proposital) para o **schema analítico**
- **Contexto:** o banco `flivocom_pi4` está no estado inicial; a fonte real ainda não foi inventariada.
- **Decisão:** não criar tabelas **de chamados/análise** até concluir a análise da fonte. Tabelas de identidade (ADR-018 a ADR-023) são outra trilha, versionadas em Alembic, e **não** substituem o inventário da fonte.
- **Por quê:** schema analítico imaginado gera retrabalho e análise inválida.
- **Consequência:** a fase de dados continua sendo descoberta, não DDL analítico. Aplicar a migration de identidade no MariaDB só depois da rotação ADR-012 e com autorização explícita.

---

## ADR-009 — Pergunta de ML em aberto

- **Status:** aberta (proposital)
- **Contexto:** ML é obrigatório; uma hipótese é classificar atendimento demorado; outra é prever insatisfação.
- **Decisão:** não fechar algoritmo, target ou limiares antes da EDA.
- **Por quê:** qualidade/volume (especialmente de avaliações) ainda são desconhecidos.
- **Consequência:** scikit-learn pode permanecer só em `requirements.txt` até a fase 5–6.

---

## ADR-010 — "Ponto de atenção" não é score de IA

- **Status:** aceita como restrição
- **Contexto:** há interesse em destacar clientes críticos.
- **Decisão:** se houver regra, ela será heurística explícita, distinta de ML, até existir justificativa para um modelo.
- **Por quê:** evitar misturar regra de negócio com aprendizagem de máquina na banca.
- **Consequência:** não implementar ranking "inteligente" sem definição.

---

## ADR-011 — API só em localhost, publicada pelo Apache

- **Status:** aceita
- **Contexto:** a VPS hospeda outros sistemas; Uvicorn não deve ficar público.
- **Decisão:** Uvicorn em `127.0.0.1:8000`; Apache faz proxy de `/api/*`.
- **Por quê:** isolamento e HTTPS já existentes no subdomínio.
- **Consequência:** o frontend usa caminhos relativos `/api/...`.

---

## ADR-012 — `.env.example` só com placeholder; senha vazada deve ser rotacionada

- **Status:** aceita (working tree corrigido; rotação no servidor ainda pendente)
- **Contexto:** o commit inicial versionou `DB_PASSWORD` real em `backend/.env.example`.
- **Decisão:** o exemplo passa a usar apenas `altere-esta-senha`. A senha de `flivocom_pi4app` no MariaDB deve ser trocada na VPS; o `.env` de runtime não volta ao Git. Não reescrever o histórico só para ocultar o valor antigo.
- **Por quê:** o histórico público/clonável já contém o segredo; só a rotação o invalida. Placeholder evita novo vazamento.
- **Consequência:** após o commit sanitizado, ainda é obrigatório `ALTER USER` + atualizar `/home/flivocom/pi4-backend/.env` + reiniciar `pi4-backend.service`.

---

## ADR-013 — Node.js 24 LTS + npm + Vite 8.x como toolchain de frontend

- **Status:** aceita (congelada)
- **Contexto:** o frontend precisa de ES Modules, organização modular e build reproduzível, sem virar SPA.
- **Decisão:** Node.js 24 LTS, npm (único gerenciador) e Vite 8.x com template Vanilla. Em produção só saem estáticos (`dist/` → Apache). Node não substitui FastAPI.
- **Por quê:** ambiente moderno, ESM, build otimizado, `npm install` / `npm run dev` / `npm run build`, sem exigir framework. LTS em vez de Node Current.
- **Consequência:** toolchain no repositório (`frontend/`); produção continua Apache + estáticos. Node na VPS: 24.x via NVM do `flivocom`, sem alterar Node do cPanel. Publicação do `dist/` via workflow de frontend (ADR-017).

---

## ADR-014 — Permanência em Vanilla JS; sem React/TypeScript

- **Status:** aceita (congelada); refina ADR-005
- **Contexto:** frameworks e TypeScript aumentariam custo de explicação na banca sem necessidade atual.
- **Decisão:** HTML5 + CSS próprio + JavaScript moderno (ES Modules). Não usar React, Vue, Angular, Svelte, TypeScript, Bootstrap, Tailwind, Material UI nem bibliotecas completas de componentes.
- **Por quê:** complexidade essencial; o grupo deve defender cada peça.
- **Consequência:** dashboard em JS modular, não em SPA enterprise. Plotly.js continua a biblioteca oficial de gráficos.

---

## ADR-015 — WCAG 2.2 nível AA como referência de interface

- **Status:** aceita (congelada)
- **Contexto:** o PI inclui IHC e visualização; a interface será usada e apresentada.
- **Decisão:** desenvolver a UI tendo como referência os critérios de conformidade WCAG 2.2 nível AA (W3C/WAI). Documento central: `UI.md`. Não declarar “100% acessível”.
- **Por quê:** padrão internacional avaliável; separa requisito normativo de recomendações ergonômicas internas (ex.: alvo 40–44 px, fonte ≈ 16px).
- **Consequência:** todo agente de frontend aplica semântica, teclado, contraste, reflow e gráficos com alternativa textual desde a implementação. Ferramentas automáticas não bastam como prova.

---

## ADR-016 — Toolchain de qualidade aprovada, ainda não instalada

- **Status:** aceita (planejada)
- **Contexto:** precisa haver ferramentas oficiais sem instalá-las antes da auditoria de ambiente.
- **Decisão:** ESLint, Prettier, Vitest, Playwright, axe-core (ou equivalente) no frontend; pytest no backend. Versionar `package-lock.json`; não versionar `node_modules/` nem `dist/`.
- **Por quê:** qualidade reproduzível, proporcional ao PI.
- **Consequência:** instalação só depois da auditoria Node/npm. Pytest do backend passou a existir em `requirements-dev.txt` na etapa de identidade. Não misturar Yarn/pnpm.

---

## ADR-017 — CI/CD só do frontend, via SSH na VPS

- **Status:** aceita
- **Contexto:** o document root precisa receber `dist/` sem publicar à mão e sem tocar no backend.
- **Decisão:** GitHub Actions em `main` (e `workflow_dispatch`) conecta por SSH com secrets `VPS_*`, valida com `npm run check` na VPS e só então faz rsync para `/home/flivocom/pi4.flivo.com.br/`. Sem `reset --hard`, sem actions SSH de terceiros, sem `StrictHostKeyChecking=no`. Concurrency `deploy-frontend` sem cancelar job em andamento.
- **Por quê:** um único deploy por vez; falha se lint/build ou o git local divergir; Apache/systemd/MariaDB permanecem fora.
- **Consequência:** backend continua manual. O clone em `/home/flivocom/pi4-univesp` precisa estar limpo e conseguir `pull --ff-only`. `rsync` e NVM 24 são requisitos da VPS. CI de backend (venv, pytest, `alembic upgrade`, restart) permanece só descrito — não existe workflow ainda.

---

## ADR-018 — Sessão opaca em cookie HttpOnly

- **Status:** aceita
- **Contexto:** o PI precisa de acesso fechado (convite + login) sem virar produto de auth enterprise.
- **Decisão:** sessão opaca persistida em `sessoes_usuarios` (`token_hash` SHA-256). Cookie `pi4_sessao`, HttpOnly, SameSite=Lax, Path=/, host-only, `Secure` conforme `COOKIE_SECURE`. Sem JWT, sem token de sessão no JavaScript/localStorage. `obter_usuario_atual` rejeita se `expira_em <= agora_utc()`, se `revogada_em` estiver preenchido ou se o usuário estiver inativo. Logout grava `revogada_em`. Sem cron; a tabela permite `DELETE` futuro de expiradas/revogadas sem mudar o modelo.
- **Por quê:** o navegador não precisa ler o segredo da sessão; CSRF de origens cruzadas fica limitado pelo SameSite e pela checagem de `Origin`.
- **Consequência:** duração padrão 8 h (`SESSAO_DURACAO_HORAS`). Testes com `COOKIE_SECURE=false` aceitam Origin de localhost:5173.

---

## ADR-019 — Convite com token no fragmento da URL

- **Status:** aceita
- **Contexto:** o mestre convida por nome e e-mail; o convidado define a senha definitiva.
- **Decisão:** token criptográfico (`secrets.token_urlsafe(32)`) vai no link `…/convite.html#token=…`. Só o `token_hash` (SHA-256) é persistido. O fragmento não vai ao Apache/FastAPI no GET da página. A UI lê o hash, valida via POST e faz `history.replaceState` para tirar o token da barra. Sem cadastro público, sem “esqueci senha”, sem reenvio nesta etapa.
- **Por quê:** o token original não é reversível nem reutilizável depois que a requisição de criação termina — mesmo que a linha do convite continue pendente.
- **Consequência:** reenvio futuro (não implementar agora) deve gerar **novo** token, substituir `token_hash`, renovar `expira_em` e invalidar o link antigo.

---

## ADR-020 — Schema de identidade via Alembic

- **Status:** aceita
- **Contexto:** `create_all` não é evolução de schema; o banco de aplicação ainda não tem tabelas analíticas.
- **Decisão:** três tabelas utf8mb4 — `usuarios`, `convites_usuarios`, `sessoes_usuarios` — na revision `0001_identidade`. Downgrade remove só essas tabelas. Pytest usa SQLite em memória e **não** valida o schema MariaDB. Gate manual, depois da ADR-012: `alembic upgrade head` em `flivocom_pi4` e `SHOW CREATE TABLE`.
- **Por quê:** versionar DDL sem Docker nem segundo banco; não misturar com o schema de chamados.
- **Consequência:** **não** aplicar a migration em produção nesta etapa. Não há bootstrap automático do usuário mestre.

---

## ADR-021 — Origem e SameSite no lugar de CORS amplo

- **Status:** aceita
- **Contexto:** frontend e API no mesmo sítio (`https://pi4.flivo.com.br`); cookie SameSite=Lax.
- **Decisão:** POSTs autenticados (e criação de convite) exigem `Origin` igual a `APP_URL`. Com `COOKIE_SECURE=false`, também `http://localhost:5173` e `http://127.0.0.1:5173`. Sem CORS amplo, sem CSRF token extra nesta etapa.
- **Por quê:** o cookie não deve ser enviado em POST cross-site típico; a checagem de Origin fecha o furo same-site de formulários de outros paths se a origem divergir.
- **Consequência:** o cliente usa `credentials: 'include'` e caminhos relativos `/api/…`.

---

## ADR-022 — SMTP e MariaDB não são atômicos; rastreio de envio

- **Status:** aceita
- **Contexto:** gravar o convite e enviar o e-mail não cabem numa transação única.
- **Decisão:** COMMIT do `token_hash` primeiro; depois SMTP. Sucesso grava `email_enviado_em` e limpa `erro_envio_em`. Falha mantém a linha pendente, grava `erro_envio_em` e devolve HTTP 502 (“Convite criado, mas o e-mail não foi enviado.”) **sem rollback**. O token original não fica no banco nem na API administrativa. Sem reenvio nesta etapa.
- **Por quê:** rollback após COMMIT não desfaz o e-mail; guardar o token em claro para “tentar de novo” quebraria o modelo de hash.
- **Consequência:** se o SMTP falhar, aquele token está perdido de propósito. Se o e-mail sair e o UPDATE de `email_enviado_em` falhar, o link continua válido pelo `token_hash` já commitado.

---

## ADR-023 — Timestamps persistidos em UTC

- **Status:** aceita
- **Contexto:** a VPS pode ter fuso distinto do horário de apresentação (America/Sao_Paulo).
- **Decisão:** helper `agora_utc()` (UTC ingênuo em `DATETIME`). Sem `NOW()` do MariaDB e sem fuso da VPS na lógica de expiração de convite/sessão/bloqueio.
- **Por quê:** expiração previsível e testes determinísticos.
- **Consequência:** conversão para horário de Brasília só na apresentação, em etapa posterior se necessário. A listagem atual mostra o instante com sufixo `UTC`.

---

## Divergências entre o briefing e o repositório

Registradas na inspeção de 2026-09-10. A falha de credencial no exemplo foi corrigida no working tree (ADR-012); as demais permanecem só como registro.

| Briefing / expectativa | Estado real | Fonte da verdade |
|---|---|---|
| Pastas `sql/` e `ml/` | Não existem | Repositório |
| Estrutura "aproximadamente" com essas pastas | Só `backend/` e `frontend/` | Repositório |
| `.env.example` sem segredo | Working tree sanitizado (`altere-esta-senha`); valor antigo ainda no histórico até a rotação na VPS | Repositório + ADR-012 |
| Clone em `/home/flivocom/pi4-univesp` | Clone inspecionado em Windows `c:\dev\pi4-univesp\pi4-univesp` | Duas cópias legítimas (VPS vs máquina local) |
| Dashboard com Plotly | `index.html` é smoke test, sem Plotly/Vite | Repositório (esperado); alvo em ADR-013 |
| `GET /api/status/banco` validado | Confirmado pelo grupo; timeout nesta inspeção remota | Ambiente prévio vs tentativa de 2026-09-10 |
| Python 3.12 | Código devolve literal `"3.12"`; ambiente informado é 3.12.14 | Código + ambiente |

Onde briefing e Git divergem sobre **arquivos**, o Git vence. Onde o briefing descreve **VPS/systemd/Apache/banco vazio**, e o Git não contém esses artefatos, prevalece a informação de ambiente — explicitamente como tal, não como inferência de código.
