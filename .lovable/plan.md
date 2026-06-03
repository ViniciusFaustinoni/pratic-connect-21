## Diagnóstico

A tela `/cadastro/propostas-pendentes` (lista) NÃO conhece as duas sub-etapas canônicas do Cadastro. Quem mostra "Sub-etapa 1 → Sub-etapa 2" é só o **PropostaApprovalStepper**, que vive dentro da tela de análise individual (`PropostaAnalise`). Por isso o card da lista parece "desatualizado".

**Confirmado em produção agora:**
- 9 contratos hoje estão em `documentos_aprovados_em IS NOT NULL` + `cadastro_aprovado = false` (sub-etapa 1 OK, sub-etapa 2 pendente).
- 7 contratos com nada aprovado (sub-etapa 1 pendente).
- Todos os 9 aparecem na lista com o mesmo badge genérico ("Aguardando" / "Aguard. Vistoria"), sem diferenciar.

**Causa raiz:** `getStatusBadge()` em `src/pages/cadastro/PropostasPendentes.tsx` (linhas 165–222) só olha `status`, `tem_documento_pendente`, `cadastro_aprovado`, `vistoria` e `instalacao`. Nunca lê `documentos_aprovados_em`, mesmo o hook `usePropostasPendentes` já trazendo esse campo (linhas 219, 347–348, 847). Resultado: a única tela que mostra sub-etapa é a de análise individual; a lista, os KPIs e os filtros ficam cegos para esse estado intermediário.

## Correção

Tornar a sub-etapa visível na lista, sem mexer em backend/regra de negócio.

### 1. Novo badge "Docs OK — Liberar p/ Monitoramento"
Em `PropostasPendentes.tsx` › `getStatusBadge`:
- Receber também `documentos_aprovados_em` (já existe no objeto `proposta`).
- Antes dos blocos atuais de "Aguard. Vistoria" / "Pendente Vistoria Inicial", inserir:
  - Se `status='assinado'` + `documentos_aprovados_em IS NOT NULL` + `cadastro_aprovado=false` → badge novo (ex.: emerald) `Docs OK · Liberar Monitoramento`.
- Quando `documentos_aprovados_em IS NULL` + sub-etapa 2 ainda não cabível → manter "Aguardando" atual, mas com label `Aguard. Documentos (sub-etapa 1)` para deixar explícito.

### 2. Predicado + KPI
- Adicionar predicado `isSubEtapa1Ok(p)` ao lado de `isAguardandoDoc/isPendenteVistoriaInicial`.
- Incluir o novo grupo nos contadores/abas que listam os pendentes do Cadastro (mesma régua dos chips existentes), para o analista filtrar "só os que faltam liberar Monitoramento".

### 3. Sinal visual no próprio card (linha 2)
Pequeno chip auxiliar (ao lado do badge de status) quando `documentos_aprovados_em` setado:
`Sub-etapa 1 ✓ · falta sub-etapa 2`. Mantém compatibilidade com o badge principal e dá leitura instantânea no scroll.

### 4. Tooltip do badge novo
Texto curto: "Documentos já aprovados. Clique para abrir e finalizar a sub-etapa 2 (vistoria + liberação para Monitoramento)."

## Fora de escopo
- Não alterar `PropostaApprovalStepper`, edges (`aprovar-documentos-cadastro`, `aprovar-proposta`), triggers DB nem o hook (`usePropostasPendentes` já entrega o campo).
- Não mexer no fluxo de Troca (isenta da sub-etapa 1) — predicado novo já filtra por `documentos_aprovados_em IS NOT NULL`, então Trocas não disparam o badge indevidamente.

## Arquivos
- `src/pages/cadastro/PropostasPendentes.tsx` (badge + predicado + chip + assinatura de `getStatusBadge`).

## Validação
- Abrir a lista logada como admin: os 9 contratos identificados devem passar a exibir o novo badge "Docs OK · Liberar Monitoramento".
- Os 7 contratos sem documentos aprovados devem mostrar "Aguard. Documentos (sub-etapa 1)".
- Os 33 com `cadastro_aprovado=true` continuam com badges atuais ("Pendente Vistoria Inicial" / "Aguard. Instalação" etc).