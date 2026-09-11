# Arquitetura

A arquitetura abaixo está **congelada**. Não substituir a stack nem redesenhar o fluxo sem solicitação explícita.

Detalhes de runtime: `DEPLOYMENT.md`. Decisões: `DECISIONS.md`.

---

## Arquitetura escolhida (dinâmica)

```
Navegador
    ↓
HTML + CSS + JavaScript (estáticos, gerados pelo Vite)
    ↓
HTTP / HTTPS
    ↓
Apache 2.4
    ├── arquivos do frontend (document root)
    └── /api/*  →  reverse proxy
                      ↓
                   FastAPI (Uvicorn em 127.0.0.1:8000)
                      ↓
                   Python 3.12
                      ↓
                   SQLAlchemy / PyMySQL
                      ↓
                   MariaDB 10.11
```

O frontend solicita dados ao backend **durante o uso**. Filtros podem resultar em consultas ou reprocessamentos. Isso não implica retreinar ML a cada clique.

Node.js e Vite **não** entram nesse fluxo em produção. São ferramentas de desenvolvimento e build. Node **não** substitui FastAPI.

---

## Arquitetura descartada

A alternativa estática abaixo **não** é a arquitetura do projeto:

```
MySQL → Python → JSON/CSV → GitHub Pages → JavaScript
```

Essa hipótese produziria um dashboard com dataset pré-processado, sem backend Python ativo. Foi rejeitada. Ver `DECISIONS.md` (ADR-002).

Streamlit também foi descartado (ADR-004).

---

## Stack congelada

### Backend e dados (produção)

| Camada | Tecnologia |
|---|---|
| Banco | MariaDB 10.11 |
| Backend / API | Python 3.12 + FastAPI |
| ASGI | Uvicorn |
| Execução persistente | systemd (`pi4-backend.service`) |
| Análise | Pandas |
| ML | scikit-learn |
| Apoio numérico | NumPy, quando necessário |
| Acesso a dados | SQLAlchemy + PyMySQL |
| Configuração | python-dotenv / variáveis de ambiente |
| Evolução de schema | Alembic (identidade; analítico ainda não) |
| Senhas | Argon2id via `pwdlib` |
| Servidor web | Apache 2.4 |
| Reverse proxy | Apache `/api/*` → FastAPI |

### Frontend (código e produção)

| Camada | Tecnologia |
|---|---|
| Linguagem | JavaScript moderno (ES Modules) |
| Markup | HTML5 semântico |
| Estilo | CSS próprio (tokens; ver `UI.md`) |
| Visualizações | Plotly.js |
| Resultado em produção | arquivos estáticos no document root Apache |

### Frontend (somente desenvolvimento / build)

| Ferramenta | Linha |
|---|---|
| Runtime de build | Node.js **24 LTS** |
| Gerenciador | **npm** (único; sem Yarn/pnpm) |
| Bundler / dev server | **Vite 8.x**, template Vanilla |
| Comandos previstos | `npm install` · `npm run dev` · `npm run build` |

Em produção: código em `frontend/` → `vite build` → `dist/` → Apache → navegador.

Não usar, salvo nova ADR: React, Vue, Angular, Svelte, TypeScript, Bootstrap, Tailwind, Material UI, bibliotecas completas de componentes, Node como backend.

O grupo chegou a citar MySQL; o servidor disponível usa MariaDB 10.11, e essa é a decisão oficial (ADR-003).

SQLAlchemy usa o dialect `mysql+pymysql`. Isso é compatível com MariaDB e **não** significa que o banco oficial seja MySQL.

---

## Componentes e responsabilidades

| Componente | Responsabilidade | O que não deve fazer |
|---|---|---|
| Frontend | Filtros, chamada a `/api/...`, KPIs, gráficos, loading e erro; build Vite | Regras analíticas críticas; tratamento pesado de dados; substituir FastAPI |
| Node.js / npm / Vite | Dev server e geração de `dist/` | Processo de produção do backend; API |
| Apache | HTTPS, document root dos estáticos, proxy de `/api/*` | Lógica de negócio |
| FastAPI | Fronteira HTTP; status, identidade/acesso e, depois, dashboard | Expor credenciais, stack traces, tokens em claro ou dumps da base |
| Python / Pandas | Preparação, EDA, feature engineering, transformações analíticas | Substituir SQL em filtros/joins/agregações simples |
| scikit-learn | Treino/avaliação/inferência do problema de ML escolhido | "Score de IA" sem pergunta definida; treino a cada clique |
| MariaDB | Persistência, filtros, joins, agregações básicas | Toda a análise estatística e o ML |
| GitHub | Código, versionamento, colaboração | Servidor da aplicação |

Separar corretamente:

- consulta dinâmica;
- análise estatística;
- agregações;
- treinamento de modelo;
- inferência;
- visualização.

Treinamento de ML pode ser controlado/offline, com modelo persistido depois, se for metodologicamente adequado.

---

