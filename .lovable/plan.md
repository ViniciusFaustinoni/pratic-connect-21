

# Plano: Comunicacao entre Processos - Status, Historico e Movimentacoes

## Diagnostico dos Problemas Encontrados

### Problema 1: Contrato continua "ativo" quando associado e cancelado
O `processar-pos-retirada` atualiza o associado e o veiculo para "cancelado", mas **nao toca no contrato**. Resultado: a aba Ativacoes mostra o registro como "Ativo" (badge verde) porque le o `contratos.status`.

**Dados atuais no banco:**
- `contratos.status = 'ativo'` (errado - deveria ser 'cancelado')
- `associados.status = 'cancelado'` (correto)
- `veiculos.status = 'cancelado'` (correto)

### Problema 2: Cotacoes nao reflete cancelamento
A funcao `getEtapaVenda()` verifica `cotacao.contrato.associados.status`, mas como o contrato ainda esta "ativo", a cotacao mostra "Vistoria Realizada" em vez de refletir que o associado foi cancelado.

### Problema 3: Ativacoes nao tem visibilidade do cancelamento
O hook `useAtivacoes` busca contratos e filtra por status, mas nao cruza com o status do associado. Um contrato "ativo" com associado "cancelado" aparece como "Ativo" na lista.

### Problema 4: Historico incompleto
A funcao `useAtivarContrato` (em `useContratos.ts`) ativa o contrato e cria associado, mas **nao registra evento no `associados_historico`** do tipo `contrato_assinado` ou `contrato_ativado`. Tambem falta registro quando o contrato e cancelado.

### Problema 5: Cotacoes nao atualiza status_contratacao ao cancelar
O `status_contratacao` da cotacao fica congelado em `pagamento_ok` mesmo depois do cancelamento do associado.

---

## Plano de Implementacao

### 1. Edge Function `processar-pos-retirada` - Cancelar contrato junto

**Arquivo:** `supabase/functions/processar-pos-retirada/index.ts`

Adicionar apos a inativacao de veiculos (passo 4), um novo passo que cancela todos os contratos ativos do associado:

```text
// 4.1 Cancelar contratos ativos (EXCETO substituicao)
if (motivo_retirada !== 'substituicao_veiculo') {
  - Buscar contratos com associado_id e status IN ('ativo','assinado','pendente')
  - Atualizar para status = 'cancelado', data_cancelamento = now()
  - Atualizar cotacao vinculada: status_contratacao = 'cancelado'
  - Cancelar documento Autentique se existir (via autentique-cancel)
}
```

### 2. `getEtapaVenda()` - Adicionar etapa "cancelado"

**Arquivos:** `src/components/cotacoes/CotacoesTable.tsx` e `CotacaoCard.tsx`

Adicionar nova etapa no tipo `EtapaVenda`:
- `'cancelado'` com label "Cancelado", cor vermelha

Na logica de `getEtapaVenda()`, adicionar no inicio (apos veiculo_recusado):
```text
if (associadoStatus === 'cancelado') return 'cancelado';
if (contratoStatus === 'cancelado') return 'cancelado';
```

### 3. Ativacoes - Refletir status real

**Arquivo:** `src/hooks/useAtivacoes.ts`

Na query de ativacoes, cruzar com o status do associado:
- Buscar `associados.status` junto com os dados
- Adicionar campo `associado_status` ao tipo `AtivacaoContrato`
- No componente `AtivacaoTableRow`, se `associado_status === 'cancelado'`, mostrar badge "Cancelado" em vermelho em vez de "Ativo"
- No filtro "Ativados", excluir registros cujo associado esteja cancelado

### 4. Registrar historico em todas as acoes criticas

**Arquivo:** `src/hooks/useContratos.ts` (funcao `useAtivarContrato`)

Adicionar ao final da mutacao:
```text
await supabase.from('associados_historico').insert({
  associado_id,
  tipo: 'contrato_assinado',
  descricao: 'Contrato ativado e associado vinculado',
  ...
})
```

**Arquivo:** `src/hooks/useAtivacoes.ts` (funcao `useAtivarContrato`)

Mesma correcao - registrar no historico quando contrato e ativado.

### 5. Realtime - Invalidar queries corretas

**Arquivo:** `src/hooks/useCotacoesRealtime.ts`

Verificar que mudancas em `associados` invalidam `['ativacoes']` (ja faz), e tambem que mudancas em `contratos` invalidam `['ativacoes']` (ja faz).

Adicionar invalidacao de `['associado-historico-completo']` quando houver mudanca em `associados_historico`:

```text
.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'associados_historico' }, () => {
  queryClient.invalidateQueries({ queryKey: ['associado-historico-completo'] });
})
```

### 6. Corrigir dado atual no banco (one-time fix)

Como o contrato do MARCUS ficou "ativo" indevidamente, sera necessario um UPDATE manual:

```sql
UPDATE contratos SET status = 'cancelado', data_cancelamento = NOW()
WHERE associado_id IN (SELECT id FROM associados WHERE status = 'cancelado')
AND status = 'ativo';
```

---

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|----------|
| `supabase/functions/processar-pos-retirada/index.ts` | Adicionar cancelamento de contratos e cotacoes |
| `src/components/cotacoes/CotacoesTable.tsx` | Adicionar etapa 'cancelado' em getEtapaVenda |
| `src/components/cotacoes/CotacaoCard.tsx` | Adicionar etapa 'cancelado' (mesma logica) |
| `src/hooks/useAtivacoes.ts` | Cruzar com associado.status, mostrar cancelados |
| `src/components/ativacao/AtivacaoTableRow.tsx` | Badge "Cancelado" quando associado cancelado |
| `src/hooks/useContratos.ts` | Registrar historico ao ativar contrato |
| `src/hooks/useCotacoesRealtime.ts` | Invalidar historico do associado em tempo real |
| Migration SQL | Corrigir dados inconsistentes existentes |

### O que NAO sera alterado
- Nenhuma edge function existente alem da `processar-pos-retirada`
- Nenhuma pagina existente (layout/UI)
- Logica de criacao de cotacoes
- Fluxo publico do associado

