

# Plano Final — Reordenação e ocultação condicional do bloco de adesão

## Diagnóstico do fluxo completo (ponta a ponta)

| Etapa | Suporta adesão zero? | Ação necessária |
|-------|---------------------|-----------------|
| **CotacaoFormDialog** (criação) | Parcial — cenário existe mas está após o input de adesão | Reordenar + ocultar |
| **ContratoFormDialog** (geração contrato) | Não — bloqueia `valor_adesao <= 0` (linha 194) e desabilita botão (linha 649) | Condicionar por `isVendedorExterno` |
| **EtapaPagamentoCotacao** (link público) | Sim — já pula ASAAS quando `valorAdesao <= 0` (linha 220) | Nenhuma |
| **asaas-cobranca-adesao** (edge function) | Sim — guard na linha 86 retorna sucesso sem criar cobrança | Nenhuma |
| **asaas-webhook** | Sim — ignora cobranças tipo `adesao` nas notificações | Nenhuma |
| **criar-instalacao-pos-pagamento** | Sim — é chamado tanto com adesão paga quanto zerada | Nenhuma |
| **useContaCorrenteVendedor** | Sim — mapeamento `rota→volante` já implementado | Nenhuma |

## Correções necessárias

### 1. `CotacaoFormDialog.tsx` — Reordenar blocos + ocultar adesão condicionalmente

**Mover** o bloco 2.6 (cenário, linhas 1644-1691) para **antes** do bloco 2.5 (taxa, linhas 1610-1642).

**Ocultar** o bloco de taxa de filiação para vendedor externo quando:
- Nenhum cenário selecionado (ainda não decidiu)
- Cenário isento selecionado (`isenta_rota` ou `isenta_base`)

**Exibir** o bloco de taxa somente quando:
- Não é vendedor externo (comportamento atual, sempre visível)
- É vendedor externo E cenário `cobra_rota` ou `cobra_base` selecionado

Remover o `disabled` do `CurrencyInput` (o bloco inteiro some quando isento, não precisa mais).

### 2. `ContratoFormDialog.tsx` — Permitir adesão zero para vendedor externo

Duas mudanças:
- **Linha 194**: `if (data.valor_adesao <= 0)` → adicionar gate `if (!isVendedorExterno && data.valor_adesao <= 0)`
- **Linha 649**: `disabled={... || form.watch('valor_adesao') <= 0}` → adicionar exceção para externo

Requer importar `usePermissions` e extrair `isVendedorExterno`.

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Reordenar blocos + visibilidade condicional da taxa |
| `src/components/contratos/ContratoFormDialog.tsx` | Permitir adesão zero para externo |

### Garantia de isolamento

- Todas as mudanças condicionadas a `isVendedorExterno`
- Vendedores internos, gestão e demais perfis: zero alteração no comportamento atual
- Fluxos downstream (ASAAS, termo, instalação, comissão) já suportam adesão zero — nenhuma mudança necessária

