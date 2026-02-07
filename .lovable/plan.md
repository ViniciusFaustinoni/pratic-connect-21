
# Plano: Otimizar Dashboard do Analista de Cadastro

## Análise Atual

O Dashboard atual do Analista de Cadastro (`DashboardCadastro.tsx`) contém:

### Elementos Existentes:
1. **Banner de Boas-Vindas** ✅ (manter)
2. **KPIs** (4 cards):
   - Documentos Pendentes
   - Em Análise
   - Aprovados
   - Taxa de Aprovação
3. **Fila de Documentos** - lista de documentos
4. **Ações Rápidas** (4 botões):
   - Propostas Pendentes
   - Fila de Documentos
   - Associados
   - Meu Perfil

### Problemas Identificados:
- **Botões Redundantes**: "Fila de Documentos" aparece duplicado (na lista e nas ações)
- **Meu Perfil**: Não é funcionalidade do analista, é genérico
- **Métricas de Documentos**: O sistema atual foca mais em **Propostas** do que em documentos isolados
- **Falta de Gráficos**: Sem visualização de tendências ou performance
- **Falta de Métricas Relevantes**: Não mostra propostas aguardando, aprovadas hoje, etc.

---

## Nova Estrutura Proposta

```
┌─────────────────────────────────────────────────────────────┐
│                 Banner de Boas-Vindas                       │
├─────────────────────────────────────────────────────────────┤
│  [KPIs - 4 Cards]                                           │
│  Propostas Aguardando | Aprovadas Hoje | Reprovadas | Taxa  │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │            Gráfico: Performance Semanal              │  │
│  │  (BarChart - Aprovadas x Reprovadas por dia)         │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────┐  ┌─────────────────────────┐ │
│  │  Propostas Aguardando     │  │  Ações Rápidas (2)      │ │
│  │  Análise (lista rápida)   │  │  ✓ Propostas Pendentes  │ │
│  │                           │  │  ✓ Associados           │ │
│  └───────────────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Alterações Detalhadas

### 1. Substituir KPIs de Documentos por Propostas

**Remover:**
- Documentos Pendentes
- Em Análise (documentos)
- Aprovados (documentos)

**Adicionar:**
- **Propostas Aguardando** - Prontas para análise (com vistoria/instalação)
- **Aprovadas Hoje** - Contratos ativados no dia
- **Reprovadas Hoje** - Propostas canceladas no dia
- **Taxa de Aprovação** - (Aprovadas / Total) do período

### 2. Adicionar Gráfico de Performance Semanal

Um gráfico de barras mostrando:
- **Eixo X**: Últimos 7 dias
- **Barras Verdes**: Propostas aprovadas
- **Barras Vermelhas**: Propostas reprovadas

Isso ajuda o analista a ver sua produtividade ao longo da semana.

### 3. Substituir Lista de Documentos por Propostas

**Remover:**
- Card "Fila de Documentos" (lista de documentos pendentes)

**Adicionar:**
- Card "Propostas Aguardando" - lista das últimas 5 propostas prontas para análise
- Cada item mostra: Nome do cliente, Placa do veículo, Tempo de espera
- Botão "Analisar Próxima Proposta"

### 4. Simplificar Ações Rápidas

**Remover:**
- Fila de Documentos (redundante com a lista)
- Meu Perfil (não é função operacional)

**Manter:**
- Propostas Pendentes
- Associados

---

## Hooks a Utilizar

| Hook | Dados |
|------|-------|
| `usePropostaStats()` | aguardando, emAnalise, aprovadosHoje, reprovadosHoje |
| `usePropostasPendentes()` | Lista de propostas prontas para análise |

### Novo Hook Necessário

Criar `useCadastroPerformance()` para buscar dados do gráfico:
- Propostas aprovadas/reprovadas por dia nos últimos 7 dias
- Consulta a tabela `contratos` agrupando por `data_ativacao` e `updated_at`

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/cadastro/DashboardCadastro.tsx` | Refatorar completamente com novos KPIs, gráfico e lista de propostas |
| `src/hooks/usePropostasPendentes.ts` | Exportar `usePropostaStats` (já existe) |

