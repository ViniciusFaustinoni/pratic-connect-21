
# Plano: Adicionar Perfil "Vistoriador Base"

## Objetivo

Criar um novo perfil de usuário chamado **Vistoriador Base** que:
- Tem acesso ao App do Vistoriador (área `/instalador`)
- **NÃO** tem acesso ao mapa (funcionalidade de GPS/rotas)
- **NÃO** está associado a regiões geográficas
- Recebe **automaticamente** apenas tarefas agendadas NA BASE (`local_vistoria = 'base'`)
- Atribuição é feita por **disponibilidade** (quem está livre recebe)

## Análise do Sistema Atual

| Aspecto | Situação Atual |
|---------|---------------|
| Enum `app_role` | Não inclui `vistoriador_base` |
| Modal de Novo Funcionário | Usa lista fixa de perfis |
| App do Instalador | Todos os perfis `instalador_vistoriador` veem o mapa |
| Atribuição de tarefas | Edge function `atribuir-proxima-tarefa` filtra por `local_vistoria != 'base'` |
| Agendamentos Base | Tabela `agendamentos_base` tem campo `atendido_por` mas sem atribuição automática |

## Arquitetura da Solução

### Novo Fluxo de Atribuição Base

```text
1. Cliente agenda vistoria NA BASE
   └─ Registro criado em agendamentos_base (status: agendado)

2. No horário agendado:
   └─ Cron ou coordenador atribui ao vistoriador_base disponível
   └─ atendido_por = profissional_id do vistoriador_base

3. Vistoriador Base abre app:
   └─ Vê apenas tarefas de BASE atribuídas a ele
   └─ NÃO vê mapa no menu
   └─ NÃO precisa de GPS para iniciar serviço
```

### Diferenças entre Instalador/Vistoriador vs Vistoriador Base

| Funcionalidade | Instalador/Vistoriador | Vistoriador Base |
|---------------|----------------------|------------------|
| Acesso ao App | ✅ Sim | ✅ Sim |
| Mapa | ✅ Sim | ❌ Não |
| GPS obrigatório | ✅ Sim | ❌ Não |
| Tarefas em campo | ✅ Sim | ❌ Não |
| Tarefas na base | ❌ Não | ✅ Sim |
| Regiões | ✅ Associado | ❌ Não |
| Atribuição | Por proximidade | Por disponibilidade |

---

## Alterações Necessárias

### 1. Banco de Dados

**Migração SQL:**

```sql
-- Adicionar novo valor ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'vistoriador_base';
```

### 2. Tipos TypeScript

**Arquivo:** `src/types/auth.ts`

```typescript
// Adicionar ao type PerfilAcesso (linha ~55-67)
export type PerfilAcesso = 
  | 'diretor'
  | ...
  | 'instalador_vistoriador'
  | 'vistoriador_base'  // ← NOVO
  | 'associado'
  | ...;

// Adicionar ao PERFIL_ACESSO_LABELS (linha ~282-295)
export const PERFIL_ACESSO_LABELS: Record<PerfilAcesso, string> = {
  ...
  instalador_vistoriador: 'Instalador/Vistoriador',
  vistoriador_base: 'Vistoriador Base',  // ← NOVO
  ...
};
```

### 3. Modal de Novo Funcionário

**Arquivo:** `src/components/usuarios/NovoFuncionarioModal.tsx`

Adicionar `vistoriador_base` à lista de perfis disponíveis:

```typescript
const PERFIS_FUNCIONARIO: PerfilAcesso[] = [
  // ... perfis existentes
  'instalador_vistoriador',
  'vistoriador_base',  // ← NOVO
  'analista_marketing',
  'analista_juridico',
];
```

### 4. Página de Usuários (cores do badge)

**Arquivo:** `src/pages/diretoria/Usuarios.tsx`

Adicionar cor para o novo perfil:

```typescript
const PERFIL_COLORS: Record<PerfilAcesso, string> = {
  ...
  instalador_vistoriador: 'bg-indigo-100 text-indigo-800 ...',
  vistoriador_base: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',  // ← NOVO
  ...
};
```

### 5. InstaladorGuard

**Arquivo:** `src/components/instalador/InstaladorGuard.tsx`

Permitir acesso ao app para `vistoriador_base`:

