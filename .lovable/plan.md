
# Plano: Otimizar Dashboard do Coordenador de Monitoramento

## Análise do Dashboard Atual

O Dashboard do Coordenador (`src/pages/monitoramento/DashboardCoordenador.tsx`) possui:

### Elementos Existentes (509 linhas):

| Seção | Descrição |
|-------|-----------|
| **KPIs** (5 cards) | Rotas Hoje, Em Execução, Vistorias Pendentes, Instalações Hoje, Taxa de Conclusão |
| **Métricas de Tempo** (3 cards) | Tempo Médio em Trânsito, Tempo Médio de Execução, Rastreadores em Porte |
| **Agendamentos na Base** | Componente funcional com lista de agendamentos do dia |
| **Equipe em Campo** | Cards com status dos profissionais e progresso de tarefas |
| **Alertas e Pendências** | Lista de alertas dinâmicos (atrasados, sem equipe, pendentes) |
| **Ações Rápidas** (4 botões) | Ver Fila de Vistorias, Gestão de Rotas, Equipe, Instalações |

### Diagnóstico:

**Elementos Funcionais e Relevantes:**
- KPIs (todos funcionais e relevantes)
- Métricas de Tempo (funcionais, úteis para gestão)
- Rastreadores em Porte (relevante para controle de estoque)
- Agendamentos na Base (funcional)
- Alertas e Pendências (funcional)
- Equipe em Campo (funcional)

**Elementos Funcionais mas podem ser melhorados:**
- Ações Rápidas: 4 botões ✓ (mantemos todos, são relevantes para o coordenador)

**O que falta:**
- **Gráficos visuais** - Não há gráficos de evolução ou desempenho
- **Visão de produtividade** - Quantidade de serviços realizados por dia

---

## Proposta de Melhorias

### 1. Adicionar Gráfico de Performance Semanal

Incluir um gráfico de barras mostrando:
- **Eixo X**: Últimos 7 dias
- **Barras Azuis**: Vistorias realizadas
- **Barras Verdes**: Instalações realizadas

Isso permite ao coordenador visualizar a produtividade da equipe ao longo da semana.

### 2. Reorganizar Layout

A estrutura atual está funcional, mas o gráfico será adicionado após os cards de métricas de tempo.

### Nova Estrutura:

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Central de Monitoramento                           │
├─────────────────────────────────────────────────────────────┤
│  [KPIs - 5 Cards]                                           │
│  Rotas | Em Execução | Vistorias | Instalações | Taxa       │
├─────────────────────────────────────────────────────────────┤
│  [Métricas de Tempo - 3 Cards]                              │
│  Tempo Trânsito | Tempo Execução | Rastreadores             │
├─────────────────────────────────────────────────────────────┤
│  [NOVO: Gráfico Performance Semanal - Full Width]           │
│  BarChart: Vistorias x Instalações nos últimos 7 dias       │
├─────────────────────────────────────────────────────────────┤
│  [Agendamentos na Base]                                     │
├─────────────────────────────────────────────────────────────┤
│  [Grid 2/3 + 1/3]                                           │
│  Equipe em Campo | Alertas e Pendências                     │
├─────────────────────────────────────────────────────────────┤
│  [Ações Rápidas - 4 botões - MANTIDOS]                      │
│  Fila Vistorias | Rotas | Equipe | Instalações              │
└─────────────────────────────────────────────────────────────┘
```

---

## O Que Será Mantido

| Elemento | Motivo |
|----------|--------|
| 5 KPIs | Todos funcionais e relevantes para operação diária |
| 3 Cards de Métricas de Tempo | Dados úteis sobre produtividade |
| Agendamentos na Base | Funcionalidade operacional importante |
| Equipe em Campo | Visibilidade do status da equipe |
| Alertas e Pendências | Ações corretivas imediatas |
| 4 Ações Rápidas | Navegação direta para funcionalidades principais |

---

## Novo Hook: `usePerformanceSemanal`

Criar hook para buscar dados do gráfico:

```typescript
interface PerformanceDia {
  dia: string;        // "07/02"
  vistorias: number;  // Quantidade de vistorias concluídas
  instalacoes: number; // Quantidade de instalações concluídas
}
```

Query:
- Buscar vistorias com status 'aprovada' ou 'reprovada' nos últimos 7 dias
- Buscar instalações com status 'concluida' nos últimos 7 dias
- Agrupar por data

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/monitoramento/DashboardCoordenador.tsx` | Adicionar gráfico de performance semanal |

