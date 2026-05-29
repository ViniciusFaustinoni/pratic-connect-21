# Sincronizar badge "Etapa da Venda" com o status real do contrato

## Diagnóstico (caso TUG9J61, COT-20260528-144651474-166)

Banco no momento do print:
- `cotacoes.status='enviada'`, `status_contratacao='documentos_ok'`
- `contratos.status='visualizado'`, `autentique_status='viewed'` (cliente já está no Autentique assinando)

Lógica de `getEtapaVenda` (`src/lib/cotacaoEtapa.ts`):
- Com `contrato.status='visualizado'` → cai na regra de `['pendente_assinatura','enviado','visualizado']` → **deveria** retornar `assinando_contrato` ("Assinando Contrato").
- Sem contrato carregado (ou contrato ainda não existia), cai no fallback `statusContratacao==='documentos_ok'` → **`escolha_vistoria` ("Escolha de Vistoria")**. É exatamente o que está pintado no print.

Causa raiz: a lista `/vendas/cotacoes` usa `useCotacoesPaginadas` com `staleTime: Infinity` + `refetchOnWindowFocus: false` e **não tem nenhum listener realtime de `contratos` montado nessa página**. Resultado: quando o link público gera o contrato e o Autentique faz UPDATE de status (`enviado`/`visualizado`/`assinado`), a lista da tela de cotações nunca é invalidada, então o badge continua congelado na etapa antiga calculada a partir de `status_contratacao`.

`useContratosRealtime` (que já invalida `['cotacoes']` a cada UPDATE de `contratos`) existe e está montado em `Contratos.tsx` e `AtivacoesList.tsx`, mas **não** em `Cotacoes.tsx`. Mesma omissão acontece com a tela mobile.

## Mudança proposta (mínima, escopo UI/realtime)

1. **Montar `useContratosRealtime()` na `src/pages/vendas/Cotacoes.tsx`**
   - Import + chamada no topo do componente (mesmo padrão de `Contratos.tsx:72`).
   - Isso já invalida `['cotacoes']` (cobre `useCotacoes`, `useCotacoesPaginadas`, `['cotacoes', id]`), `['contratos']` e `['ativacoes']` a cada UPDATE/INSERT/DELETE em `contratos`. Resolve o sintoma direto: assim que o Autentique muda o status do contrato (gerado → enviado → visualizado → assinado), o badge da tabela recalcula em segundos.

2. **Reforço pra evitar reincidência em outros caminhos da lista**
   - Em `useCotacoesPaginadas`, baixar o `staleTime: Infinity` para `staleTime: 1000 * 30` (30s) e manter `refetchOnWindowFocus: true`. Mantém o ganho de paginação server-side, mas garante refresh ao voltar pra aba mesmo se algum INSERT de contrato escapar do realtime (ex.: lista aberta antes do contrato existir).

Nenhuma mudança em `getEtapaVenda`, hooks de cotação, edge function, contrato-gerar, webhook do Autentique ou migrations — o cálculo já está correto, só faltava o gatilho de refetch.

## Validação

- Abrir `/vendas/cotacoes`, localizar TUG9J61: deve aparecer **"Assinando Contrato"** (laranja, ícone FileSignature) em vez de "Escolha de Vistoria".
- Forçar UPDATE no contrato (qualquer alteração de status pelo webhook do Autentique) e ver o badge mudar sem reload.
- Conferir no console: log `[useContratosRealtime] Mudança detectada` na aba Cotações.

## Não-objetivos

- Não tocar em `cotacaoEtapa.ts` (mapeamento canônico permanece intacto).
- Não tocar em edge functions, RLS, schemas, autovistoria, troca de titularidade nem caminho do Cadastro/Monitoramento.
- Não mexer em `Contratos.tsx`/`AtivacoesList.tsx` (já têm o hook).