```typescript
// Verificar se tem a role de instalador OU vistoriador base
if (!hasRole('instalador_vistoriador') && !hasRole('vistoriador_base')) {
  return (
    <div className="flex min-h-screen ...">
      <h1>Acesso Negado</h1>
      ...
    </div>
  );
}
```

### 6. InstaladorLayout (Esconder Mapa)

**Arquivo:** `src/components/instalador/InstaladorLayout.tsx`

Filtrar itens de navegação para vistoriador base:

```typescript
import { useAuth } from '@/contexts/AuthContext';

// Dentro do componente:
const { hasRole } = useAuth();
const isVistoriadorBase = hasRole('vistoriador_base') && !hasRole('instalador_vistoriador');

// Filtrar itens de navegação
const navItems = NAV_ITEMS.filter(item => {
  // Vistoriador base não vê mapa
  if (isVistoriadorBase && item.path === '/instalador/mapa') {
    return false;
  }
  return true;
});

// Usar navItems ao invés de NAV_ITEMS no render
```

### 7. usePermissions

**Arquivo:** `src/hooks/usePermissions.ts`

Adicionar verificações para o novo perfil:

```typescript
// Verificar se é vistoriador base
const isVistoriadorBase = hasRole('vistoriador_base');
const isVistoriadorBaseOnly = isVistoriadorBase && 
  !hasRole('instalador_vistoriador') &&
  !isDiretor && 
  !isGerencia() && 
  !isDesenvolvedor && 
  !isAdminMaster;

// Adicionar ao objeto de permissions
const permissions = {
  ...
  isVistoriadorBase,
  isVistoriadorBaseOnly,
  ...
};
```

### 8. useRouteGuard

**Arquivo:** `src/hooks/useRouteGuard.ts`

Adicionar redirecionamento para vistoriador base:

```typescript
// Vistoriador Base só pode acessar /instalador/* (sem mapa)
if (isVistoriadorBaseOnly) {
  const isInInstaladorArea = location.pathname.startsWith('/instalador');
  const isMapaRoute = location.pathname === '/instalador/mapa';
  
  if (!isInInstaladorArea || isMapaRoute) {
    navigate('/instalador', { replace: true });
    return;
  }
}
```

### 9. Hook de Tarefas Base (NOVO)

**Novo arquivo:** `src/hooks/useTarefasBase.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook para buscar tarefas da base atribuídas ao vistoriador
 */
export function useTarefasBase() {
  const { user } = useAuth();
  const hoje = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['tarefas-base', user?.id, hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agendamentos_base')
        .select(`
          *,
          cotacao:cotacoes(
            id,
            cliente_nome,
            cliente_telefone,
            veiculo_placa,
            veiculo_marca,
            veiculo_modelo
          )
        `)
        .eq('atendido_por', user?.id)
        .eq('data_agendada', hoje)
        .in('status', ['agendado', 'confirmado', 'em_atendimento'])
        .order('horario', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });
}

/**
 * Hook para iniciar atendimento de tarefa base
 */
export function useIniciarAtendimentoBase() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (agendamentoId: string) => {
      const { error } = await supabase
        .from('agendamentos_base')
        .update({
          status: 'em_atendimento',
          atendido_por: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agendamentoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas-base'] });
    },
  });
}
```

### 10. Componente BotaoIniciarServico (Adaptar)

**Arquivo:** `src/components/vistoriador/BotaoIniciarServico.tsx`

Adaptar para não exigir GPS para vistoriador base:

```typescript
const { hasRole } = useAuth();
const isVistoriadorBase = hasRole('vistoriador_base') && !hasRole('instalador_vistoriador');

// Se for vistoriador base, não precisa de GPS
const precisaGPS = !isVistoriadorBase;

// Lógica de iniciar serviço diferente para base
const handleIniciar = async () => {
  if (isVistoriadorBase) {
    // Buscar próxima tarefa da base diretamente
    // Sem envio de coordenadas GPS
  } else {
    // Fluxo atual com GPS
  }
};
```

### 11. Edge Function de Atribuição de Tarefas Base (NOVO)

**Novo arquivo:** `supabase/functions/atribuir-tarefa-base/index.ts`

