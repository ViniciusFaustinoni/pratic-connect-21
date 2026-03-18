

## Plano: Adicionar toggle "Quem Indicou" no CotacaoFormDialog

### Problema
O toggle foi adicionado apenas no `Cotador.tsx`, mas o usuário está usando o formulário de cotação via **CotacaoFormDialog** (modal em `/vendas/cotacoes`), que não possui o campo de indicação.

### O que será feito

**Arquivo: `src/components/cotacoes/CotacaoFormDialog.tsx`**

1. **Novos estados** (~linha 130): `isIndicacao`, `indicadorId`, `indicadorNome`, `buscaIndicador`
2. **Import** do hook `useAssociadoSearch` e do componente `Switch`
3. **UI**: Após o bloco de "E-mail (opcional)" (linha ~1239), antes do `<Separator />`, adicionar:
   - Switch "Este cliente foi indicado por um associado?"
   - Quando ativado, campo de busca com dropdown de resultados (mesmo padrão do Cotador.tsx)
   - Ao selecionar, exibe nome do indicador com botão X para limpar
4. **Persistência** (~linha 1062): Incluir `indicador_id` e `indicador_nome` no objeto `cotacaoData`
5. **Reset ao fechar**: Limpar estados de indicação quando o dialog fecha
6. **Edição**: Ao editar cotação existente, preencher os estados se `cotacaoParaEditar` tiver `indicador_id`/`indicador_nome`

### Arquivos alterados
- `src/components/cotacoes/CotacaoFormDialog.tsx` — estados + UI + persistência

