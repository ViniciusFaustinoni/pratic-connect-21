

# Plano: Corrigir status "Pendente" da Softruck

## Problema raiz

Existem duas tabelas de credenciais:
- `integracoes_credenciais`: onde as credenciais criptografadas sao salvas pelo sheet de configuracao
- `rastreadores_credenciais`: onde o UI le `configurado` e `teste_sucesso` para exibir o badge

O edge function `rastreador-testar-conexao` atualiza apenas `integracoes_credenciais` (linha 168), mas nunca toca `rastreadores_credenciais`. Para Rede Veiculos alguem setou `configurado = true` manualmente, para Softruck ficou `false`.

## Correcao

### 1. `supabase/functions/rastreador-testar-conexao/index.ts`

Apos o update em `integracoes_credenciais` (linha 177), adicionar update em `rastreadores_credenciais`:

```typescript
// Atualizar rastreadores_credenciais (usado pela UI)
try {
  const { data: plat } = await supabase
    .from('rastreadores_config_plataformas')
    .select('id')
    .eq('plataforma', plataforma_codigo)
    .single();

  if (plat) {
    await supabase
      .from('rastreadores_credenciais')
      .update({
        configurado: testeSucesso,
        teste_sucesso: testeSucesso,
        testado_em: new Date().toISOString(),
        teste_mensagem: mensagem,
      })
      .eq('plataforma_id', plat.id);
  }
} catch (e) {
  console.log('[Testar Conexão] Erro ao atualizar rastreadores_credenciais:', e);
}
```

### 2. Correcao retroativa (SQL via migration)

Atualizar o registro existente da Softruck para refletir que esta configurado:

```sql
UPDATE rastreadores_credenciais
SET configurado = true
WHERE plataforma_id = (
  SELECT id FROM rastreadores_config_plataformas
  WHERE plataforma = 'softruck'
)
AND configurado = false;
```

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/rastreador-testar-conexao/index.ts` | Atualizar `rastreadores_credenciais` apos teste |
| SQL (migracao) | Correcao retroativa do `configurado` da Softruck |

