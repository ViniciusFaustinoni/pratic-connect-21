

## Plano: Alterar mínimo de adesão para R$ 50 (CLT e Externo)

### Problema

O mínimo de adesão para vendedor CLT (interno) está configurado como R$ 150, mas deveria ser R$ 50 — igual ao do vendedor externo. Isso causa o alerta vermelho da screenshot e **bloqueia o envio da cotação** quando o valor é menor que R$ 150.

### Estado atual no banco

| Chave | Valor atual | Valor desejado |
|-------|------------|----------------|
| `taxa_adesao_minimo_volante_interno` | 150 | **50** |
| `taxa_adesao_minimo_volante_externo` | 50 | 50 (já correto) |
| `taxa_adesao_minimo_base` | 100 | 100 (sem alteração) |

### Correções

#### 1. Atualizar valor no banco (SQL migration)

```sql
UPDATE configuracoes 
SET valor = '50' 
WHERE chave = 'taxa_adesao_minimo_volante_interno';
```

#### 2. Atualizar defaults no código (3 arquivos)

Alterar o fallback de `150` para `50` nos locais que usam o valor hardcoded como default:

- **`src/hooks/useConteudosSistema.ts`** (linha 275): `useConfiguracaoNumero('taxa_adesao_minimo_volante_interno', 50)`
- **`src/pages/vendas/Cotador.tsx`** (linha 253): `const { data: minimoVolanteInterno = 50 } = ...`
- **`src/components/cotacoes/CotacaoFormDialog.tsx`** (linha 145): `const { data: minimoVolanteInterno = 50 } = ...`
- **`src/components/gestao-comercial/RegrasVendaContent.tsx`** (linha 112): default de `'150'` para `'50'`

#### 3. Nenhuma lógica de cotação é afetada

A validação de mínimo (`valorAdesaoCustom < minimoAdesaoConfig`) continua funcionando — apenas o threshold muda de 150 para 50. Todos os cenários (rota CLT, rota externo, base, isenta) permanecem intactos.

