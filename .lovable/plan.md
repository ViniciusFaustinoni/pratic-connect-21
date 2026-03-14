

# Regra de Adesão diferenciada para Vendedor Externo

## Análise do estado atual

O sistema já possui infraestrutura parcial para os 4 cenários:
- `EtapaPagamentoCotacao.tsx` já trata adesão zerada (pula ASAAS, exibe mensagem, gera contrato)
- `useComissaoExternaConfig.ts` já armazena configs de comissão externa (% adesão, valor volante, recorrente)
- O campo `valorAdesaoCustom` no Cotador já é editável livremente

**Bloqueios atuais que impedem o fluxo externo:**
1. Validações em `validations/index.ts` (linha 176/199) e `ContratoFormDialog.tsx` (linha 68) exigem `valor_adesao >= 1` — impossível zerar
2. O Cotador não distingue vendedor CLT de externo — não apresenta os 4 cenários
3. Não há campo na cotação para registrar "tipo de instalação" (rota vs base), essencial para o cálculo de comissão

## Plano de implementação

### 1. Permitir adesão zero para vendedor externo (validações)

- `src/lib/validations/index.ts`: relaxar `valor_adesao` de `.min(1)` para `.min(0)` nos schemas `cotacaoSchema` e `contratoSchema`
- `src/components/contratos/ContratoFormDialog.tsx`: mesma mudança no schema local
- A lógica de "adesão obrigatória" passa a ser controlada pelo contexto do vendedor, não pela validação global

### 2. Adicionar seleção de cenário no Cotador para vendedor externo

Em `src/pages/vendas/Cotador.tsx`:
- Importar `usePermissions` e checar `isVendedorExterno`
- Quando externo, exibir um seletor com os 4 cenários (RadioGroup):
  - "Cobrar adesão + Instalação rota" → mantém adesão editável, marca `tipo_instalacao = 'rota'`
  - "Isentar adesão + Instalação rota" → força adesão = 0, marca `tipo_instalacao = 'rota'`
  - "Isentar adesão + Instalação base" → força adesão = 0, marca `tipo_instalacao = 'base'`
  - "Cobrar adesão + Instalação base" → mantém adesão editável, marca `tipo_instalacao = 'base'`
- Ao selecionar cenário, atualizar `valorAdesaoCustom` e um novo state `tipoInstalacao`

### 3. Persistir tipo de instalação na cotação

- `src/types/cotacao.ts` (`CriarCotacaoPayload`): adicionar campo `tipo_instalacao?: 'rota' | 'base'`
- `src/hooks/useCotacao.ts` (`useCriarCotacao`): propagar `tipo_instalacao` para o insert na tabela `cotacoes`
- A tabela `cotacoes` no banco já precisa do campo — será adicionada via migration

### 4. Migration SQL

```sql
ALTER TABLE public.cotacoes 
  ADD COLUMN IF NOT EXISTS tipo_instalacao text 
  CHECK (tipo_instalacao IN ('rota', 'base'));
```

### 5. Fluxo público já funcional

`EtapaPagamentoCotacao.tsx` já lida com `valorAdesao <= 0` corretamente (pula ASAAS, exibe mensagem, gera contrato). Nenhuma alteração necessária nesse componente.

### O que NÃO muda

- Lógica de precificação (planos, faixas, adicional app) permanece intacta
- Fluxo do vendedor CLT permanece idêntico (sem seletor de cenário, adesão livre >= sugerido)
- Configurações de comissão externa (`useComissaoExternaConfig`) continuam funcionando — o `tipo_instalacao` salvo na cotação será consumido futuramente pelo motor de comissões para aplicar os débitos/créditos corretos

### Resumo de arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/vendas/Cotador.tsx` | Seletor de cenário para externo |
| `src/types/cotacao.ts` | Campo `tipo_instalacao` no payload |
| `src/hooks/useCotacao.ts` | Propagar campo no insert |
| `src/lib/validations/index.ts` | `min(0)` nos schemas |
| `src/components/contratos/ContratoFormDialog.tsx` | `min(0)` no schema |
| Migration SQL | Coluna `tipo_instalacao` em `cotacoes` |

