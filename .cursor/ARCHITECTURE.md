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
| FastAPI | Fronteira HTTP; endpoints pequenos e orientados ao dashboard | Expor credenciais, stack traces ou dumps da base inteira |
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

Confirmado na inspeção de 2026-09-10:

| Arquivo | Papel atual |
|---|---|
| `backend/app.py` | FastAPI mínimo: `/`, `/api/status`, `/api/status/banco` |
| `backend/banco.py` | Engine SQLAlchemy + `testar_conexao()` (`SELECT DATABASE(), VERSION()`) |
| `backend/requirements.txt` | Freeze da stack, incluindo Pandas e scikit-learn ainda não usados no código |
| `backend/.env.example` | Variáveis `DB_*` (ver risco em `DEVELOPMENT.md`) |
| `frontend/` | Vite 8 + Vanilla JS: status de `/api/status` e `/api/status/banco` |

Não existem ainda, no repositório, as pastas `sql/` e `ml/`. Plotly está em `package.json` e ainda não é usado em gráfico. O build **não** está publicado no document root.

---

## Estrutura atual de `frontend/`

```
frontend/
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── eslint.config.js
├── .nvmrc
├── .env.example
├── .prettierignore
└── src/
    ├── main.js
    ├── api/
    │   └── client.js
    └── styles/
        ├── tokens.css
        └── main.css
```

JavaScript modular. Evitar `app.js` gigante, funções globais desnecessárias, lógica analítica importante no cliente, duplicação de chamadas à API e estilos inline.

Normas visuais e WCAG: `UI.md`.

---

## Contrato HTTP já existente

Prefixo público: `https://pi4.flivo.com.br/api/*` → `http://127.0.0.1:8000/api/*`

| Método | Caminho | Comportamento |
|---|---|---|
| GET | `/` | `{"projeto": "PI4 UNIVESP", "status": "ativo"}` |
| GET | `/api/status` | `{"status": "ok", "backend": "FastAPI", "python": "3.12"}` |
| GET | `/api/status/banco` | status do banco ou HTTP 500 genérico |

O campo `python` em `/api/status` é literal `"3.12"`, não a versão detectada em runtime. O ambiente informado usa Python 3.12.14 no virtualenv.

Novos endpoints devem ser pequenos, documentados e orientados ao dashboard. Preferir query params para filtros. Não devolver a base inteira.
