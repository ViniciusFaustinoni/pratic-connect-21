

## Plano: Remover carência de todas as coberturas (manter apenas em Vidros e Faróis)

### Situação atual
| Entidade | Com carência ativa | Ação |
|----------|-------------------|------|
| Coberturas (100% FIPE) | 814 registros | **Desativar** |
| Benefícios (Vidros e Faróis) | 214 registros | Manter como está |

### Correção

Executar um único UPDATE na tabela `coberturas`:

```sql
UPDATE coberturas
SET carencia_ativa = false
WHERE carencia_ativa = true;
```

Isso desativa a carência de liberação de 120 dias em todas as 814 coberturas, sem afetar os benefícios "Vidros e Faróis" (que ficam na tabela `benefits`). Nenhuma mudança de código é necessária.

