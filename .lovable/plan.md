

# Plano: Remover Badges de Status dos Documentos Anexados

## Objetivo

Remover os badges "Aprovado", "Pendente", "Reprovado", "Em Análise" que aparecem ao lado de cada documento na lista de "Documentos Anexados".

## Localização do Código

**Arquivo:** `src/components/cadastro/DocumentosAnexadosCard.tsx`

Os badges aparecem em dois lugares:
1. **Lista de documentos** - Linhas 166-170
2. **Dialog de visualização** - Linhas 200-204

## O Que Será Removido

### Na lista de documentos (linhas 166-170):
```tsx
// REMOVER:
<Badge className={cn('text-xs', statusConfig.className)}>
  <StatusIcon className="h-3 w-3 mr-1" />
  {statusConfig.label}
</Badge>
```

### No dialog de visualização (linhas 200-204):
```tsx
// REMOVER:
{selectedDoc && (
  <Badge className={cn('text-xs', getStatusConfig(selectedDoc.status).className)}>
    {getStatusConfig(selectedDoc.status).label}
  </Badge>
)}
```

## Código Não Afetado

O badge de "Validado por IA" (linhas 171-177) será mantido, pois é uma informação diferente que indica processamento por OCR.

## Limpeza Adicional

Após remover os badges, podemos também remover:
- A constante `STATUS_CONFIG` (linhas 55-60) - não será mais usada na lista
- A função `getStatusConfig` (linhas 93-95) - não será mais chamada
- As variáveis `statusConfig` e `StatusIcon` (linhas 113, 115) - não serão mais usadas
- Import do `Clock` e `AlertCircle` que só eram usados nos badges de status

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/cadastro/DocumentosAnexadosCard.tsx` | Remover badges de status e código relacionado |

## Resultado Visual

Antes:
```
[📄] Contrato Assinado          [✓ Aprovado]  [👁]
     30/01/2026 às 08:12

[🏠] Comprovante de Residência  [⏱ Pendente]  [👁]
     30/01/2026 às 08:06
```

Depois:
```
[📄] Contrato Assinado                        [👁]
     30/01/2026 às 08:12

[🏠] Comprovante de Residência                [👁]
     30/01/2026 às 08:06
```

## Tempo Estimado

~5 minutos

