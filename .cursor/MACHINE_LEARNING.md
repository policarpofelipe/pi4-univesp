# Aprendizagem de máquina

ML com scikit-learn é **requisito acadêmico real**. Ainda assim, o projeto não deve escolher algoritmo só para "ter IA".

A pergunta de ML só deve ser fechada depois da análise exploratória e da avaliação de qualidade/quantidade dos dados. Ver `DATA.md` e `ROADMAP.md`.

---

## Estado

- scikit-learn consta em `backend/requirements.txt` e ainda **não é usado** no código.
- Não existe pasta `ml/` no repositório.
- Target, features, algoritmo e limiar de "demorado" estão **abertos**.
- Não treinar, não persistir modelo e não criar endpoint de inferência até a fase correspondente.

---

## Sequência metodológica obrigatória

```
dados → limpeza → análise exploratória → formulação da pergunta
      → feature engineering → treino/teste → modelo
      → avaliação → interpretação
```

Não pular EDA. Não definir target no escuro.

---

## Hipóteses candidatas (não escolhidas)

### 1. Atendimento demorado (classificação)

Pergunta: a partir das características do chamado, quais atendimentos têm maior probabilidade de se tornarem demorados?

- Target possível: `atendimento_demorado` = sim/não.
- A definição objetiva de "demorado" deve vir dos dados ou de regra operacional explícita, não de um corte arbitrário sem análise.
- Features possíveis, se existirem: hora, dia da semana, setor, categoria, histórico, contexto de equipe reduzida.

Uma Árvore de Decisão é **candidata** porque é simples, interpretável e adequada ao escopo acadêmico. Não está fechada.

### 2. Insatisfação / avaliação negativa

Só é válida se houver quantidade suficiente de avaliações, especialmente negativas. Forte escassez ou desbalanceamento → não forçar esse target.

### 3. Clustering

Pode ser considerado se fizer sentido aos dados e à disciplina. Não implementar múltiplos modelos só para parecer completo.

---

## O que ML não é

- "Clientes com ponto de atenção" **não** é, por padrão, um modelo de ML. Pode ser heurística. Ver `DATA.md`.
- Feature importance **não** é causalidade.
- Um operador com maior tempo médio **não** é automaticamente "pior".
- Treinar de novo a cada filtro do dashboard **não** é necessário. Treino pode ser offline; inferência, se houver, deve ser controlada.

---

## Critérios para fechar a pergunta

Só formular o problema de ML quando for possível responder:

1. Qual a pergunta, em uma frase, ligada ao problema do PI?
2. Qual o target, como é construído, e com que justificativa?
3. Que features estarão disponíveis **no momento da predição** (sem vazamento)?
4. Há volume e qualidade suficientes?
5. Como será o split treino/teste (e, se couber, validação temporal)?
6. Quais métricas são apropriadas, além de accuracy?
7. Como o resultado será interpretado na banca?

Se essas respostas não existirem, a pergunta permanece aberta.

---

## Riscos metodológicos

| Risco | Como evitar |
|---|---|
| Data leakage | Não usar informação futura (ex.: data de encerramento) para "prever" duração já determinada por ela |
| Causalidade falsa | Interpretar associações; não afirmar que hora/operador/setor "causam" atraso |
| Desbalanceamento | Não se apoiar só em accuracy; usar métricas adequadas à classe minoritária |
| Corte arbitrário de "demorado" | Justificar por distribuição, percentil ou regra operacional documentada |
| Escassez de avaliações | Não forçar target de insatisfação |
| Irreprodutibilidade | Fixar `random_state` quando aplicável; registrar versão das libs e do conjunto usado |

---

## Reprodutibilidade

Quando a fase de ML for autorizada:

- registrar a definição do target;
- versionar código de treino, não necessariamente o dataset identificável;
- persistir artefatos de modelo fora do Git se contiverem informação derivada de dados sensíveis, ou em caminho combinado (`models/` já está no `.gitignore`);
- documentar métricas e limitações em linguagem acessível à banca.