```typescript
/**
 * Edge function para atribuir automaticamente tarefas da base
 * aos vistoriadores_base por disponibilidade
 * 
 * Executado por cron ou manualmente pelo coordenador
 */
serve(async (req) => {
  // 1. Buscar agendamentos_base pendentes do dia atual
  // 2. Para cada agendamento sem atendido_por:
  //    a. Buscar vistoriadores_base disponíveis (sem tarefa em andamento)
  //    b. Atribuir ao primeiro disponível (round-robin ou menor carga)
  // 3. Retornar resumo de atribuições
});
```

### 12. InstaladorHome (Adaptar)

**Arquivo:** `src/pages/instalador/InstaladorHome.tsx`

Adaptar a home para vistoriador base:

```typescript
const { hasRole } = useAuth();
const isVistoriadorBase = hasRole('vistoriador_base') && !hasRole('instalador_vistoriador');

// Usar hook diferente para tarefas
const { data: tarefaAtual, isLoading } = isVistoriadorBase 
  ? useTarefasBase()  // Tarefas da base
  : useTarefaAtual(); // Tarefas de campo

// Esconder ação "Ver no Mapa" para vistoriador base
const acoesRapidas = [
  { ... minhasTarefas },
  ...(!isVistoriadorBase ? [{ ... verNoMapa }] : []),
  { ... ligarCoordenador },
  { ... whatsapp },
];
```

---

## Seção Técnica

### Estrutura do Enum app_role

```sql
-- Valores atuais:
'diretor', 'gerente_comercial', 'supervisor_vendas', 
'vendedor_clt', 'vendedor_externo', 'analista_cadastro',
'coordenador_monitoramento', 'analista_plataforma', 
'instalador_vistoriador', 'associado', 'analista_marketing', 
'analista_juridico', 'desenvolvedor', 'admin_master', 'agencia', 'admin'

-- Adicionar:
'vistoriador_base'
```

### Lógica de Atribuição por Disponibilidade

```typescript
// Pseudocódigo da Edge Function
async function atribuirTarefasBase() {
  const agendamentosPendentes = await buscarAgendamentosSemAtendente(hoje);
  const vistoriadoresBase = await buscarVistoriadoresBaseAtivos();
  
  for (const agendamento of agendamentosPendentes) {
    // Encontrar vistoriador com menos tarefas no horário
    const vistoriadorDisponivel = vistoriadoresBase
      .sort((a, b) => a.tarefasNoHorario - b.tarefasNoHorario)[0];
    
    if (vistoriadorDisponivel) {
      await atribuirAgendamento(agendamento.id, vistoriadorDisponivel.id);
    }
  }
}
```

### Tabela de Referência: Arquivos a Modificar

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `supabase/migrations/XXXX.sql` | Migração | Adicionar enum value |
| `src/types/auth.ts` | Tipo | Adicionar perfil ao type e labels |
| `src/components/usuarios/NovoFuncionarioModal.tsx` | Componente | Adicionar perfil à lista |
| `src/pages/diretoria/Usuarios.tsx` | Página | Adicionar cor do badge |
| `src/components/instalador/InstaladorGuard.tsx` | Guard | Permitir acesso |
| `src/components/instalador/InstaladorLayout.tsx` | Layout | Esconder mapa |
| `src/hooks/usePermissions.ts` | Hook | Adicionar verificações |
| `src/hooks/useRouteGuard.ts` | Hook | Adicionar redirecionamento |
| `src/hooks/useTarefasBase.ts` | Hook | **NOVO** - Buscar tarefas base |
| `src/components/vistoriador/BotaoIniciarServico.tsx` | Componente | Adaptar para base |
| `src/pages/instalador/InstaladorHome.tsx` | Página | Adaptar UI |
| `supabase/functions/atribuir-tarefa-base/index.ts` | Edge Function | **NOVO** - Atribuição automática |

---

## Resultado Esperado

### Antes (Sem Vistoriador Base)
- Coordenador atribui manualmente `atendido_por` nos agendamentos da base
- Vistoriadores de campo podem acessar o mapa desnecessariamente
- Sem diferenciação entre profissionais de campo e base

### Depois (Com Vistoriador Base)
- Novo perfil disponível na criação de funcionários
- Atribuição automática de tarefas da base por disponibilidade
- Interface simplificada (sem mapa) para quem trabalha apenas na base
- Separação clara de responsabilidades entre campo e base
