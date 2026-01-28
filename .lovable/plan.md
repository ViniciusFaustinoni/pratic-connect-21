
# Plano: Diferenciacao do Status de Cobertura no Detalhe do Associado

## Problema Identificado

Na tela de detalhes do associado, o badge de status exibe apenas "Ativo" para todos os associados com status ativo, sem diferenciar entre:
- **Cobertura Total**: Associado com rastreador instalado e todas as coberturas liberadas
- **Cobertura Parcial (Roubo e Furto)**: Associado aprovado por autovistoria, aguardando instalacao do rastreador

Esta falta de diferenciacao visual pode gerar confusao para analistas e atendentes.

## Localizacao do Codigo

**Arquivo:** `src/pages/cadastro/AssociadoDetalhe.tsx`

**Linhas 382-384:**
```tsx
<Badge className={cn(STATUS_ASSOCIADO_COLORS[status])}>
  {STATUS_ASSOCIADO_LABELS[status]}
</Badge>
```

## Solucao Proposta

### Logica de Determinacao da Cobertura

Analisar os veiculos do associado para determinar o tipo de cobertura:

```typescript
// Verificar cobertura baseada nos veiculos
const temCoberturaTotal = veiculos?.some(v => v.cobertura_total) ?? false;
const temCoberturaRouboFurto = veiculos?.some(v => v.cobertura_roubo_furto) ?? false;

// Label dinamico para status ativo
const getStatusLabel = () => {
  if (status !== 'ativo') return STATUS_ASSOCIADO_LABELS[status];
  
  if (temCoberturaTotal) {
    return 'Ativo'; // Cobertura completa
  }
  if (temCoberturaRouboFurto) {
    return 'Ativo Roubo e Furto'; // Apenas cobertura parcial
  }
  return 'Ativo'; // Fallback
};

// Cor diferenciada para cobertura parcial
const getStatusColor = () => {
  if (status === 'ativo' && temCoberturaRouboFurto && !temCoberturaTotal) {
    // Amarelo/dourado para indicar cobertura parcial
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }
  return STATUS_ASSOCIADO_COLORS[status];
};
```

### Alteracao no Badge

**De:**
```tsx
<Badge className={cn(STATUS_ASSOCIADO_COLORS[status])}>
  {STATUS_ASSOCIADO_LABELS[status]}
</Badge>
```

**Para:**
```tsx
<Badge className={cn(getStatusColor())}>
  {getStatusLabel()}
</Badge>
```

## Resultado Visual Esperado

| Situacao | Label Exibido | Cor do Badge |
|----------|---------------|--------------|
| Cobertura Total ativa | "Ativo" | Verde |
| Apenas Roubo/Furto ativa | "Ativo Roubo e Furto" | Amarelo/Dourado |
| Outros status | Label padrao | Cor padrao do status |

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Adicionar logica de verificacao de cobertura e aplicar label/cor dinamicos |

## Consideracoes Tecnicas

### Fonte de Dados
- Os dados de cobertura (`cobertura_total`, `cobertura_roubo_furto`) ja sao buscados junto com os veiculos pelo hook `useVeiculosDoAssociado`
- Nao e necessaria nenhuma nova query ao banco

### Impacto
- Alteracao localizada apenas no componente de detalhe
- Nao afeta listagens ou outros modulos
- Apenas alteracao visual/informativa
