

## Plano: Corrigir mapeamentos de planos e auto-filtro por tipo_uso

### Problemas encontrados

Verifiquei todos os planos com `visivel_gestao=true` e seus mapeamentos em `plano_preco_map`:

| Plano | linha_slug | tipo_uso mapeado | tipo_uso real no banco | Faixas encontradas |
|---|---|---|---|---|
| ADVANCED | advanced | advanced | advanced | 48 ✅ |
| ADVANCED+ | advanced | advanced-plus | advanced-plus | 30 ✅ |
| ELÉTRICOS | eletrico | particular | particular | 60 ✅ |
| ESPECIAL | especial | particular | particular | 138 ✅ |
| **ESPECIAL PLUS** | especial-plus | **passeio** | **particular** | **0 ❌** |
| LANÇAMENTO BASIC | lancamento | particular | particular | 210 ✅ |
| LANÇAMENTO EXCLUSIVE | lancamento | particular | particular | 210 ✅ |
| LANÇAMENTO PREMIUM | lancamento | particular | particular | 210 ✅ |
| SELECT BASIC | select | particular | particular | 210 ✅ |
| **SELECT EXCLUSIVE** | **sem mapeamento** | — | — | **0 ❌** |
| SELECT ONE | select-one | particular | particular | 105 ✅ |
| SELECT ONE 5% PROMO | select-one | particular | particular | 105 ✅ |
| SELECT PREMIUM | select | particular | particular | 210 ✅ |
| Proteção Básica/Premium/Total | sem mapeamento | — | — | 0 (esperado) |

### Correções necessárias

#### 1. Migração SQL — corrigir dados no banco

**a) ESPECIAL PLUS**: O `tipo_uso` está como `'passeio'` mas a tabela de preços tem `'particular'`. Corrigir:
```sql
UPDATE plano_preco_map SET tipo_uso = 'particular' 
WHERE plano_id = '12cdd378-b42b-4389-a28f-1eba1fe7c837';
```

**b) SELECT EXCLUSIVE**: Não tem entrada em `plano_preco_map`. Criar mapeamento para `linha_slug = 'select'`, `tipo_uso = 'particular'` (mesma linha dos outros SELECT):
```sql
INSERT INTO plano_preco_map (plano_id, linha_slug, tipo_uso) 
VALUES ('43fe1e6a-374e-4b69-a76b-aea3f142b3c1', 'select', 'particular');
```

#### 2. Código — auto-filtrar tipo_uso ao selecionar plano

**Arquivo: `src/components/gestao-comercial/ProdutosPlanos.tsx`**

Linha 327 — no `onClick` do sidebar, trocar `setPrecosTipoUso('all')` por auto-selecionar o `tipo_uso` do mapeamento do plano:

```typescript
onClick={() => { 
  setSelectedPlanoId(plan.id); 
  setDetailSubTab('precos'); 
  setPrecosPage(0); 
  setPrecosRegiao('all'); 
  const mapping = precoMappings?.[plan.id];
  setPrecosTipoUso(mapping?.tipoUso || 'all'); 
}}
```

Isso garante que ao selecionar ADVANCED, só mostra faixas `advanced`; ao selecionar ADVANCED+, só mostra `advanced-plus`. O dropdown continua disponível para o gestor alterar manualmente.

### Resumo

- 1 migração SQL com 2 comandos (UPDATE + INSERT)
- 1 alteração de 1 linha em `ProdutosPlanos.tsx`
- Resultado: todos os 16 planos visíveis terão suas faixas de preço corretas