### Novo Arquivo

| Arquivo | Conteúdo |
|---------|----------|
| `src/hooks/usePerformanceSemanalCoordenador.ts` | Hook para buscar vistorias/instalações por dia |

---

## Seção Técnica

### Estrutura do Hook `usePerformanceSemanalCoordenador`

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';
import { getHojeBrasilia } from '@/lib/date-utils';

interface PerformanceDia {
  dia: string;
  vistorias: number;
  instalacoes: number;
}

export function usePerformanceSemanalCoordenador() {
  return useQuery({
    queryKey: ['performance-semanal-coordenador'],
    queryFn: async (): Promise<PerformanceDia[]> => {
      const hoje = getHojeBrasilia();
      const seteDiasAtras = subDays(hoje, 6);
      seteDiasAtras.setHours(0, 0, 0, 0);

      // Buscar vistorias concluídas
      const { data: vistorias } = await supabase
        .from('vistorias')
        .select('concluida_em')
        .in('status', ['aprovada', 'reprovada'])
        .not('concluida_em', 'is', null)
        .gte('concluida_em', seteDiasAtras.toISOString());

      // Buscar instalações concluídas
      const { data: instalacoes } = await supabase
        .from('instalacoes')
        .select('concluida_em')
        .eq('status', 'concluida')
        .not('concluida_em', 'is', null)
        .gte('concluida_em', seteDiasAtras.toISOString());

      // Inicializar mapa dos últimos 7 dias
      const diasMap = new Map<string, { vistorias: number; instalacoes: number }>();
      for (let i = 6; i >= 0; i--) {
        const dia = subDays(hoje, i);
        const diaStr = format(dia, 'dd/MM');
        diasMap.set(diaStr, { vistorias: 0, instalacoes: 0 });
      }

      // Contar vistorias por dia
      vistorias?.forEach(v => {
        if (v.concluida_em) {
          const diaStr = format(new Date(v.concluida_em), 'dd/MM');
          const atual = diasMap.get(diaStr);
          if (atual) diasMap.set(diaStr, { ...atual, vistorias: atual.vistorias + 1 });
        }
      });

      // Contar instalações por dia
      instalacoes?.forEach(i => {
        if (i.concluida_em) {
          const diaStr = format(new Date(i.concluida_em), 'dd/MM');
          const atual = diasMap.get(diaStr);
          if (atual) diasMap.set(diaStr, { ...atual, instalacoes: atual.instalacoes + 1 });
        }
      });

      return Array.from(diasMap.entries()).map(([dia, dados]) => ({
        dia,
        ...dados
      }));
    },
    staleTime: 60000,
  });
}
```

### Componente do Gráfico (dentro de DashboardCoordenador.tsx)

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { usePerformanceSemanalCoordenador } from '@/hooks/usePerformanceSemanalCoordenador';

function PerformanceSemanalChart() {
  const { data, isLoading } = usePerformanceSemanalCoordenador();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Performance Semanal
        </CardTitle>
        <CardDescription>
          Serviços realizados nos últimos 7 dias
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="dia" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="vistorias" fill="#3B82F6" name="Vistorias" radius={[4, 4, 0, 0]} />
              <Bar dataKey="instalacoes" fill="#22C55E" name="Instalações" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Posição no Layout

O gráfico será inserido após a seção de "Métricas de Tempo" (linha 362) e antes de "AgendamentosBase" (linha 365).

---

## Resultado Esperado

O Coordenador de Monitoramento terá:

1. **5 KPIs operacionais** - Mantidos (relevantes)
2. **3 Cards de métricas de tempo** - Mantidos (úteis para gestão)
3. **NOVO: Gráfico de Performance Semanal** - Visualização da produtividade
4. **Agendamentos na Base** - Mantido (operacional)
5. **Equipe em Campo + Alertas** - Mantidos (essenciais)
6. **4 Ações Rápidas** - Mantidas (navegação principal)

O dashboard terá agora uma **visão gráfica da performance**, permitindo identificar tendências e dias de maior/menor produtividade.
