

# Plano: Preencher tipo_deslocamento automaticamente

## CORREÇÃO 1 — Instalações novas

**Arquivo**: `supabase/functions/criar-instalacao-pos-pagamento/index.ts`

Antes da linha 364 (montagem do `instalacaoData`), adicionar consulta ao Mapa de Atendimento usando `endereco.cidade` e `endereco.estado` que já estão disponíveis no contexto:

```typescript
// Determinar tipo_deslocamento pelo Mapa de Atendimento
let tipoDeslocamento = 'volante';
try {
  const { data: municipio } = await supabase
    .from('municipios_atendimento')
    .select('tipo_atendimento')
    .ilike('nome', (endereco.cidade || '').trim())
    .ilike('uf', (endereco.estado || '').trim())
    .maybeSingle();

  if (municipio?.tipo_atendimento === 'viagem') {
    tipoDeslocamento = 'viagem';
  } else if (municipio?.tipo_atendimento === 'prestador') {
    tipoDeslocamento = 'prestador';
  }
  console.log(`[CriarInstalacaoPosPagamento] tipo_deslocamento: ${tipoDeslocamento} (municipio: ${endereco.cidade}/${endereco.estado})`);
} catch (err) {
  console.warn('[CriarInstalacaoPosPagamento] Erro ao consultar municipio, usando volante:', err);
}
```

Adicionar `tipo_deslocamento: tipoDeslocamento` ao objeto `instalacaoData` (linha 385).

Padrão segue o mesmo usado em `autentique-create/index.ts` (linhas 277-281) que já faz consulta idêntica.

---

## CORREÇÃO 2 — Instalações existentes

Executar UPDATE retroativo via insert tool (operação de dados, não migração):

```sql
UPDATE instalacoes i
SET tipo_deslocamento = CASE
  WHEN m.tipo_atendimento = 'viagem' THEN 'viagem'
  WHEN m.tipo_atendimento = 'prestador' THEN 'prestador'
  ELSE 'volante'
END
FROM associados a
LEFT JOIN municipios_atendimento m
  ON LOWER(TRIM(m.nome)) = LOWER(TRIM(a.cidade))
  AND LOWER(TRIM(m.uf)) = LOWER(TRIM(a.estado))
WHERE i.associado_id = a.id
  AND (i.tipo_deslocamento IS NULL OR i.tipo_deslocamento = '');
```

---

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/criar-instalacao-pos-pagamento/index.ts` | Consulta municípios + campo tipo_deslocamento no payload |
| SQL (insert tool) | UPDATE retroativo nas instalações existentes |

