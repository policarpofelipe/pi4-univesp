# Desenvolvimento

Convenções para trabalhar no repositório. Infraestrutura de produção: `DEPLOYMENT.md`.

---

## Estrutura do repositório

```
pi4-univesp/
├── .gitignore
├── backend/
└── frontend/          ← Vite 8 (ver estrutura em ARCHITECTURE.md)
```

Pastas `sql/` e `ml/` continuam ausentes de propósito. `README.md` na raiz ainda não existe.

---

## Convenções

- Linguagem do código e dos endpoints: português, alinhada ao que já existe (`testar_conexao`, `/api/status/banco`).
- Nomes claros; arquivos pequenos; uma responsabilidade por módulo.
- Evitar classes vazias, camadas "enterprise" e dependências sem uso novo.
- Commits pequenos e justificáveis.
- Não alterar a stack congelada. Não adicionar framework frontend (React/Vue/etc.). Não usar Node como backend. Não adicionar banco extra.

Quando uma alteração for estrutural, consultar antes: `PROJECT.md`, `DECISIONS.md`, `UI.md` (se for interface) e o impacto em backend, frontend, dados e deploy.

---

## Ambiente Python

- Python do projeto: **3.12** (na VPS, 3.12.14 no virtualenv).
- Python do sistema da VPS: 3.9 — **não substituir**.
- Dependências de runtime: `backend/requirements.txt` (lista **direta**, não freeze transitivo).
- Dependências de teste: `backend/requirements-dev.txt` (`pytest`, `httpx`).
- Configuração local/runtime: arquivo `.env` **não versionado**, baseado em `.env.example`.

Variáveis esperadas (placeholders em `.env.example`):

```
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
APP_URL
CONVITE_EXPIRACAO_HORAS
SESSAO_DURACAO_HORAS
COOKIE_SECURE
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
SMTP_USE_SSL
```

`backend/config.py` monta `mysql+pymysql://...` (ou `DATABASE_URL`) e aplica `urllib.parse.quote_plus` na senha.

Comandos a partir de `backend/` (venv 3.12):

```
python -m pip install -r requirements-dev.txt
python -m pytest
```

**Aviso:** a suíte usa SQLite em memória e **não** valida o schema MariaDB. O gate MariaDB é manual (`alembic upgrade head` + `SHOW CREATE TABLE`) e só depois da ADR-012.

Alembic e o script do mestre também a partir de `backend/`:

```
alembic upgrade head
python scripts/criar_usuario_mestre.py
```

Nenhum dos dois deve rodar em produção nesta etapa.

### Observação para desenvolvimento local em Windows

A lista direta não inclui `uvloop`. Produção na VPS continua Linux + Uvicorn. Não adicionar freeze transitivo de volta sem decisão.

---

## Segurança no repositório

Nunca:

- versionar `.env` real;
- colocar senha em código, README ou arquivos de `.cursor/`;
- imprimir credenciais em log, resposta de API ou commit;
- substituir `.env` por segredo hardcoded.

O `.gitignore` atual cobre `.env`, `*.env`, `.venv/`, `venv/`, `__pycache__/`, `*.py[cod]`, `data/raw/`, `data/private/` e `models/`.

`.env.example` pode ser versionado, **somente com placeholders**.

### Correção de 2026-09-10

`backend/.env.example` chegou a ser commitado com um valor de `DB_PASSWORD` que não era placeholder. O working tree agora usa só `altere-esta-senha`.

Isso **não apaga** o valor antigo do histórico do Git/GitHub. A correção completa exige:

1. commitar e enviar este exemplo sanitizado;
2. **rotacionar** a senha de `flivocom_pi4app` no MariaDB da VPS;
3. atualizar somente `/home/flivocom/pi4-backend/.env`;
4. reiniciar `pi4-backend.service` e validar `GET /api/status/banco`.

Não copiar o valor antigo para documentação, chat ou novos arquivos. Não reescrever o histórico do Git só para “apagar” a senha: quem já clonou o repositório ainda a teria; a rotação no servidor é o que invalida o segredo.

---

## Túnel SSH local (Windows)

