

# Corrigir Persistencia dos Valores de Pecas (Analista de Eventos)

## Causa Raiz

O problema nao e no codigo React -- e uma restricao de RLS (Row Level Security) no banco de dados.

A politica de UPDATE da tabela `vistorias_evento` permite apenas as roles:
- `regulador`
- `diretor`
- `gerente_comercial`

O usuario logado e um **analista_eventos**, que tem permissao de **leitura** (SELECT) mas **nao de escrita** (UPDATE). O Supabase nao retorna erro nesse caso -- simplesmente nao atualiza nenhuma linha, fazendo parecer que salvou com sucesso.

## Solucao

Atualizar a politica de UPDATE da tabela `vistorias_evento` para incluir a role `analista_eventos`.

### Migracao SQL

```sql
DROP POLICY "Reguladores e gestores podem atualizar vistorias" ON vistorias_evento;

CREATE POLICY "Reguladores gestores e analistas podem atualizar vistorias"
  ON vistorias_evento FOR UPDATE
  USING (
    has_role(auth.uid(), 'regulador') OR
    has_role(auth.uid(), 'diretor') OR
    has_role(auth.uid(), 'gerente_comercial') OR
    has_role(auth.uid(), 'analista_eventos')
  );
```

### Melhoria no Codigo (opcional mas recomendada)

No arquivo `src/pages/eventos/SinistroAnalise.tsx`, melhorar a deteccao de falha silenciosa do update verificando se a resposta do Supabase indica que nenhuma linha foi afetada:

```typescript
const { error, count } = await supabase
  .from('vistorias_evento')
  .update({ dados_vistoria: updatedDados })
  .eq('id', (vistoriaEvento as any).id)
  .select('id');

if (error) throw error;
if (!count && count !== undefined) {
  throw new Error('Sem permissao para atualizar esta vistoria');
}
```

## Resumo

| Item | Alteracao |
|---|---|
| Migracao SQL | Adicionar `analista_eventos` a politica de UPDATE de `vistorias_evento` |
| `SinistroAnalise.tsx` (opcional) | Verificar retorno do update para detectar falhas silenciosas de RLS |