## SQL versus Pandas

Evitar os dois extremos: puxar o banco inteiro para o Pandas a cada consulta simples, ou colocar toda a análise em SQL.

- **MariaDB/SQL:** filtros, joins, agregações básicas, redução do volume transferido, seleção de registros.
- **Pandas:** preparação, EDA, feature engineering, transformações analíticas, integração com scikit-learn.

"Dados em escala" neste PI significa massa relevante de registros, não Big Data. Não introduzir Spark/Hadoop sem necessidade objetiva.

---

## Separação repositório / runtime

Essa separação é intencional. Não alterar silenciosamente o modelo de deploy.

| Papel | Caminho |
|---|---|
| Repositório na VPS | `/home/flivocom/pi4-univesp` |
| Runtime backend | `/home/flivocom/pi4-backend` |
| Runtime frontend (document root) | `/home/flivocom/pi4.flivo.com.br` |
| Clone local inspecionado | `c:\dev\pi4-univesp\pi4-univesp` (Windows) |
| GitHub | `policarpofelipe/pi4-univesp` |

O GitHub não hospeda a aplicação. A aplicação roda na VPS.

---

## Mapeamento do código atual no repositório

| Arquivo | Papel atual |
|---|---|
| `backend/app.py` | FastAPI: `/`, `/api/status`, `/api/status/banco` + routers de autenticação e convites |
| `backend/config.py` | `DB_*`, `APP_URL`, SMTP, cookie, prazos de convite/sessão |
| `backend/banco.py` | Engine SQLAlchemy + `obter_sessao()` + `testar_conexao()` |
| `backend/datas.py` | `agora_utc()` — relógio UTC da aplicação |
| `backend/modelos.py` | `Usuario`, `ConviteUsuario`, `SessaoUsuario` |
| `backend/alembic/` | Revision `0001_identidade` (não aplicada em produção nesta etapa) |
| `backend/seguranca.py` | Argon2id; SHA-256 só para tokens |
| `backend/email_smtp.py` | SMTP_SSL do convite |
| `backend/rotas_autenticacao.py` / `rotas_convites.py` | Login, sessão, convites |
| `backend/scripts/criar_usuario_mestre.py` | Bootstrap interativo — **não executar** até autorização |
| `backend/requirements.txt` | Dependências **diretas** (não freeze transitivo) |
| `backend/.env.example` | Placeholders `DB_*` e `SMTP_*` (ADR-012) |
| `frontend/` | Vite 8 MPA: login, painel, convite, convites |

Não existem as pastas `sql/` e `ml/`. Plotly está em `package.json` e ainda não é usado em gráfico. O `dist/` de identidade **não** está publicado só por existir no repo.

---

## Estrutura atual de `frontend/`

```
frontend/
├── index.html          ← login institucional (home pública)
├── painel.html
├── convite.html
├── convites.html
├── package.json
├── vite.config.js      ← MPA (rollup input das quatro páginas)
└── src/
    ├── api/
    │   ├── client.js          ← credentials: include
    │   ├── autenticacao.js
    │   └── convites.js
    ├── paginas/
    │   ├── login.js
    │   ├── painel.js
    │   ├── convites.js
    │   └── aceitar-convite.js
    └── styles/
        ├── tokens.css
        └── main.css
```

JavaScript modular. Evitar `app.js` gigante, funções globais desnecessárias, lógica analítica importante no cliente, duplicação de chamadas à API e estilos inline. Sessão **não** vai para `localStorage`.

Normas visuais e WCAG: `UI.md`.

---

## Contrato HTTP

Prefixo público: `https://pi4.flivo.com.br/api/*` → `http://127.0.0.1:8000/api/*`

`GET https://pi4.flivo.com.br/` é o `index.html` do Apache (login), não o JSON do FastAPI.

| Método | Caminho | Comportamento |
|---|---|---|
| GET | `/` (FastAPI, localhost:8000) | `{"projeto": "PI4 UNIVESP", "status": "ativo"}` |
| GET | `/api/status` | `{"status": "ok", "backend": "FastAPI", "python": "3.12"}` |
| GET | `/api/status/banco` | status do banco ou HTTP 500 genérico |
| POST | `/api/autenticacao/entrar` | cookie `pi4_sessao` se senha ok |
| POST | `/api/autenticacao/sair` | revoga sessão |
| GET | `/api/autenticacao/usuario-atual` | usuário da sessão ou 401 |
| POST | `/api/convites` | só mestre; COMMIT + SMTP |
| GET | `/api/convites` | só mestre; sem token |
| POST | `/api/convites/validar` | público; `{valido}` |
| POST | `/api/convites/aceitar` | público; cria usuário |

O campo `python` em `/api/status` é literal `"3.12"`. Sessão: cookie HttpOnly (ADR-018). Origem: ADR-021.

Novos endpoints analíticos devem ser pequenos e orientados ao dashboard. Preferir query params para filtros. Não devolver a base inteira.
