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

`GET /api/status/banco` não respondeu a tempo nesta inspeção; a validação prévia do grupo permanece como referência de ambiente.

### Não concluído (domínio do PI)

| Item | Situação |
|---|---|
| Inventário da fonte real de dados | Não iniciado |
| Schema definitivo | Não iniciado |
| Processo de importação | Não iniciado |
| Anonimização definitiva | Não iniciado |
| Endpoints reais do dashboard | Não iniciado |
| Layout/dashboard | Não iniciado (só smoke test) |
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
0. Base documental (.cursor/)          ← esta etapa
        ↓
1. Análise e modelagem dos dados       ← próxima
        ↓
2. Schema analítico mínimo + importação
        ↓
3. API de consulta para o dashboard
        ↓
4. Dashboard (filtros, KPIs, gráficos)
        ↓
5. EDA formal e definição do problema de ML
        ↓
6. Treino, avaliação, interpretação
        ↓
7. Integração pontual dos resultados de ML
        ↓
8. Deploy simples, testes e texto acadêmico
```

Dependência dura: **1 bloqueia 2**. **2 bloqueia 3 e 5**. **3 e 4 podem se sobrepor** depois do contrato mínimo da API. **5 bloqueia 6**. **6 bloqueia 7**. Deploy formal (8) pode ser esboçado em paralelo, sem automatização complexa.

---

## Próxima tarefa (fase 1) — não executar até autorização

**Objetivo:** descobrir o formato real dos dados de suporte, sem criar schema.

**Trabalho:**

1. identificar a fonte;
2. identificar tabelas/CSV/API disponíveis;
3. levantar campos;
4. definir o significado de cada campo;
5. avaliar volume;
6. avaliar datas disponíveis;
7. avaliar valores ausentes;
8. avaliar avaliações (existência, distribuição, negativos);
9. avaliar relações cliente / operador / setor;
10. identificar dados a anonimizar;
11. formular proposta de schema analítico **mínimo** (ainda como documento, não necessariamente DDL aplicado);
12. só então, numa fase seguinte, criar migrations/schema SQL.

**Critério de conclusão da fase 1:**

- fonte identificada e descrita;
- dicionário de campos da origem;
- números de volume, período e qualidade;
- lista do que será anonimizado e como;
- proposta de schema mínimo justificada pelos dados reais;
- nenhuma tabela criada "no chute";
- nenhum dado identificável enviado ao GitHub.

---

## Trabalho paralelo possível (depois da fase 1)

Sem conflito, após o dicionário de dados:

- esboço de contrato da API (nomes de endpoints e filtros) em documento;
- esboço de layout do dashboard no papel/HTML estático **sem** fingir dados reais;
- texto acadêmico de introdução/metodologia.

Ainda assim, implementação de API analítica, gráficos com dados e ML esperam as fases 2+.

---

## O que nenhum agente deve fazer até a fase correspondente

- criar tabelas ou "completar" o modelo;
- implementar dashboard Plotly;
- treinar ou escolher algoritmo de ML como decisão fechada;
- gerar dados fictícios para parecer pronto;
- redesenhar stack, Apache, systemd ou Python do sistema;
- introduzir React, Streamlit, Redis, filas, etc.
