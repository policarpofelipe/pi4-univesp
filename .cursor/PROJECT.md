# PI4 UNIVESP — Análise de Dados do Suporte Técnico

Documento de identidade e escopo. Fonte de verdade conceitual do projeto.

Leitura complementar: `ARCHITECTURE.md`, `DATA.md`, `MACHINE_LEARNING.md`, `DEVELOPMENT.md`, `DEPLOYMENT.md`, `ROADMAP.md`, `DECISIONS.md`, `UI.md`.

---

## Identidade

| Campo | Valor |
|---|---|
| Nome de trabalho | PI4 UNIVESP — Análise de Dados do Suporte Técnico |
| Curso | Engenharia de Computação — UNIVESP |
| Natureza | Projeto Integrador 4 |
| Tipo | Projeto acadêmico, não produto SaaS |

O sistema deve ser explicável na banca: cada componente precisa ter responsabilidade clara e justificativa acadêmica.

---

## Objetivo acadêmico

Desenvolver análise de dados em escala utilizando um conjunto de dados existente e aprendizagem de máquina, com interface para visualização dos resultados.

O projeto deve demonstrar, de forma concreta:

- uso de um conjunto de dados **existente** (chamados reais de suporte);
- armazenamento estruturado em banco de dados;
- tratamento e análise de dados;
- manipulação de uma massa relevante de registros;
- interface/dashboard interativa;
- filtros que alterem a análise durante o uso;
- aprendizagem de máquina com scikit-learn;
- interpretação dos resultados;
- aplicação a um problema operacional real.

---

## Problema

Dashboard para análise dos atendimentos do suporte técnico, a partir de dados reais de chamados, a fim de identificar padrões, gargalos e oportunidades de melhoria operacional.

O sistema deve produzir **evidências**. Não deve antecipar conclusões operacionais.

---

## Perguntas que o sistema deve responder

- Em quais horários ocorre maior volume de chamados?
- Quais dias da semana possuem maior demanda?
- Existem gargalos em horários específicos?
- O horário de almoço apresenta comportamento diferente?
- O período após as 20h apresenta degradação do atendimento?
- Aos sábados, com equipe reduzida, há aumento de tempo ou acúmulo?
- O aumento de demanda está associado a aumento do tempo de atendimento?
- Quais setores recebem mais chamados?
- Quais operadores concentram maior quantidade de atendimentos?
- Qual o tempo médio dos atendimentos?
- Como estão distribuídas as avaliações dos clientes?
- Quais clientes/revendas geram maior volume de chamados?
- Quais clientes possuem maior tempo médio de atendimento?
- Quais apresentam problemas recorrentes?
- Quais clientes possuem avaliações negativas?
- Existem clientes que deveriam entrar em uma área de "Ponto de Atenção"?

Hipóteses operacionais conhecidas (a testar, não a assumir):

- horário de almoço como possível gargalo;
- após as 20h existe apenas um operador disponível;
- aos sábados a equipe é reduzida.

Essas situações **não** devem ser tratadas como causa comprovada de piora. O dashboard deve permitir sustentá-las ou rejeitá-las com dados. Correlação não é causalidade.

Exemplo: um operador com maior tempo médio **não** implica automaticamente baixo desempenho; ele pode receber chamados mais complexos.

---

## Impacto esperado

O dashboard deve transformar registros operacionais em informação útil sobre:

- quando a demanda acontece;
- onde existem gargalos;
- quais clientes precisam de atenção;
- quais padrões operacionais aparecem;
- como o dimensionamento da equipe se relaciona com a demanda;
- quais situações merecem investigação.

Possíveis benefícios (a avaliar com evidências, não a afirmar de antemão): melhor distribuição de operadores, dimensionamento, redução de tempo, identificação de reincidência, apoio a treinamentos, atuação preventiva e uso mais eficiente das horas da equipe.

---

## Escopo

Dentro do escopo:

- inventário e modelagem dos dados reais de suporte;
- persistência analítica em MariaDB;
- API FastAPI para o dashboard;
- frontend HTML/CSS/JS (Vanilla, ES Modules) com Vite e Plotly.js;
- análises estatísticas e filtros combináveis;
- um problema de ML justificado pelos dados, com scikit-learn;
- interpretação acadêmica dos resultados.

Fora do escopo, salvo solicitação explícita e necessidade concreta:

- React, Vue, Angular, Svelte, TypeScript;
- Bootstrap, Tailwind, Material UI e bibliotecas completas de componentes;
- Node.js como **backend** (Node/npm/Vite são só toolchain de frontend);
- Streamlit;
- Redis, Kafka, Spark, Hadoop;
- Kubernetes, microsserviços, filas, WebSockets;
- múltiplos bancos ou arquitetura distribuída;
- produto SaaS, autenticação empresarial, multi-tenant;
- CI/CD complexo;
- alteração da infraestrutura compartilhada da VPS.

---

## Princípios

O PI é acadêmico de Engenharia de Computação (UNIVESP). Cada tecnologia deve atender, ao mesmo tempo:

1. aderência à formação (programação, banco, web, APIs, engenharia de software, IHC, visualização, análise de dados, ML);
2. uso atual e profissional;
3. complexidade proporcional ao problema.

Priorizar clareza, rastreabilidade, código compreensível pelo grupo e separação de responsabilidades.

**Complexidade essencial > complexidade acidental.** Não introduzir tecnologia só para parecer sofisticado. O grupo deve conseguir explicar cada componente na banca.

Quando houver uma solução simples e correta e outra sofisticada sem benefício concreto, usar a simples.

Interface: `UI.md` (WCAG 2.2 AA + padrões visuais internos).

---

## Estado em uma frase

Infraestrutura de publicação e a ponte Browser → Apache → FastAPI → MariaDB já existem e funcionam. O domínio analítico (dados, schema, dashboard, ML) ainda não foi iniciado.
