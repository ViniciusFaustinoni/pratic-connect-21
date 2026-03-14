

# Propagação completa das regras de adesão para vendedor externo

## Problemas encontrados

1. **useEffect sobrescreve adesão zerada** (Cotador.tsx:371-377): quando `planosDB` carrega, força `valorAdesaoCustom = max(100, 1% FIPE)` sem verificar se o externo já escolheu cenário com adesão isenta.

2. **Cenário não obrigatório**: vendedor externo pode salvar cotação sem selecionar cenário — `tipo_instalacao` vai `null`, quebrando comissão.

3. **Nomenclatura rota ≠ volante**: cotação salva `tipo_instalacao = 'rota'`, mas `useContaCorrenteVendedor.ts` (linha 141) compara com `'volante'`. O mapeamento nunca é feito.

4. **Input de adesão editável em cenário isento**: quando externo escolhe `isenta_rota` ou `isenta_base`, o campo de adesão (linha 1581-1587) continua editável, permitindo inserir valor manualmente e contradizer o cenário.

## Correções (somente para vendedor externo)

### 1. Proteger useEffect — `Cotador.tsx` linha 371-380
Adicionar condição: se `cenarioExterno` é `isenta_rota` ou `isenta_base`, não sobrescrever `valorAdesaoCustom`.

### 2. Validar cenário obrigatório antes de salvar — `Cotador.tsx` linha 654
No início de `handleSalvarEEnviarWhatsApp`, se `isVendedorExterno && !cenarioExterno`, exibir toast de erro e retornar.

### 3. Mapear 'rota' → 'volante' — `useContaCorrenteVendedor.ts` linha 131-141
Ao receber `tipo_instalacao` nos `DadosAtivacao`, normalizar: se o valor vindo da cotação for `'rota'`, tratar como `'volante'` internamente.

### 4. Desabilitar input de adesão em cenário isento — `Cotador.tsx` linha 1581-1587
Adicionar `disabled` ao input quando `isVendedorExterno && (cenarioExterno === 'isenta_rota' || cenarioExterno === 'isenta_base')`.

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/vendas/Cotador.tsx` | Bugs 1, 2 e 4 |
| `src/hooks/useContaCorrenteVendedor.ts` | Bug 3 (mapeamento rota→volante) |

Nenhuma alteração afeta o fluxo do vendedor CLT — todas as condições são gated por `isVendedorExterno`.

