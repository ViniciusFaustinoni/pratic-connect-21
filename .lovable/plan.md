

# Plano Final — Regras de adesão para vendedor externo no CotacaoFormDialog

## Causa raiz

As regras de adesão do vendedor externo foram implementadas apenas no `Cotador.tsx`, mas o fluxo real de criação de cotação usa `CotacaoFormDialog.tsx`, que:

1. **Bloqueia adesão zero** (linha 956): `data.valor_adesao <= 0` → erro "maior que zero"
2. **Bloqueia adesão < R$50** (linha 963): validação mínima sem exceção para externo
3. **Não tem seletor de cenário**: sem UI para escolher cobra/isenta + rota/base
4. **Não persiste `tipo_instalacao`**: campo ausente no payload salvo (linha 994-1045)
5. **Não importa `isVendedorExterno`**: o componente não consulta o perfil do vendedor

## Correções (todas condicionais a `isVendedorExterno`)

### 1. Adicionar estado e UI de cenário — `CotacaoFormDialog.tsx`

- Importar `usePermissions` e extrair `isVendedorExterno`
- Adicionar estado `cenarioExterno: 'cobra_rota' | 'isenta_rota' | 'isenta_base' | 'cobra_base' | null`
- Inserir seletor de 4 cenários (igual ao do Cotador) entre o bloco de filiação e os planos, visível **somente** para externo
- Quando cenário isento: forçar `form.setValue('valor_adesao', 0)` e marcar `adesaoEditadaManualmente.current = true`

### 2. Condicionar validações de adesão — `CotacaoFormDialog.tsx`

Na função `onSubmit` (linhas 956-966):
- Se `isVendedorExterno && cenário isento`: pular validação de `> 0` e `< R$50`
- Se `isVendedorExterno && !cenarioExterno`: bloquear com toast "Selecione o cenário"
- Demais perfis: manter validações atuais intactas

### 3. Desabilitar input de adesão quando isento — `CotacaoFormDialog.tsx`

No `CurrencyInput` (linha 1598): adicionar `disabled` quando externo + cenário isento

### 4. Persistir `tipo_instalacao` no payload — `CotacaoFormDialog.tsx`

No `cotacaoData` (linha 994): adicionar `tipo_instalacao` derivado do cenário (`cobra_rota`/`isenta_rota` → `'rota'`, `*_base` → `'base'`), somente quando `isVendedorExterno`

### 5. Proteger auto-cálculo de adesão — `CotacaoFormDialog.tsx`

No `useEffect` (linha 278-285): adicionar condição — se `isVendedorExterno` e cenário isento ativo, não sobrescrever valor

### 6. Corrigir duplicação/edição com adesão zero — `CotacaoFormDialog.tsx`

Linhas 677 e 746: trocar `if (cotacaoBase.valor_adesao)` por `if (cotacaoBase.valor_adesao !== null && cotacaoBase.valor_adesao !== undefined)` para preservar zero explícito

## Arquivo alterado

| Arquivo | Mudanças |
|---------|----------|
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Todos os 6 itens acima |

## Garantia de isolamento

Todas as mudanças são gated por `isVendedorExterno`. Vendedores internos (CLT), gestão e demais perfis mantêm comportamento atual: adesão obrigatória > R$50, sem seletor de cenário, sem `tipo_instalacao`.

