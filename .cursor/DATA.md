# Dados e modelagem

O schema **analítico** não está fechado. Não criar tabelas, colunas ou migrations de **chamados** a partir deste documento.

A fonte de dados reais ainda precisa ser descoberta, inventariada e compreendida. Ver próxima fase em `ROADMAP.md`.

As tabelas de identidade (`usuarios`, `convites_usuarios`, `sessoes_usuarios`) existem no Alembic do backend e **não** são o schema analítico. Não aplicá-las no MariaDB até a rotação ADR-012 e autorização explícita.

---

## Estado confirmado

- Banco de aplicação: `flivocom_pi4`.
- Usuário de aplicação informado: `flivocom_pi4app@localhost`.
- O banco de produção ainda não recebeu a migration de identidade (gate manual pendente).
- Não há pasta `sql/` no repositório.
- Não há amostra de dados versionada — e dados reais identificáveis **não** devem ir para o GitHub.

---

## Estratégia

Antes de qualquer CREATE TABLE **analítico**:

1. identificar a fonte real (tabela operacional, CSV, exportação, API interna);
2. listar campos existentes e o significado de cada um;
3. avaliar volume, intervalo de datas, nulos, avaliações e relações;
4. marcar o que precisa de anonimização/pseudonimização;
5. só então propor um **schema analítico mínimo**;
6. só depois criar SQL/migrations.

Não desenhar o banco por imaginação. Não criar coluna apenas porque ela aparece como candidata abaixo.

---

## Entidades candidatas (não definitivas)

- chamados
- clientes / revendas
- operadores
- setores
- categorias
- avaliações

Só persistir o que a fonte realmente oferecer e o que a análise exigir.

---

## Atributos analíticos candidatos (não definitivos)

- identificador do chamado
- cliente
- operador
- setor
- categoria
- data/hora de abertura
- data/hora de início
- data/hora de encerramento
- tempo de espera
- tempo de atendimento
- status
- avaliação

---

## Features derivadas candidatas (Python, depois da fonte)

Calcular somente o que for sustentado pelos dados:

- hora, dia da semana, mês
- horário de almoço, após 20h, sábado, equipe reduzida
- duração
- avaliação negativa
- recorrência / volume histórico

Flags operacionais (almoço, após 20h, sábado) são **hipóteses a testar**, não verdades de schema.

---

## Hipóteses operacionais

Tratar como hipóteses, nunca como fato prévio:

| Hipótese | O que o dado precisa permitir |
|---|---|
| Almoço é gargalo | Comparar volume e tempos dentro vs fora da faixa de almoço |
| Após 20h o atendimento degrada | Relacionar faixa horária com volume, espera e duração, sabendo que há um operador |
| Sábado com equipe reduzida piora tempo ou acúmulo | Comparar sábados vs demais dias |

O aumento de demanda pode estar associado a aumento de tempo; isso é associação a medir, não causalidade a declarar.

---

## "Clientes com ponto de atenção"

Há interesse em destacar clientes com sinais como:

- avaliações negativas e/ou recorrentes;
- volume elevado;
- reincidência;
- tempo elevado de atendimento.

Ainda **não** há algoritmo. Não inventar "score de IA".

Se for adotada regra determinística, identificá-la explicitamente como **heurística de negócio**, distinta de machine learning.

---

## Qualidade e volume

Antes da modelagem definitiva, registrar:

- quantidade de registros;
- período coberto;
- percentual de nulos por campo crítico;
- existência e distribuição de avaliações (especialmente negativas);
- granularidade de cliente, operador, setor e categoria;
- se tempos são gravados ou precisam ser derivados de timestamps;
- se um chamado pode ter múltiplos atendentes ou reaberturas.

Sem esse inventário, qualquer schema é prematuro.

---

## Anonimização

Dados reais que identifiquem clientes ou pessoas exigem cuidado.

Para material acadêmico, publicação, GitHub e demonstrações:

- priorizar anonimização ou pseudonimização;
- não versionar dados brutos identificáveis;
- não enviar dumps operacionais ao GitHub;
- o `.gitignore` já reserva `data/raw/` e `data/private/`.

O processo definitivo de anonimização ainda não foi definido. Deve nascer do inventário da fonte.

---

## Filtros e indicadores (depois dos dados)

Filtros candidatos, somente se existirem na fonte: período, dia da semana, faixa de horário, setor, operador, cliente/revenda, categoria, avaliação.

Indicadores e gráficos só devem existir se responderem uma pergunta de `PROJECT.md`. Evitar redundância visual e não implementar o dashboard nesta fase.
