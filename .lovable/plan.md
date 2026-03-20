

# Plano: Adicionar Lista de Rastreadores na Aba Estoque

## Problema

A aba "Estoque" na página unificada de Rastreadores mostra apenas as métricas e a consulta por IMEI/código, mas não exibe a lista de rastreadores disponíveis (`ListaRastreadores`), que existia na página antiga de Estoque.

## Solução

Adicionar o componente `ListaRastreadores` na aba Estoque, abaixo das métricas e acima da consulta.

### Alteração em `Rastreadores.tsx`

Na aba "estoque" (linhas 179-182), adicionar `ListaRastreadores` entre `EstoqueMetricas` e `ConsultaRastreador`:

```tsx
<TabsContent value="estoque" className="space-y-6 mt-6">
  <EstoqueMetricas />
  <ListaRastreadores />
  <ConsultaRastreador />
</TabsContent>
```

O import de `ListaRastreadores` já existe na linha 54 do arquivo.

### Bug secundário

O console mostra um warning de ref em `ConsultaRastreador` — componente funcional sem `forwardRef`. Isso não causa erro funcional mas será corrigido junto.

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/monitoramento/Rastreadores.tsx` | Adicionar `ListaRastreadores` na aba estoque |

