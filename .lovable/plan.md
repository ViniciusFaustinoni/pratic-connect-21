

# Bloqueio de inclusão de veículo com débito pendente

## O que muda

Quando o operador escolhe "Incluir segundo veículo" no dialog de tipo de operação, o sistema verifica débitos em aberto em **todos** os veículos do associado antes de liberar o fluxo. O comportamento (bloqueio ou aviso) é configurável via toggle em Regras de Venda.

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useVerificarDebitosAssociado.ts` | **Novo hook**. Recebe `associado_id`, consulta `cobrancas` com status `vencido` ou `aguardando_pagamento` + join com `veiculos` para retornar lista de débitos por veículo (placa, modelo, valor total em aberto) |
| `src/hooks/useConteudosSistema.ts` | Novo hook `useInclusaoBloqueioDebito()` que lê a chave `inclusao_bloquear_debito_outro_veiculo` da tabela `configuracoes` (default `true`) |
| `src/components/cotacao/DialogTipoOperacao.tsx` | Ao clicar "Incluir segundo veículo": chamar o hook de débitos. Se houver débito e toggle ativo → bloquear com alert vermelho (veículo + valor pendente), botão desabilitado. Se toggle desativado → exibir aviso amarelo mas permitir prosseguir |
| `src/components/gestao-comercial/RegrasVendaContent.tsx` | Na aba "Taxas": adicionar nova chave `inclusao_bloquear_debito_outro_veiculo` em `TAXAS_CHAVES` e `TAXAS_DEFAULTS` (default `'true'`). Renderizar Card com Switch + descrição após o Card de Troca de Titularidade |

## Detalhes técnicos

### Hook `useVerificarDebitosAssociado`
```typescript
// Consulta cobranças vencidas/abertas agrupadas por veículo
const { data } = await supabase
  .from('cobrancas')
  .select('valor, veiculo_id, veiculos(placa, modelo, marca)')
  .eq('associado_id', associadoId)
  .in('status', ['vencido', 'aguardando_pagamento']);
```
Retorna `{ temDebito: boolean, debitosPorVeiculo: Array<{ placa, modelo, total }> }`.

### Fluxo no DialogTipoOperacao
1. Usuário clica "Incluir segundo veículo"
2. Sistema consulta débitos do `associado_id` do veículo ativo encontrado
3. Se `temDebito && bloqueioAtivo` → mostra alert de bloqueio, não fecha o dialog
4. Se `temDebito && !bloqueioAtivo` → mostra aviso, permite prosseguir
5. Se `!temDebito` → `onInclusao()` normalmente

### Toggle em Regras de Venda
Chave: `inclusao_bloquear_debito_outro_veiculo`
Label: "Bloquear inclusão de veículo com débito em outro veículo do mesmo associado"
Descrição: "Quando ativado, impede a inclusão de novos veículos se houver débito pendente em qualquer veículo vinculado ao CPF. Quando desativado, exibe apenas um aviso."

