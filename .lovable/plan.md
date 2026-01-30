
# Plano: Impedimento de Duplicidade de Placa em Cotações

## Status: ✅ IMPLEMENTADO

## Resumo

Implementação concluída da validação que impede um vendedor de criar cotação para uma placa que já está sendo atendida por outro consultor.

## Regras de Negócio Implementadas

| Regra | Status |
|-------|--------|
| Bloqueio de duplicidade (placa em cotação ativa de outro vendedor) | ✅ |
| Cotações ativas: status `rascunho`, `enviada`, `aceita` | ✅ |
| Período de validade: últimos 7 dias | ✅ |
| Mesmo vendedor: permite continuar com aviso informativo | ✅ |
| Cotações fechadas (`recusada`, `expirada`): placa liberada | ✅ |

## Arquivos Criados

- `src/hooks/useVerificarPlaca.ts` - Hook para verificar duplicidade de placa
- `src/components/cotacoes/PlacaDuplicadaModal.tsx` - Modal de alerta com informações do responsável

## Arquivos Modificados

- `src/pages/vendas/Cotador.tsx` - Integração na função `handleBuscarPlaca`
- `src/components/cotacoes/CotacaoFormDialog.tsx` - Integração na função `buscarPorPlaca`

## Dados Exibidos no Alerta

Quando houver conflito, o modal exibe:
- ⚠️ Aviso: "Placa Já em Atendimento"
- Nome do consultor responsável
- Número da cotação existente
- Data e hora do cadastro original
- Status da cotação
- Orientação para contatar o responsável
