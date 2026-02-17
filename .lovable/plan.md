

# Corrigir "Trajeto do Veiculo" para Analista de Eventos

## Problema

O componente `TrajetoLocalCard` busca o `rastreador_id` atraves da tabela `instalacoes`, mas a politica RLS dessa tabela NAO inclui a role `analista_eventos`. Resultado: a query retorna vazio e o sistema mostra "Nenhum rastreador instalado neste veiculo".

A tabela `rastreadores` e `rastreador_posicoes` ja sao acessiveis para `analista_eventos`, entao o problema e apenas no passo 1 (busca do rastreador_id via `instalacoes`).

## Solucao

Alterar a query do `TrajetoLocalCard` para buscar o rastreador diretamente na tabela `rastreadores` (que ja tem RLS para `analista_eventos`) em vez da tabela `instalacoes`.

## Alteracao

### Arquivo: `src/components/sinistros/TrajetoLocalCard.tsx`

Linhas 38-52 - Substituir a query que busca em `instalacoes` por uma que busca em `rastreadores`:

**De:**
```typescript
const { data } = await supabase
  .from('instalacoes')
  .select('rastreador_id')
  .eq('veiculo_id', veiculoId)
  .eq('status', 'concluida')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
return data?.rastreador_id as string | null;
```

**Para:**
```typescript
const { data } = await supabase
  .from('rastreadores')
  .select('id')
  .eq('veiculo_id', veiculoId)
  .eq('status', 'instalado')
  .order('updated_at', { ascending: false })
  .limit(1)
  .maybeSingle();
return data?.id as string | null;
```

Esta alteracao busca o rastreador diretamente pela tabela `rastreadores` (acessivel ao analista de eventos) filtrando por `veiculo_id` e `status = 'instalado'`, eliminando a dependencia da tabela `instalacoes`.

## Secao Tecnica

- A tabela `rastreadores` tem policy `Analista eventos pode ver rastreadores` com `has_role(auth.uid(), 'analista_eventos'::app_role)`
- A tabela `rastreador_posicoes` tem policy `Staff can view positions` com `is_funcionario(auth.uid())` - ja funciona
- A tabela `instalacoes` NAO tem `analista_eventos` nas policies de leitura - causa raiz do bug
- Alterar a fonte da query e mais seguro do que adicionar mais uma role na RLS de `instalacoes`, pois o analista de eventos nao precisa de acesso geral a instalacoes

