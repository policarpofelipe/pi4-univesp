# Desenvolvimento

Convenções para trabalhar no repositório. Infraestrutura de produção: `DEPLOYMENT.md`.

---

## Estrutura real do repositório (inspeção 2026-09-10)

Único commit: `18319c5` — `Estrutura inicial do PI4`. Branch `main`, alinhada a `origin/main`.

```
pi4-univesp/
├── .gitignore
├── backend/
│   ├── app.py
│   ├── banco.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── index.html
```

Não existem no repositório, apesar do planejamento inicial:

- `sql/`
- `ml/`
- `README.md` na raiz
- testes automatizados
- CSS/JS separados
- Plotly.js

Não criar essas pastas só para "ficar igual ao plano". Criar quando a fase correspondente precisar delas.

---

## Convenções

- Linguagem do código e dos endpoints: português, alinhada ao que já existe (`testar_conexao`, `/api/status/banco`).
- Nomes claros; arquivos pequenos; uma responsabilidade por módulo.
- Evitar classes vazias, camadas "enterprise" e dependências sem uso novo.
- Commits pequenos e justificáveis.
- Não alterar a stack. Não adicionar framework frontend. Não adicionar banco extra.

Quando uma alteração for estrutural, consultar antes: `PROJECT.md`, `DECISIONS.md` e o impacto em backend, frontend, dados e deploy.

---

## Ambiente Python

- Python do projeto: **3.12** (na VPS, 3.12.14 no virtualenv).
- Python do sistema da VPS: 3.9 — **não substituir**.
- Dependências: `backend/requirements.txt` (freeze, não lista mínima).
- Configuração local/runtime: arquivo `.env` **não versionado**, baseado em `.env.example`.

Variáveis esperadas:

```
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
```

`backend/banco.py` monta `mysql+pymysql://...` e aplica `urllib.parse.quote_plus` na senha.

### Observação para desenvolvimento local em Windows

O freeze inclui `uvloop`, típico de Linux. Instalar `requirements.txt` à risca em Windows pode falhar. Isso não muda a stack de produção (AlmaLinux). Se for necessário um ambiente local Windows, tratar como exceção documentada — não remover `uvloop` do freeze de produção sem decisão explícita.

---

## Segurança no repositório

Nunca:

- versionar `.env` real;
- colocar senha em código, README ou arquivos de `.cursor/`;
- imprimir credenciais em log, resposta de API ou commit;
- substituir `.env` por segredo hardcoded.

O `.gitignore` atual cobre `.env`, `*.env`, `.venv/`, `venv/`, `__pycache__/`, `*.py[cod]`, `data/raw/`, `data/private/` e `models/`.

`.env.example` pode ser versionado, **somente com placeholders**.

### Divergência encontrada

`backend/.env.example` está no Git e contém um valor de `DB_PASSWORD` que **não parece placeholder**. Isso conflita com a política de não versionar credenciais.

Esta etapa **não alterou** o arquivo (correção silenciosa proibida). Ação recomendada, quando autorizada: trocar o exemplo por placeholder, rotacionar a senha no servidor e confirmar que o `.env` real permanece só no runtime, com permissão restrita.

Não copiar esse valor para documentação, chat ou novos arquivos.

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

- HTML/CSS/JS no diretório `frontend/`.
- Chamadas relativas a `/api/...` (o Apache faz o proxy). Não apontar o browser para `127.0.0.1:8000` em produção.
- Plotly.js ainda não está incluído; adicionar na fase de dashboard.
- Lógica analítica crítica permanece no backend.

---

## Testes

Ainda não há testes. Quando existirem, priorizar partes críticas: conexão/configuração sem vazar segredo, montagem de filtros, regras de agregação e, mais tarde, ausência de leakage no pipeline de ML.
