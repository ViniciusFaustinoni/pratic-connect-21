

# Adicionar tooltips explicativos nas abas de Aprovações

## O que muda

Cada aba ("FIPE Menor", "Alto Valor", "Elegibilidade") receberá um pequeno ícone de ajuda (`HelpCircle`) ao lado do nome, com um tooltip explicando o propósito daquela seção.

## Alteração

**Arquivo**: `src/pages/vendas/AprovacoesFipeMenor.tsx`

- Importar `HelpCircle` do lucide-react e `Tooltip`/`TooltipProvider`/`TooltipTrigger`/`TooltipContent` de `@/components/ui/tooltip`
- Dentro de cada `TabsTrigger`, adicionar um `<Tooltip>` com `<HelpCircle className="h-3 w-3" />` e o texto explicativo:
  - **FIPE Menor**: "Solicitações para enquadrar veículos em faixa FIPE inferior à original, reduzindo o valor mensal"
  - **Alto Valor**: "Veículos com FIPE acima do limite permitido pelo plano que precisam de autorização especial"
  - **Elegibilidade**: "Veículos fora da whitelist de aceitação do plano que necessitam aprovação manual para inclusão"

Nenhum outro arquivo é alterado.

