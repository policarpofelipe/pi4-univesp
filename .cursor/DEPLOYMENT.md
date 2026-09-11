# Deploy e ambiente

A maior parte deste arquivo é **informação de ambiente fornecida e já validada**, não inferência do código do repositório. Onde a inspeção de 2026-09-10 conseguiu confirmar algo de fora, isso está marcado explicitamente.

Não alterar Apache, systemd, Python do sistema, MariaDB global ou outros sítios da VPS sem necessidade e autorização.

---

## VPS

| Item | Valor informado |
|---|---|
| Sistema | AlmaLinux 9.8 |
| Painel | cPanel / WHM |
| Servidor web | Apache 2.4 (EasyApache/cPanel) |
| Subdomínio | `https://pi4.flivo.com.br` |
| Document root (frontend publicado) | `/home/flivocom/pi4.flivo.com.br` |
| Runtime backend | `/home/flivocom/pi4-backend` |
| Virtualenv | `/home/flivocom/pi4-backend/.venv` |
| Python do projeto | 3.12.14 (somente no virtualenv) |
| Python do sistema | 3.9 — não substituir |
| Repositório na VPS | `/home/flivocom/pi4-univesp` |

A VPS é compartilhada com outros sistemas reais. Isolamento é requisito, não detalhe.

---

## Processo de deploy

Repo, runtime backend e document root do frontend **permanecem separados**.

### Frontend (automatizado)

Push em `main` (ou `workflow_dispatch`) dispara `.github/workflows/deploy-frontend.yml`.

O runner GitHub **não** constrói o frontend. Ele abre SSH na VPS (chave em Repository Secrets) e, como `flivocom`:

1. carrega NVM e exige Node 24;
2. em `/home/flivocom/pi4-univesp`, recusa árvore suja, `git fetch` + `checkout main` + `pull --ff-only` (sem `reset --hard`);
3. em `frontend/`: `npm ci` e `npm run check` (lint, format:check, build);
4. só então `rsync` de `frontend/dist/` para `/home/flivocom/pi4.flivo.com.br/`, preservando `.well-known/`;
5. smoke: `curl` em `/` e `/api/status`.

Secrets (GitHub → Settings → Secrets and variables → Actions → **Repository** secrets):

| Secret | Conteúdo |
|---|---|
| `VPS_HOST` | hostname ou IP do SSH (o mesmo que consta em `VPS_KNOWN_HOSTS`) |
| `VPS_USER` | usuário SSH (`flivocom`) |
| `VPS_PORT` | porta SSH, em geral `22` |
| `VPS_SSH_KEY` | chave privada da conta de deploy (PEM, com quebras de linha reais) |
| `VPS_KNOWN_HOSTS` | linha(s) de `known_hosts` desse host |

Não usar Environment secrets sem declarar `environment:` no job — o workflow não lê isso. Não usar `StrictHostKeyChecking=no`.

Não inicia Vite, não mexe em Apache, systemd, FastAPI nem MariaDB.

### Backend (ainda manual)

O runtime `/home/flivocom/pi4-backend` **não** entra neste workflow.

Quando o Vite existir, o document root deve receber o **resultado do build** (`dist/`), não `node_modules/` nem um processo Node em produção. Node.js não é daemon do PI. O processo persistente continua sendo só o FastAPI via systemd.

Node na VPS: **24.21.0** via NVM 0.40.7 do usuário `flivocom`. Não alterar Node global/cPanel.

---

## Backend (Uvicorn + systemd)

Informação de ambiente fornecida e já validada:

- serviço: `pi4-backend.service`
- usuário: `flivocom` (não root)
- executa o Python do `.venv`
- Uvicorn escuta apenas `127.0.0.1:8000`
- inicia automaticamente e reinicia em falha
- `.env` real em `/home/flivocom/pi4-backend/.env`, com permissão restrita

O repositório **não** contém unit file, script de deploy ou o `.env` de produção. Correto.

---

## Apache (reverse proxy)

Informação de ambiente fornecida e já validada:

```
https://pi4.flivo.com.br/api/*  →  http://127.0.0.1:8000/api/*
```

Módulos informados como presentes: `proxy_module`, `proxy_http_module`, `proxy_wstunnel_module`.

A API não deve ser exposta diretamente na porta 8000 para a internet.

---

## Banco

| Item | Valor informado |
|---|---|
| SGBD | MariaDB 10.11 |
| Versão citada na validação prévia | `10.11.19-MariaDB` |
| Banco | `flivocom_pi4` |
| Usuário da aplicação | `flivocom_pi4app@localhost` |
| Host | localhost |
| Porta | 3306 |

Não usar root da aplicação. Não acessar bancos de outros sistemas. Não criar tabelas nesta fase.

O MCP MySQL eventualmente disponível no Cursor de um desenvolvedor **não** é, por padrão, o banco do PI. Não consultar outros schemas.

---

## O que esta inspeção confirmou de fora do Git

| Verificação | Resultado em 2026-09-10 |
|---|---|
| `GET https://pi4.flivo.com.br/api/status` | Confirmado: `{"status":"ok","backend":"FastAPI","python":"3.12"}` |
| `GET https://pi4.flivo.com.br/` | Confirmado: HTML da página de fumaça publicado |
| `GET https://pi4.flivo.com.br/api/status/banco` | Não confirmado nesta inspeção (timeout). Permanece como validação prévia de ambiente |

O frontend publicado ainda é o smoke test do repositório (títulos e checagem de API). O fetch estático da página não executa o JavaScript; isso não indica falha do browser real.

---

## Isolamento — o que agentes não devem fazer

- alterar Python 3.9 do sistema;
- instalar Node/npm de forma que altere o cPanel ou outros sítios (a forma segura, se necessária, virá da auditoria 0.2);
- substituir MariaDB global;
- mudar VirtualHosts de outros domínios;
- usar root na aplicação;
- abrir a API fora de localhost;
- executar DDL/DML exploratória em bancos alheios;
- mudanças de infraestrutura amplas ou irreversíveis.

Mudanças de infra, se necessárias, devem ser pequenas, locais ao PI e reversíveis.
