

## Plano: Habilitar uso Aplicativo para motos (Linha Advanced)

### Diagnóstico

A linha Advanced (motos) está com `supports_app = false` na tabela `product_lines`. Por isso, o filtro na linha 352 do `usePlanosCotacao.ts` descarta todos os planos de moto quando o uso é "aplicativo".

O motor de precificação (`precoApp.ts`) já está preparado para lidar com isso:
- Para motos, o `tipo_uso` da query é "advanced" ou "advanced-plus" (não muda para "aplicativo")
- O adicional de R$ 35,90 é somado automaticamente quando a região exige

### Única alteração necessária

**Banco de dados** — Atualizar `product_lines`:

```sql
UPDATE product_lines SET supports_app = true WHERE slug = 'advanced';
```

### Nenhuma alteração de código necessária

O motor de cotação e precificação já suporta esse cenário. Ao habilitar `supports_app`, os planos Advanced deixam de ser filtrados quando `usoApp = true`, e o adicional app é aplicado automaticamente pela função `resolverPrecoApp`.

