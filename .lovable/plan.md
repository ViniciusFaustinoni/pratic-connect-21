
## Agendamento de Vistoria Presencial por Período (Manhã/Tarde)

### Resumo da Mudança

A funcionalidade de agendamento de vistoria presencial será simplificada para apresentar apenas opções por período (Manhã e Tarde), em vez de horários específicos. O sistema limitará a 10 vistorias por período por dia.

### Estado Atual

Atualmente o sistema:
- Exibe horários específicos (08:00, 09:00, 10:00, etc.)
- Não possui limite de vagas por período
- Armazena `hora_agendada` nas tabelas `instalacoes` e `servicos`
- A tabela `servicos` já possui coluna `periodo` (ENUM: manha, tarde, noite)

### Solução Proposta

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                        ANTES                                                   │
├───────────────────────────────────────────────────────────────────────────────┤
│  Escolha o horário:                                                           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │08:00 │ │09:00 │ │10:00 │ │11:00 │ │14:00 │ │15:00 │ │16:00 │ │17:00 │    │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │
└───────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────┐
│                        DEPOIS                                                  │
├───────────────────────────────────────────────────────────────────────────────┤
│  Escolha o período:                                                           │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐      │
│  │  ☀️ MANHÃ                       │  │  🌅 TARDE                        │      │
│  │  8h às 12h                     │  │  14h às 18h                     │      │
│  │  ✓ 8 vagas disponíveis         │  │  ✓ 10 vagas disponíveis         │      │
│  └────────────────────────────────┘  └────────────────────────────────┘      │
│                                                                               │
│  ⚠️ Sábado: apenas período da manhã disponível                              │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/data/autovistoriaConfig.ts` | MODIFICAR | Adicionar config de períodos e função de vagas |
| `src/components/cotacao-publica/AgendamentoVistoria.tsx` | MODIFICAR | Substituir seleção de horários por períodos |
| `src/hooks/useCotacaoVistoria.ts` | MODIFICAR | Enviar período em vez de horário |
| `supabase/functions/agendar-vistoria-presencial/index.ts` | MODIFICAR | Receber período e validar limite de vagas |
| `supabase/functions/criar-instalacao-pos-pagamento/index.ts` | MODIFICAR | Usar período na criação da instalação |
| Migração SQL | CRIAR | Adicionar coluna `vistoria_periodo` na tabela `cotacoes` |

---

### Detalhes Técnicos

#### 1. Migração SQL - Adicionar coluna de período na tabela cotacoes

```sql
ALTER TABLE cotacoes 
ADD COLUMN IF NOT EXISTS vistoria_periodo TEXT 
CHECK (vistoria_periodo IN ('manha', 'tarde'));

ALTER TABLE cotacoes 
ADD COLUMN IF NOT EXISTS vistoria_completa_periodo TEXT 
CHECK (vistoria_completa_periodo IN ('manha', 'tarde'));
```

#### 2. Configuração de Períodos (`src/data/autovistoriaConfig.ts`)

Adicionar constantes e tipos para os períodos:

```typescript
export type Periodo = 'manha' | 'tarde';

export interface PeriodoConfig {
  id: Periodo;
  label: string;
  horarioInicio: string;
  horarioFim: string;
  icone: string;
}

export const PERIODOS_DISPONIVEIS: PeriodoConfig[] = [
  { id: 'manha', label: 'Manhã', horarioInicio: '08:00', horarioFim: '12:00', icone: '☀️' },
  { id: 'tarde', label: 'Tarde', horarioInicio: '14:00', horarioFim: '18:00', icone: '🌅' },
];

export const LIMITE_VAGAS_POR_PERIODO = 10;

