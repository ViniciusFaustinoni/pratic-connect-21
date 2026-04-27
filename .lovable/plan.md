## Visão geral

Há 6 relatos de erro na fila. Vou corrigir os 3 reais (P0/P1) e descartar os 3 que são testes/já validados. Após cada correção real, mudo o status do relato para `testar` para você validar.

## Mapa dos relatos

| # | Área | Status atual | Ação |
|---|---|---|---|
| 1 | "Consultor estar tendo acesso nosso banco de dados" — Dashboard mostra base ativa e funil completo para vendedor | aberto | **Corrigir** + status → testar |
| 2 | "VERIFICAR SUB" — substituição entrou como nova venda | aberto | **Corrigir** + status → testar |
| 3 | "MONITORAMENTO" — técnico finalizou vistoria sem informar IMEI; status ficou `agendada` | em_tratamento | **Corrigir** + status → testar |
| 4 | "Teste" — `Testestesshshshsjjsnsnananana` | validado | Descartar (lixo) |
| 5 | "Comercial" — não consegue criar cotação | validado | Descartar (já validado) |
| 6 | "estesteste" — `testestestererssrsdsd` | validado | Descartar (lixo) |

## Correção 1 — Dashboard do vendedor não pode ver dados da empresa inteira

**Problema técnico**: `src/pages/Dashboard.tsx` consome `useContratos()` e `useLeadsFunnel()` sem filtrar por vendedor. As RLS recém-aplicadas já restringem `contratos`, mas `leads` e o KPI de "Associados Ativos" continuam globais para gestores e o vendedor segue vendo o `FunilCotacaoChart` agregado quando montado fora do escopo.

**Mudanças**:
- No `Dashboard.tsx`, quando o usuário for vendedor não-gestor (`isVendedorOnly`):
  - Filtrar `useContratos` por `vendedor_id = profile.id` (adicionar parâmetro de filtro no hook ou aplicar `.filter` client-side já que RLS limita).
  - Filtrar `useLeads`/`useLeadsFunnel` por `vendedor_id`.
  - Ocultar o KPI "Associados Ativos" global e substituir por "Meus Associados Ativos" (já filtrado).
  - Garantir que o `FunilCotacaoChart` recebe filtro por vendedor (já é automático no `useFunilCotacao`, validar prop).
- Adicionar `vendedor_id` opcional em `useLeadsFunnel` e `useContratos` (default `null`).
- Em `useDocumentosContagem` e `usePendingDocumentos`: também escopar por vendedor (documentos cujo associado pertence ao vendedor).

**Resultado**: vendedor vê apenas KPIs, leads, contratos, funil e documentos da própria carteira.

## Correção 2 — Substituição de veículo entrando como Nova Venda

**Problema técnico**: O `useCotacao` grava `tipo_entrada` em `cotacoes.dados_extras` (jsonb), mas `supabase/functions/contrato-gerar/index.ts` lê `cotacao.tipo_entrada` (coluna inexistente) → sempre cai em `'adesao'` → contrato vira nova venda, com carência cheia, sem isenção e sem vínculo com o veículo antigo.

**Mudanças**:
- Migração SQL: adicionar coluna `cotacoes.tipo_entrada text` (nullable) + backfill a partir de `dados_extras->>'tipo_entrada'` para registros existentes.
- Atualizar `useCotacao.ts` para gravar `tipo_entrada` na coluna direta (mantendo `dados_extras` como fallback de compatibilidade).
- `contrato-gerar/index.ts` passa a ler a coluna direta; se nula, faz fallback para `dados_extras->>'tipo_entrada'`.
- Confirmar que, quando `tipo_entrada = 'substituicao'`, o contrato não duplica o veículo antigo e referencia a substituição correta (já existe lógica para `substituicao_placa` em `autentique-create`).

**Resultado**: cotações marcadas como substituição geram contratos com `tipo_entrada` correto, sem virar nova venda.

## Correção 3 — Técnico finaliza vistoria sem informar IMEI; status fica "agendada"

**Problema técnico**: `ExecutarVistoriaCompleta.tsx` calcula `veiculoPrecisaRastreador` (FIPE ≥ R$ 30k para carro / R$ 9k para moto) e exibe a categoria de fotos do rastreador, mas **nunca solicita o IMEI**. O `useAprovarVeiculoVistoria` marca a `instalacao` como `concluida` sem setar `rastreador_id`. Em alguns fluxos a instalação fica como `agendada` porque a `vistoria` está vinculada por `servico_id`/`agendamento_base_id` em vez de `instalacao_id`, então o passo 4 do hook (`if (data.instalacaoId)`) não executa.

**Mudanças**:
- Adicionar **Step de vínculo de rastreador** no `ExecutarVistoriaCompleta.tsx` quando `veiculoPrecisaRastreador === true`:
  - Campo IMEI (com leitura de QR/barcode opcional reutilizando o `BarcodeScanner` já existente).
  - Busca em `rastreadores` pelo IMEI; valida se está disponível (sem `veiculo_id` vinculado e status compatível).
  - Bloqueia botão "Aprovar" enquanto IMEI não estiver vinculado (somente quando obrigatório).
- Atualizar `useAprovarVeiculoVistoria` para aceitar `rastreadorId?: string`:
  - Setar `instalacoes.rastreador_id` e `veiculos.rastreador_id`.
  - Atualizar `rastreadores` setando `veiculo_id`, `instalado_em = now()` e status para `instalado`.
- Garantir resolução robusta da `instalacao_id`: se `data.instalacaoId` vier nulo, tentar localizar a instalação pelo `servico_id` ou pela `vistoria.instalacao_id` antes de pular o passo 4.
- Trigger SQL leve: ao concluir uma `instalacao` com `rastreador_id` preenchido e `vistoria` aprovada, garantir transição automática para `concluida` (defesa em profundidade).

**Resultado**: técnico não consegue finalizar a vistoria sem informar o IMEI quando o veículo exige rastreador; instalação avança corretamente para `concluida` com vínculo de rastreador registrado.

## Atualização de status dos relatos

Após aplicar cada correção, atualizo o relato correspondente:

- Relato 1, 2, 3 → `status = 'em_tratamento'` enquanto trabalho, depois `'testar'` com `observacao_diretor` descrevendo o que foi corrigido.
- Relato 4, 5, 6 → `status = 'descartado'` com `motivo_descarte` apropriado ("conteúdo de teste" / "já validado em produção").

## Detalhes técnicos resumidos

**Arquivos a alterar**:
- `src/pages/Dashboard.tsx`
- `src/hooks/useContratos.ts`, `src/hooks/useLeads.ts`, `src/hooks/useDocumentos.ts` (aceitar filtro `vendedor_id`)
- `src/hooks/useCotacao.ts`
- `src/pages/instalador/ExecutarVistoriaCompleta.tsx`
- `src/hooks/useVistoriaCompleta.ts`
- `supabase/functions/contrato-gerar/index.ts`

**Migrações SQL**:
1. `alter table cotacoes add column tipo_entrada text` + backfill.
2. Trigger opcional para conclusão de instalação com rastreador.

**Validação**: após deploy, peço para você logar como vendedor de teste e validar dashboard escopado; criar uma cotação de substituição e verificar que o contrato gerado tem `tipo_entrada='substituicao'`; abrir uma vistoria com FIPE ≥ R$ 30k e confirmar que o passo de IMEI aparece e bloqueia a finalização.
