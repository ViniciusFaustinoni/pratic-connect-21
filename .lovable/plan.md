

# Ativar filtro de regiões na cotação

## Problema
O checkbox "Regiões Disponíveis" salva corretamente na tabela `planos_regioes`, mas o motor de cotação (`usePlanosCotacao.ts`) nunca consulta essa tabela — portanto nunca filtra planos por região. Os planos aparecem em todas as regiões desde que exista preço na tabela de mensalidade.

## Solução
Adicionar `planos_regioes` como filtro adicional no motor de cotação. Um plano só aparece se:
1. Tem preço na `tabelas_preco_mensalidade` para a região (já existe)
2. **E** tem a região vinculada em `planos_regioes` (novo filtro)

Se um plano não tem nenhuma região configurada em `planos_regioes`, ele será tratado como disponível em todas (para não quebrar planos existentes sem configuração).

## Alterações

### 1. `src/hooks/usePlanosCotacao.ts` — Buscar e filtrar por regiões do plano

- Na query de `planos_cotacao` (linha ~164), adicionar join: `planos_regioes(regiao_id)`
- No `useMemo` que calcula os planos, adicionar verificação: se o plano tem `planos_regioes` configuradas E a região do cliente não está entre elas, negar o plano com motivo "Plano não disponível nesta região"
- Se `planos_regioes` está vazio (sem configuração), manter comportamento atual (aceita todas)

### 2. `src/components/admin/planos/planFieldHints.ts` — Atualizar hint

Atualizar o texto do hint `regioes` para deixar claro que agora é um filtro ativo na cotação.

2 arquivos, mudança pontual no motor de cotação.
