
# Plano: Corrigir Filtro de Vistoriadores no Modal de Atribuição

## Problema Identificado

O modal `AtribuirVistoriadorModal.tsx` está buscando **todos os usuários ativos** do sistema em vez de filtrar apenas os vistoriadores.

**Query atual (incorreta):**
```typescript
const query = supabase
  .from('profiles')
  .select('id, nome, telefone, ativo')
  .eq('ativo', true)
  .order('nome');
```

Esta query retorna todos os profiles (Analista Cadastro, Coordenador, etc.) sem verificar se possuem a role de vistoriador.

## Solução

Modificar a query para primeiro buscar os `user_id` da tabela `user_roles` que tenham role `instalador_vistoriador` ou `vistoriador_base`, e depois buscar apenas os profiles correspondentes.

## Alterações

**Arquivo:** `src/components/monitoramento/AtribuirVistoriadorModal.tsx`

### Lógica a implementar:

```typescript
// 1. Buscar user_ids que são vistoriadores
const { data: roles, error: rolesError } = await supabase
  .from('user_roles')
  .select('user_id')
  .in('role', ['instalador_vistoriador', 'vistoriador_base']);

if (rolesError) throw rolesError;
if (!roles?.length) return [];

const userIds = roles.map(r => r.user_id);

// 2. Buscar profiles apenas desses user_ids
const { data, error } = await supabase
  .from('profiles')
  .select('id, user_id, nome, telefone, ativo, regioes_atendimento, capacidade_diaria')
  .in('user_id', userIds)
  .eq('ativo', true)
  .order('nome');
```

### Melhorias adicionais:

1. **Usar dados reais de regiões:** Trocar o mock `['Centro', 'Zona Sul', 'Pinheiros']` pelo campo real `regioes_atendimento` do profile

2. **Usar capacidade real:** Trocar o mock `capacidadeDia: 5` pelo campo real `capacidade_diaria` do profile

3. **Buscar contagem real de tarefas:** Contar quantas tarefas (instalações + vistorias) o vistoriador tem agendadas para o dia selecionado

## Resultado Esperado

Após a correção, apenas usuários com as roles `instalador_vistoriador` ou `vistoriador_base` aparecerão na lista de seleção. Usuários como "Analista Cadastro" e "Coordenador de Monitoramento" não aparecerão mais.