// Sábado: apenas manhã
export const getPeriodosParaDia = (date: Date): PeriodoConfig[] => {
  if (isSabado(date)) {
    return PERIODOS_DISPONIVEIS.filter(p => p.id === 'manha');
  }
  return PERIODOS_DISPONIVEIS;
};
```

#### 3. Hook para Verificar Vagas Disponíveis

Criar novo hook ou função para consultar vagas:

```typescript
export function useVagasDisponiveis(data: string) {
  return useQuery({
    queryKey: ['vagas-periodo', data],
    queryFn: async () => {
      const { data: servicos, error } = await supabase
        .from('servicos')
        .select('periodo')
        .eq('data_agendada', data)
        .eq('local_vistoria', 'cliente')
        .not('status', 'in', '("cancelada","recusada")');
      
      if (error) throw error;
      
      const contagem = { manha: 0, tarde: 0 };
      servicos?.forEach(s => {
        if (s.periodo === 'manha') contagem.manha++;
        else if (s.periodo === 'tarde') contagem.tarde++;
      });
      
      return {
        manha: LIMITE_VAGAS_POR_PERIODO - contagem.manha,
        tarde: LIMITE_VAGAS_POR_PERIODO - contagem.tarde,
      };
    },
    enabled: !!data,
  });
}
```

#### 4. Componente AgendamentoVistoria - Mudança de UI

Substituir a grid de horários por cards de período:

```tsx
// Estado
const [periodoSelecionado, setPeriodoSelecionado] = useState<Periodo | null>(null);

// UI
<div className="grid grid-cols-2 gap-4">
  {periodosDisponiveis.map((periodo) => {
    const vagasRestantes = vagasData?.[periodo.id] ?? LIMITE_VAGAS_POR_PERIODO;
    const esgotado = vagasRestantes <= 0;
    
    return (
      <Card
        key={periodo.id}
        className={cn(
          "p-4 cursor-pointer transition-all",
          periodoSelecionado === periodo.id && "ring-2 ring-primary",
          esgotado && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !esgotado && setPeriodoSelecionado(periodo.id)}
      >
        <div className="text-2xl mb-2">{periodo.icone}</div>
        <h3 className="font-bold text-lg">{periodo.label}</h3>
        <p className="text-sm text-muted-foreground">
          {periodo.horarioInicio} às {periodo.horarioFim}
        </p>
        <p className="text-sm mt-2">
          {esgotado 
            ? <span className="text-destructive">Esgotado</span>
            : <span className="text-success">{vagasRestantes} vagas</span>
          }
        </p>
      </Card>
    );
  })}
</div>
```

#### 5. Edge Function - Validação de Vagas

Na função `agendar-vistoria-presencial`, adicionar validação:

```typescript
// Verificar vagas disponíveis
const { data: servicosExistentes } = await supabase
  .from('servicos')
  .select('id')
  .eq('data_agendada', dataAgendada)
  .eq('periodo', periodoAgendado)
  .eq('local_vistoria', 'cliente')
  .not('status', 'in', '("cancelada","recusada")');

if ((servicosExistentes?.length || 0) >= 10) {
  return new Response(JSON.stringify({
    success: false,
    error: 'Período esgotado para esta data'
  }), { status: 400, headers: corsHeaders });
}
```

#### 6. Criação da Instalação - Usar Período

No `criar-instalacao-pos-pagamento`, ler o período da cotação:

```typescript
const instalacaoData = {
  // ... outros campos
  hora_agendada: null, // Não usa mais horário específico
  periodo: cotacao.vistoria_periodo, // Usa o período
};
```

### Fluxo Completo

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────────┐
│ 1. Cliente      │────▶│ 2. Componente   │────▶│ 3. Edge Function        │
│    seleciona    │     │    envia data   │     │    valida limite de     │
│    data + período│     │    + período    │     │    vagas (máx 10)       │
└─────────────────┘     └─────────────────┘     └─────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. Salva na cotação: vistoria_periodo = 'manha' ou 'tarde'              │
│ 5. Após pagamento: cria instalação com periodo = 'manha' ou 'tarde'     │
│ 6. Trigger sincroniza para tabela servicos com periodo correto          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Regras de Negócio Preservadas

- Atribuição automática de tarefas continua igual (por período)
- Encaixe continua funcionando (por período, não horário)
- Sábado só tem manhã (já definido nas regras existentes)
- Domingo continua bloqueado
