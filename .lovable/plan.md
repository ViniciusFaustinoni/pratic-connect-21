
# Plano: Remover Botão "Ativar Contrato" da Página de Ativações em Vendas

## Resumo

Remover a opção "Ativar Contrato" do menu dropdown na tabela de ativações (`/vendas/ativacoes`). O menu continuará exibindo outras opções como "Enviar para SGA" e "Excluir" quando aplicáveis.

## Análise

O botão está localizado no componente `AtivacaoTableRow.tsx`, dentro do `DropdownMenuContent`:

```typescript
{isProntoParaAtivar && (
  <DropdownMenuItem 
    onClick={onAtivar}
    disabled={isAtivando}
    className="text-emerald-600"
  >
    <Rocket className="h-4 w-4 mr-2" />
    Ativar Contrato
  </DropdownMenuItem>
)}
```

## Mudanças

### Arquivo: `src/components/ativacao/AtivacaoTableRow.tsx`

1. **Remover a interface prop** `onAtivar` e `isAtivando` (não mais necessários)
2. **Remover o DropdownMenuItem** do "Ativar Contrato" (linhas 158-171)
3. **Remover imports não utilizados** (`Rocket`)

### Arquivo: `src/pages/vendas/AtivacoesList.tsx`

1. **Remover o hook** `useAtivarContrato` (não mais usado)
2. **Remover a função** `handleAtivar`
3. **Remover as props** `onAtivar` e `isAtivando` da chamada do `AtivacaoTableRow`

## Resultado Esperado

- O menu dropdown continuará aparecendo para contratos não ativos
- Apenas as opções "Enviar para SGA" (quando aplicável) e "Excluir" (quando permitido) serão exibidas
- O badge de status (Pronto/Pendente/Ativo) continuará visível