### Novo Arquivo

| Arquivo | Conteúdo |
|---------|----------|
| `src/hooks/useCadastroPerformance.ts` | Hook para buscar performance diária dos últimos 7 dias |

---

## Resultado Esperado

O Analista de Cadastro verá um dashboard focado em:
1. **Métricas de Propostas** (não documentos isolados)
2. **Performance Visual** (gráfico de barras da semana)
3. **Fila de Trabalho** (propostas prontas para análise)
4. **Ações Relevantes** (apenas 2 botões úteis)

---

## Seção Técnica

### Estrutura do Novo Hook `useCadastroPerformance`

```typescript
export function useCadastroPerformance() {
  return useQuery({
    queryKey: ['cadastro-performance'],
    queryFn: async () => {
      const hoje = new Date();
      const seteDiasAtras = new Date(hoje);
      seteDiasAtras.setDate(hoje.getDate() - 7);
      
      // Buscar aprovados (status ativo com data_ativacao nos últimos 7 dias)
      const { data: aprovados } = await supabase
        .from('contratos')
        .select('data_ativacao')
        .eq('status', 'ativo')
        .gte('data_ativacao', seteDiasAtras.toISOString());
      
      // Buscar reprovados (status cancelado com updated_at nos últimos 7 dias)
      const { data: reprovados } = await supabase
        .from('contratos')
        .select('updated_at')
        .eq('status', 'cancelado')
        .gte('updated_at', seteDiasAtras.toISOString());
      
      // Agrupar por dia
      const diasMap = new Map<string, { aprovados: number; reprovados: number }>();
      
      // Inicializar últimos 7 dias
      for (let i = 6; i >= 0; i--) {
        const dia = new Date(hoje);
        dia.setDate(hoje.getDate() - i);
        const diaStr = format(dia, 'dd/MM');
        diasMap.set(diaStr, { aprovados: 0, reprovados: 0 });
      }
      
      // Contar aprovados por dia
      aprovados?.forEach(c => {
        if (c.data_ativacao) {
          const diaStr = format(new Date(c.data_ativacao), 'dd/MM');
          const atual = diasMap.get(diaStr);
          if (atual) diasMap.set(diaStr, { ...atual, aprovados: atual.aprovados + 1 });
        }
      });
      
      // Contar reprovados por dia
      reprovados?.forEach(c => {
        const diaStr = format(new Date(c.updated_at), 'dd/MM');
        const atual = diasMap.get(diaStr);
        if (atual) diasMap.set(diaStr, { ...atual, reprovados: atual.reprovados + 1 });
      });
      
      return Array.from(diasMap.entries()).map(([dia, dados]) => ({
        dia,
        ...dados
      }));
    }
  });
}
```

### Componente do Gráfico (usando Recharts)

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function PerformanceChart({ data, loading }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Semanal</CardTitle>
        <CardDescription>Propostas analisadas nos últimos 7 dias</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="dia" className="text-xs" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="aprovados" fill="#22c55e" name="Aprovadas" />
              <Bar dataKey="reprovados" fill="#ef4444" name="Reprovadas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Novos KPIs com usePropostaStats

```typescript
const { data: stats, isLoading: statsLoading } = usePropostaStats();

// KPIs baseados em propostas
<KPICard
  titulo="Aguardando Análise"
  valor={stats?.aguardando || 0}
  icon={<Clock className="h-5 w-5 text-white" />}
  cor="bg-amber-500"
  loading={statsLoading}
/>
<KPICard
  titulo="Aprovadas Hoje"
  valor={stats?.aprovadosHoje || 0}
  icon={<CheckCircle className="h-5 w-5 text-white" />}
  cor="bg-green-500"
  loading={statsLoading}
/>
<KPICard
  titulo="Reprovadas Hoje"
  valor={stats?.reprovadosHoje || 0}
  icon={<XCircle className="h-5 w-5 text-white" />}
  cor="bg-red-500"
  loading={statsLoading}
/>
```

### Lista de Propostas Aguardando

Usar `usePropostasPendentes()` para exibir as últimas 5 propostas na fila, com navegação direta para `/cadastro/propostas/:id`.

