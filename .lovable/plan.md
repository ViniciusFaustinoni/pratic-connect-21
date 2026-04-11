

## Plano: Exibir cenario de adesao para consultores internos

### Problema
Atualmente, o bloco de "Cenario de Adesao e Instalacao" (4 opcoes) so aparece para vendedores externos (`isVendedorExterno`). Consultores internos nao conseguem isentar adesao nem escolher tipo de instalacao.

### Alteracoes

**Arquivo: `src/components/cotacoes/CotacaoFormDialog.tsx`**

1. **Linha 169** — Remover a condicao `isVendedorExterno` do calculo de `isCenarioIsento`:
   - De: `isVendedorExterno && (cenarioExterno === 'isenta_rota' || cenarioExterno === 'isenta_base')`
   - Para: `cenarioExterno === 'isenta_rota' || cenarioExterno === 'isenta_base'`

2. **Linha 2098** — Remover o gate `{isVendedorExterno && (` para que o bloco de cenario apareca para todos os usuarios

3. **Linha 1114** — Remover a condicao `isVendedorExterno` da validacao de cenario obrigatorio:
   - De: `if (isVendedorExterno && !cenarioExterno)`
   - Para: `if (!cenarioExterno)`

4. **Linha 1149** — Ajustar a condicao de exibicao da taxa de filiacao:
   - De: `(!isVendedorExterno || (cenarioExterno && cenarioExterno.startsWith('cobra')))`
   - Para: `cenarioExterno && cenarioExterno.startsWith('cobra')`

5. **Linha 1197** — Remover a condicao `isVendedorExterno` do spread de `tipo_instalacao` para que o tipo de instalacao seja salvo para todos

6. **Linha 172** — Ajustar `minimoAdesaoVolante` para usar o valor interno para consultores internos (manter logica atual que ja diferencia por tipo)

Nenhuma migracao necessaria. Apenas mudancas de UI/logica no formulario de cotacao.