O MCP da Reduz fala com MySQL remoto. O do PI4 não: `flivocom_pi4app` só aceita `localhost` na VPS. Por isso o Cursor neste Windows usa `127.0.0.1:3307` via túnel SSH.

Isso é configuração da **máquina do desenvolvedor**, não do repositório e não da VPS.

| Item | Onde |
|---|---|
| Chave privada | `%USERPROFILE%\.ssh\id_ed25519_pi4` |
| Host SSH | `pi4-vps` em `%USERPROFILE%\.ssh\config` |
| Watchdog do túnel | `%USERPROFILE%\.cursor\pi4-ssh-tunnel.ps1` |
| Log | `%USERPROFILE%\.cursor\pi4-ssh-tunnel.log` |
| Agendamento | Tarefa `PI4 SSH Tunnel` (no logon do Windows) |
| MCP | `pi4-mysql-readonly` em `%USERPROFILE%\.cursor\mcp.json` |

Não versionar chave privada, `mcp.json` com senha nem o script de túnel no Git do PI4.

---

## Git / GitHub

- Remoto: `https://github.com/policarpofelipe/pi4-univesp.git`
- GitHub é repositório de código, não servidor da aplicação.
- Não enviar dados sensíveis, dumps nem modelos treinados com dados identificáveis.
- Não criar CI/CD complexo agora.

---

## API

- FastAPI já expõe OpenAPI em runtime; usar como apoio, sem construir plataforma de API.
- Erros para o cliente: mensagens genéricas. `app.py` já evita devolver o traceback em `/api/status/banco`.
- Não expor caminhos internos da VPS nem nomes de outros bancos.

---

## Frontend

Stack congelada: Vanilla JS (ES Modules), HTML5, CSS próprio, Plotly.js. Toolchain: **Node.js 24 LTS**, **npm**, **Vite 8.x**. Detalhe visual/a11y: `UI.md`. Decisões: ADR-013 a ADR-016.

Estado do código: Vite 8 MPA (login, painel, convite, convites). Plotly está nas dependências e **não** é importado, para não inflar o bundle antes dos gráficos. `GET /api/status` permanece na API; a home pública é o login, não a tela de status.

Comandos (dentro de `frontend/`):

```
npm ci
npm run dev
npm run build
npm run lint
npm run format
npm run format:check
npm run check
```

- chamadas relativas a `/api/...` (Apache em produção; proxy Vite só em `npm run dev`, alvo `VITE_API_PROXY_TARGET` ou `http://127.0.0.1:8000`);
- `package-lock.json` versionado; `node_modules/` e `dist/` no `.gitignore`;
- único package manager: npm;
- JS modular em `src/`; lógica analítica crítica no backend;
- em produção: `npm run build` → publicar o conteúdo de `dist/` no document root (**ainda não publicado**).

Node local observado nesta máquina: 24.16.0. VPS validada: Node 24.21.0 via NVM do usuário `flivocom`. Não alterar Node global/cPanel.

### Toolchain de qualidade

| Camada | Ferramenta | Situação |
|---|---|---|
| JS | ESLint | Configurado (`eslint.config.js`) |
| JS | Prettier | Configurado |
| JS unitário | Vitest | Aprovado, **não** instalado |
| E2E | Playwright | Aprovado, **não** instalado |
| A11y automatizada | axe-core | Aprovado, **não** instalado |
| Python | pytest | Configurado (`backend/requirements-dev.txt`, SQLite em memória) |

Avaliação de acessibilidade combina ferramenta + teclado + foco + contraste + zoom + reflow + semântica + revisão humana.

---

## Testes

Backend: pytest + TestClient + SQLite em memória; SMTP mockado. **Não** substitui conferir a migration no MariaDB.

Cobertura desta etapa: hash Argon2id, token só em hash, convite expirado/usado, login ok/erro genérico, bloqueio, sessão expirada rejeitada, logout, 401, 403, e-mail já existente, segundo convite pendente, aceite que não se repete, falha SMTP que grava `erro_envio_em` sem apagar o convite.

Frontend: Vitest e Playwright continuam aprovados e **não** instalados. Lint/format/build: `npm run check` em `frontend/`.
