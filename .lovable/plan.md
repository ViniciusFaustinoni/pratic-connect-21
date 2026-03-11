

# Auditoria Parte 4 — Interface do Diretor: Diagnóstico e Plano

## Mapeamento: Regra de Negócio vs. Estado Atual

### AREA 1 — Gestao de Planos

**O que existe**: Aba "Produtos & Planos" em `GestaoComercial.tsx` com layout master-detail funcional (`ProdutosPlanos.tsx`). Lista planos com filtro por linha, contagem de associados, e painel de detalhes com sub-abas (Precos, Coberturas, Beneficios, Detalhes). Criacao/edicao usa `PlanFormModal` (unificado na Parte 1).

**Status**: Funcional. Atende a regra de negocio para visualizacao e edicao.

**Lacunas**:
1. **Formulario nao e em etapas (wizard)** — a regra exige 5 etapas sequenciais (dados basicos → categorias/cotas → coberturas → adicionais compativeis → grade de precos). O `PlanFormModal` atual e um formulario de campo unico com scroll, sem validacao por etapa nem bloqueio de ativacao.
2. **Nao gerencia adicionais compativeis** — nao existe etapa para definir quais `beneficios_adicionais` sao compativeis com o plano. O conceito de `linhas_permitidas` foi adicionado na Parte 2, mas a configuracao e feita no beneficio, nao no plano.
3. **Ativacao sem validacao** — a regra diz "um plano so pode ser ativado apos todas as etapas preenchidas". O toggle de ativo/inativo funciona sem nenhuma verificacao.
4. **Exclusao sem protecao** — a regra diz "plano ativo nao pode ser excluido, apenas inativado". O botao de excluir funciona sem checar se o plano esta ativo ou se tem associados vinculados.
5. **Alerta de inativacao** — a regra diz que ao inativar, o sistema deve alertar quantos associados estao vinculados. O toggle nao exibe esse alerta.

### AREA 2 — Gestao de Beneficios Adicionais

**O que existe**: `BeneficiosAdicionaisConfig.tsx` (componente standalone em `/planos/`) com CRUD completo — nome, codigo, preco, categoria, regioes, toggle ativo. Exibe coluna "Linhas" (adicionada na Parte 2).

**Status**: Funcional, mas **nao esta integrado na aba Gestao Comercial**.

**Lacunas**:
1. **Componente orfao** — `BeneficiosAdicionaisConfig` nao e renderizado em nenhuma pagina. Nao esta na Gestao Comercial nem em nenhuma rota. O `BeneficioAdicionalModal` (que gerencia `linhas_permitidas`) tambem e um componente orfao.
2. **Falta contagem de associados** — a regra exige exibir "quantos associados ativos possuem aquele adicional contratado". Com a tabela `associados_beneficios_adicionais` criada na Parte 2, isso e possivel mas nao esta implementado.
3. **Sem aviso de retroatividade** — a regra diz que ao editar o preco, o sistema deve avisar que "a alteracao vale apenas para novos contratos". Nao existe esse aviso no formulario.

### AREA 3 — Tabela de Quotas (Atuarial)

**O que existe**: `FaixasCotas.tsx` em `/diretoria/faixas-cotas` — grade editavel de faixas FIPE com ajuste percentual, historico versionado, e simulacao de impacto. `RateioConfig.tsx` em `/configuracoes/rateio` — multiplicadores por categoria (passeio, app, diesel, moto), taxa admin, dias de fechamento/vencimento.

**Status**: Parcialmente funcional — as paginas existem e estao corretas.

**Lacunas**:
1. **Faixas de Cotas nao esta no menu da Diretoria** — a rota `/diretoria/faixas-cotas` existe mas nao tem link no sidebar. Inacessivel sem digitar URL.
2. **Falta contagem de associados por faixa** — a regra exige exibir ao lado de cada linha da grade "a quantidade de associados ativos naquela faixa/categoria". Nao implementado.
3. **Nao segmenta por categoria** — a grade tem faixas FIPE com ajuste percentual unico. A regra exige colunas por categoria (passeio, app, moto, diesel) com quota diferente para cada combinacao. O multiplicador por categoria existe em `RateioConfig`, mas e global (nao por faixa).

