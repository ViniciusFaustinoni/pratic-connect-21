

# Correções de Rastreabilidade — Troca de Titularidade

## Problema 1: Consultor não registrado na solicitação

A tabela `chat_solicitacoes_ia` **não tem coluna `criado_por`**. O `TrocaTitularidadeDialog` faz insert sem nenhum campo de responsável. A edge function `efetivar-troca-titularidade` já tenta ler `solicitacao.criado_por` (linha 206), mas o campo não existe no banco — sempre retorna `null`.

## Problema 2: Cenário A/B não persistido na solicitação

O update final em `aprovar-solicitacao-ia` (linha 862-871) atualiza `status`, `aprovado_em`, `aprovador_id` e `resultado_id`, mas **não atualiza o campo `dados`** com o cenário aplicado. O cenário só existe nos logs de auditoria e na resposta HTTP.

---

## Alterações

### 1. Migration — adicionar coluna `criado_por`

```sql
ALTER TABLE chat_solicitacoes_ia 
  ADD COLUMN criado_por UUID REFERENCES auth.users(id);
```

Sem NOT NULL pois solicitações vindas do chat IA não têm consultor vinculado.

### 2. `TrocaTitularidadeDialog.tsx` — registrar usuário logado

- Buscar `supabase.auth.getUser()` no `handleSubmit` antes do insert.
- Incluir `criado_por: user.id` no insert.
- Dois pontos de entrada usam este dialog: `AssociadoDetalhe.tsx` e `OutrasEntradasMenu.tsx` — ambos usam o mesmo componente, então a correção cobre os dois.

### 3. `aprovar-solicitacao-ia` — persistir cenário no campo `dados`

No update final da solicitação (linha 862-871), adicionar merge do cenário no campo `dados`:

```typescript
// Antes do update existente
const dadosAtualizados = {
  ...(solicitacao.dados || {}),
  cenario_aplicado: cenarioA ? 'A' : 'B',
};

// No update
.update({
  status: "aprovado",
  aprovado_em: new Date().toISOString(),
  aprovador_id: perfilId,
  resultado_id,
  dados: dadosAtualizados,  // <-- adicionar
})
```

Isso só se aplica quando `solicitacao.tipo === 'troca_titularidade'`. Para outros tipos, o `dados` não é alterado.

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Adicionar coluna `criado_por` em `chat_solicitacoes_ia` |
| `src/components/associados/TrocaTitularidadeDialog.tsx` | Buscar user logado e incluir `criado_por` no insert |
| `supabase/functions/aprovar-solicitacao-ia/index.ts` | Persistir `cenario_aplicado` no campo `dados` antes do update final |

