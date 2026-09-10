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

- **Status:** aberta (proposital)
- **Contexto:** o banco `flivocom_pi4` está no estado inicial; a fonte real ainda não foi inventariada.
- **Decisão:** não criar tabelas até concluir a análise da fonte.
- **Por quê:** schema imaginado gera retrabalho e análise inválida.
- **Consequência:** a próxima fase é descoberta de dados, não DDL.

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

## Divergências entre o briefing e o repositório

Registradas na inspeção de 2026-09-10. A falha de credencial no exemplo foi corrigida no working tree (ADR-012); as demais permanecem só como registro.

| Briefing / expectativa | Estado real | Fonte da verdade |
|---|---|---|
| Pastas `sql/` e `ml/` | Não existem | Repositório |
| Estrutura "aproximadamente" com essas pastas | Só `backend/` e `frontend/` | Repositório |
| `.env.example` sem segredo | Working tree sanitizado (`altere-esta-senha`); valor antigo ainda no histórico até a rotação na VPS | Repositório + ADR-012 |
| Clone em `/home/flivocom/pi4-univesp` | Clone inspecionado em Windows `c:\dev\pi4-univesp\pi4-univesp` | Duas cópias legítimas (VPS vs máquina local) |
| Dashboard com Plotly | `index.html` é smoke test, sem Plotly | Repositório (esperado para o estágio atual) |
| `GET /api/status/banco` validado | Confirmado pelo grupo; timeout nesta inspeção remota | Ambiente prévio vs tentativa de 2026-09-10 |
| Python 3.12 | Código devolve literal `"3.12"`; ambiente informado é 3.12.14 | Código + ambiente |

Onde briefing e Git divergem sobre **arquivos**, o Git vence. Onde o briefing descreve **VPS/systemd/Apache/banco vazio**, e o Git não contém esses artefatos, prevalece a informação de ambiente — explicitamente como tal, não como inferência de código.