### AREA 4 — Simulador de Rateio

**O que existe**: `FechamentoMensal.tsx` em `/diretoria/fechamento` — wizard de 3 etapas (despesas → calculo → faturas). Funciona como o simulador + fechamento real. Tem preview de faturas antes de confirmar.

**Status**: Funcional — o wizard de fechamento ja atende como simulador (Etapa 2 mostra preview antes de gerar faturas na Etapa 3).

**Lacuna**:
1. **Nao e acessivel pelo menu** — a rota `/diretoria/fechamento` existe mas nao tem link no sidebar. O link "Rateio" no sidebar aponta para `/diretoria/rateios` (RateioSinistros.tsx — pagina legada que opera sobre a tabela `rateios`).

---

## Plano de Implementacao

### Fase 1: Integrar componentes orfaos na Gestao Comercial

Adicionar uma **4a aba** na `GestaoComercial.tsx`: "Beneficios Adicionais" que renderiza `BeneficiosAdicionaisConfig`.

**Arquivos a alterar**:
- `src/components/gestao-comercial/TabNavigation.tsx` — adicionar tab "Adicionais"
- `src/pages/diretoria/GestaoComercial.tsx` — renderizar `BeneficiosAdicionaisConfig` na tab 3

### Fase 2: Corrigir navegacao do sidebar

1. Alterar o link "Rateio" de `/diretoria/rateios` para `/diretoria/fechamento`
2. Adicionar link "Faixas & Cotas" apontando para `/diretoria/faixas-cotas`
3. Manter link "Atuarial" (indicadores) como esta

**Arquivo**: `src/components/layout/AppSidebar.tsx`

### Fase 3: Proteger ativacao e exclusao de planos

No `ProdutosPlanos.tsx`:
1. Impedir exclusao de plano ativo — desabilitar botao "Excluir" e exibir tooltip "Inative o plano antes de excluir"
2. No toggle de ativar/desativar — mostrar AlertDialog com contagem de associados antes de inativar
3. No toggle de ativar — validar que o plano tem pelo menos 1 cobertura e precos vinculados antes de permitir ativacao

**Arquivo**: `src/components/gestao-comercial/ProdutosPlanos.tsx`

### Fase 4: Adicionar contagem de associados nos beneficios adicionais

No `BeneficiosAdicionaisConfig.tsx`:
1. Fazer query em `associados_beneficios_adicionais` agrupando por `beneficio_adicional_id` onde `ativo = true`
2. Exibir contagem na coluna da tabela
3. Ao editar preco, exibir alerta: "A alteracao vale apenas para novos contratos. Os X associados atuais mantem o valor contratado."

**Arquivo**: `src/components/planos/BeneficiosAdicionaisConfig.tsx`

### Fase 5: Adicionar contagem de associados por faixa na tabela de cotas

No `FaixasCotas.tsx`:
1. Query em `associados` com join em `veiculos` para obter `valor_fipe` de cada veiculo ativo
2. Agrupar por faixa FIPE e exibir badge com contagem ao lado de cada linha

**Arquivo**: `src/pages/diretoria/FaixasCotas.tsx`

---

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/gestao-comercial/TabNavigation.tsx` | Adicionar aba "Adicionais" |
| `src/pages/diretoria/GestaoComercial.tsx` | Renderizar BeneficiosAdicionaisConfig |
| `src/components/layout/AppSidebar.tsx` | Corrigir links Rateio e Faixas |
| `src/components/gestao-comercial/ProdutosPlanos.tsx` | Proteger exclusao/ativacao com validacoes |
| `src/components/planos/BeneficiosAdicionaisConfig.tsx` | Contagem associados + aviso retroatividade |
| `src/pages/diretoria/FaixasCotas.tsx` | Contagem associados por faixa |

