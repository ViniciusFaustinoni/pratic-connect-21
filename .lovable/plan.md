

# Condicionar Aba "Reparo" à Vistoria Concluída

## Problema

A aba "Reparo" aparece sempre no sinistro, mesmo antes da vistoria do regulador ser concluída. O orçamento de reparo só faz sentido após a vistoria ser finalizada (quando o regulador envia o documento de orçamento processado via OCR).

## Solução

Condicionar a exibição da aba "Reparo" à existência de uma vistoria com status `concluida` para o sinistro. A variável `vistoriaEvento` já é carregada no componente — basta verificar seu status.

## Arquivo Alterado

| Arquivo | Ação |
|---------|------|
| `src/pages/eventos/SinistroDetalhe.tsx` | Condicionar renderização da TabsTrigger e TabsContent "reparo" a `vistoriaEvento?.status === 'concluida'` |

## Detalhes Técnicos

### `SinistroDetalhe.tsx`

**Linha ~296**: Ajustar o `grid-cols` dinamicamente (5 ou 4 colunas conforme visibilidade da aba).

**Linhas ~300-301**: Envolver a `TabsTrigger value="reparo"` em condicional:
```tsx
{vistoriaEvento?.status === 'concluida' && (
  <TabsTrigger value="reparo" className="text-xs sm:text-sm gap-1">
    <Wrench className="h-3.5 w-3.5 hidden sm:block" /> Reparo
  </TabsTrigger>
)}
```

**Linhas ~324-333**: Envolver a `TabsContent value="reparo"` na mesma condicional:
```tsx
{vistoriaEvento?.status === 'concluida' && (
  <TabsContent value="reparo" className="mt-4">
    <SinistroDetalheReparo ... />
  </TabsContent>
)}
```

Alteração mínima — apenas 2 blocos condicionais adicionados ao redor do código já existente.

