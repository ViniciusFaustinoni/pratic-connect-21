
# Corrigir Calculo Dinamico da Cota de Coparticipacao

## Problema Raiz

A coluna `valor_cota_participacao` na tabela `sinistros` tem um **DEFAULT de 750.00** (definido na migracao original). Esse valor aparece na tela de pagamento antes do sinistro ser aprovado, pois a funcao `validar-link-evento` apenas le o valor armazenado sem recalcular.

O calculo correto (6% de R$ 70.008,00 = R$ 4.200,48) so acontece quando `aprovar-sinistro` e executado, mas a tela de pagamento pode ser acessada antes disso.

A funcao `autentique-webhook` ja tem um fallback que detecta o valor 750 e recalcula -- confirmando que esse problema ja era conhecido.

## Solucao (2 partes)

### 1. Calcular cota dinamicamente em `validar-link-evento`

**Arquivo:** `supabase/functions/validar-link-evento/index.ts`

Em vez de apenas ler `sinistro.valor_cota_participacao`, calcular dinamicamente usando a mesma logica de `aprovar-sinistro`:

```
valor_cota = max(valor_fipe * percentual / 100, cota_minima)
```

Se o valor calculado for diferente do armazenado, atualizar o registro no banco. Isso garante que mesmo antes da aprovacao, o valor exibido sera correto.

Logica a adicionar na secao de cotaInfo (apos buscar o plano):

```typescript
// Calcular valor correto
let valorCotaCalculado = sinistro.valor_cota_participacao;
if (veiculo?.valor_fipe && percentual > 0) {
  valorCotaCalculado = Math.max(
    veiculo.valor_fipe * percentual / 100,
    cotaMinima
  );

  // Atualizar no banco se diferente
  if (valorCotaCalculado !== sinistro.valor_cota_participacao) {
    await supabase
      .from("sinistros")
      .update({ valor_cota_participacao: valorCotaCalculado })
      .eq("id", sinistro.id);
  }
}

cotaInfo = {
  valor_fipe: veiculo?.valor_fipe || 0,
  percentual,
  cota_minima: cotaMinima,
  valor_cota: valorCotaCalculado,  // Usar valor calculado
  plano_nome: planoNome,
};
```

### 2. Alterar DEFAULT da coluna para NULL

**Migracao SQL:**

```sql
ALTER TABLE sinistros ALTER COLUMN valor_cota_participacao SET DEFAULT NULL;
```

Isso evita que novos sinistros recebam 750.00 automaticamente. O valor so sera preenchido quando efetivamente calculado.

### 3. Corrigir o sinistro atual

**Operacao de dados (INSERT tool):**

```sql
UPDATE sinistros SET valor_cota_participacao = 4200.48
WHERE protocolo = 'SIN-20260216-0007';
```

## Deploy

Redeployar a Edge Function `validar-link-evento`.

## Resultado Esperado

- Valor da cota exibido corretamente: **R$ 4.200,48** (em vez de R$ 750,00)
- Percentual: **6%** (ja corrigido na versao anterior)
- Cota minima: **R$ 1.200,00** (ja corrigido na versao anterior)
- Novos sinistros nao terao mais o default de 750

| Arquivo / Recurso | Alteracao |
|---|---|
| `supabase/functions/validar-link-evento/index.ts` | Adicionar calculo dinamico da cota e atualizacao automatica no banco |
| Migracao SQL | Alterar DEFAULT de 750.00 para NULL |
| Dados | Atualizar sinistro SIN-20260216-0007 para 4200.48 |
