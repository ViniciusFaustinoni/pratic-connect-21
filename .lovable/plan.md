
# Plano: Sistema de Controle de Jornada para Vistoriadores

## Visão Geral

Implementar um sistema completo de controle de jornada de trabalho integrado ao app do vistoriador/instalador, com:

- **Jornada diária**: 8 horas de trabalho + 1 hora de almoço obrigatório
- **Almoço automático**: Bloqueio de atribuições após 4 horas de trabalho por 1 hora
- **Banco de horas**: Horas extras viram crédito, horas faltantes viram débito
- **Integração RH**: Visualização completa no painel de Recursos Humanos

---

## Arquitetura da Solução

### Nova Tabela: `turnos_profissionais`

```sql
CREATE TABLE turnos_profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES profiles(id),
  data DATE NOT NULL,
  
  -- Horários
  inicio_turno TIMESTAMPTZ,
  inicio_almoco TIMESTAMPTZ,
  fim_almoco TIMESTAMPTZ,
  fim_turno TIMESTAMPTZ,
  
  -- Cálculos automáticos
  minutos_trabalhados INTEGER DEFAULT 0,
  minutos_almoco INTEGER DEFAULT 0,
  minutos_extras INTEGER DEFAULT 0,      -- Positivo = horas extras
  minutos_faltantes INTEGER DEFAULT 0,   -- Positivo = horas devidas
  
  -- Saldo de horas do dia anterior (carryover)
  saldo_anterior_minutos INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'ativo', -- ativo, em_almoco, encerrado
  encerrado_automaticamente BOOLEAN DEFAULT false,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(profissional_id, data)
);
```

### Fluxo de Funcionamento

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LINHA DO TEMPO DO DIA                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  08:00              12:00    13:00              17:00                   │
│    │                  │        │                  │                     │
│    ▼                  ▼        ▼                  ▼                     │
│ ┌──────┐         ┌────────┐ ┌──────┐         ┌────────┐                │
│ │INICIAR│  4h    │ALMOÇO  │ │VOLTAR│   4h    │ENCERRAR│                │
│ │SERVIÇO│───────▶│FORÇADO │─▶│      │────────▶│ TURNO  │                │
│ └──────┘         │ 1 hora │ └──────┘         └────────┘                │
│                  └────────┘                                            │
│                                                                         │
│  • Após 4h: App bloqueia novas atribuições                              │
│  • Exibe: "Horário de Almoço - Retorno em 58 min"                       │
│  • Após 1h: Libera automaticamente                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes a Criar/Modificar

### 1. Hook: `useJornadaTrabalho`

```typescript
// src/hooks/useJornadaTrabalho.ts
interface JornadaState {
  turnoId: string | null;
  inicioTurno: Date | null;
  
  // Tempo trabalhado
  minutosTrabalhados: number;
  minutosRestantes: number; // Para completar 8h
  
  // Almoço
  emAlmoco: boolean;
  inicioAlmoco: Date | null;
  minutosAlmocoRestantes: number;
  deveIniciarAlmoco: boolean; // true após 4h
  
  // Saldo
  saldoAnterior: number; // Minutos (pode ser negativo)
  
  // Status
  status: 'inativo' | 'trabalhando' | 'almoco' | 'encerrado';
}

// Funções:
// - iniciarTurno()
// - iniciarAlmoco()
// - finalizarAlmoco()
// - encerrarTurno()
// - getTempoFormatado() // "4h 32min trabalhadas | 3h 28min restantes"
```

### 2. Componente: `JornadaStatusBar`

Barra fixa no topo do app do vistoriador mostrando:

```
┌──────────────────────────────────────────────────────────┐
│ ⏱️ 4h 32min trabalhadas    │    🎯 3h 28min restantes  │
├──────────────────────────────────────────────────────────┤
│ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 56%  │
└──────────────────────────────────────────────────────────┘
```

### 3. Componente: `AlmocoBloqueioOverlay`

Overlay que aparece quando atinge 4 horas:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    🍽️ HORÁRIO DE ALMOÇO                     │
│                                                             │
│          Você completou 4 horas de trabalho.                │
│          Nenhuma tarefa será atribuída agora.               │
│                                                             │
│                  ⏰ Retorno em: 58:42                       │
│                                                             │
│           Aproveite sua pausa para descansar!               │
│                                                             │
│  ──────────────────────────────────────────────────────── │
│  Após 1 hora, você voltará a receber tarefas               │
│  automaticamente.                                           │
└─────────────────────────────────────────────────────────────┘
```

### 4. Modificar: `cron-atribuir-tarefas`

Adicionar verificação de almoço antes de atribuir:

```typescript
// Antes de atribuir tarefa, verificar se está em almoço
const { data: turno } = await supabase
  .from('turnos_profissionais')
  .select('*')
  .eq('profissional_id', prof.vistoriador_id)
  .eq('data', hoje)
  .single();

if (turno?.status === 'em_almoco') {
  console.log(`Profissional ${prof.vistoriador_id} em almoço - pulando`);
  continue;
}

// Verificar se precisa forçar almoço (4h trabalhadas)
if (turno && !turno.inicio_almoco) {
  const minutosTrabalhados = calcularMinutosTrabalhados(turno.inicio_turno);
  if (minutosTrabalhados >= 240) { // 4 horas
    // Forçar início do almoço
    await supabase
      .from('turnos_profissionais')
      .update({ 
        status: 'em_almoco',
        inicio_almoco: new Date().toISOString()
      })
      .eq('id', turno.id);
    continue;
  }
}
```

### 5. Modificar: `useIniciarServico`

Integrar com controle de jornada:

```typescript
const iniciarServico = async () => {
  // ... código existente de geolocalização ...
  
  // Criar/atualizar turno do dia
  const hoje = new Date().toISOString().split('T')[0];
  
  // Buscar saldo do dia anterior
  const { data: turnoAnterior } = await supabase
    .from('turnos_profissionais')
    .select('minutos_extras, minutos_faltantes')
    .eq('profissional_id', profile.id)
    .lt('data', hoje)
    .order('data', { ascending: false })
    .limit(1)
    .single();
  
  const saldoAnterior = (turnoAnterior?.minutos_extras || 0) - 
                        (turnoAnterior?.minutos_faltantes || 0);
  
  // Criar turno de hoje
  await supabase
    .from('turnos_profissionais')
    .upsert({
      profissional_id: profile.id,
      data: hoje,
      inicio_turno: new Date().toISOString(),
      saldo_anterior_minutos: saldoAnterior,
      status: 'ativo'
    });
};
```

---

## Área de RH - Novos Componentes

### 1. Página: `/rh/jornadas`

Dashboard de controle de jornada com:

- **Visão em tempo real** dos profissionais em campo
- **Status atual**: Trabalhando, Em Almoço, Offline
- **Tempo trabalhado hoje** por profissional
- **Alertas**: Profissionais sem almoço, ultrapassando jornada

### 2. Card: `JornadaProfissionalCard`

```
┌─────────────────────────────────────────────────────────────┐
│ 👤 João Silva                          🟢 Trabalhando      │
│                                                             │
│ ⏰ Início: 08:15        🍽️ Almoço: 12:15-13:15             │
│                                                             │
│ Trabalhado: 5h 42min    Restante: 2h 18min                 │
│ ████████████████████████████░░░░░░░░░░░░ 71%               │
│                                                             │
│ 📊 Saldo: +45min (ontem trabalhou 8h45)                    │
└─────────────────────────────────────────────────────────────┘
```

### 3. Relatório: Banco de Horas Mensal

Integrar com a tabela `banco_horas` existente para consolidação mensal.

---

## Regras de Negócio

| Regra | Comportamento |
|-------|---------------|
| Jornada padrão | 8 horas de trabalho efetivo |
| Almoço obrigatório | 1 hora, após 4h de trabalho |
| Tolerância início | 10 minutos (não gera débito) |
| Horas extras | Acima de 8h = crédito no banco de horas |
| Horas faltantes | Abaixo de 8h = débito no banco de horas |
| Saldo máximo | ±40 horas (configurável) |
| Compensação | Débito de ontem reduz jornada de hoje |

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useJornadaTrabalho.ts` | Hook principal de controle de jornada |
| `src/components/vistoriador/JornadaStatusBar.tsx` | Barra de status de tempo trabalhado |
| `src/components/vistoriador/AlmocoBloqueioOverlay.tsx` | Overlay de bloqueio durante almoço |
| `src/pages/rh/JornadasProfissionais.tsx` | Dashboard de jornadas para RH |
| `src/components/rh/JornadaProfissionalCard.tsx` | Card de status por profissional |
| `supabase/migrations/xxx_criar_turnos_profissionais.sql` | Migration da nova tabela |

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/instalador/InstaladorHome.tsx` | Adicionar `JornadaStatusBar` e `AlmocoBloqueioOverlay` |
| `src/hooks/useIniciarServico.ts` | Integrar criação de turno ao iniciar serviço |
| `supabase/functions/cron-atribuir-tarefas/index.ts` | Verificar status de almoço antes de atribuir |
| `src/pages/rh/RHDashboard.tsx` | Adicionar card de resumo de jornadas |

---

## Fluxo Visual no App do Vistoriador

```
┌─────────────────────────────────────────┐
│ INÍCIO DO DIA                           │
│                                         │
│  [Iniciar Serviço]                      │
│                                         │
│  • Registra inicio_turno                │
│  • Calcula saldo_anterior do banco      │
│  • Status = 'ativo'                     │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ TRABALHANDO (0-4h)                      │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ⏱️ 2h 15min | 🎯 5h 45min restantes│ │
│ │ ████████░░░░░░░░░░░░░░░░░░ 28%     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Tarefa Atual / Aguardando]             │
└───────────────┬─────────────────────────┘
                │ após 4 horas
                ▼
┌─────────────────────────────────────────┐
│ ALMOÇO OBRIGATÓRIO (1h)                 │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │           🍽️ ALMOÇO                │ │
│ │                                     │ │
│ │   Nenhuma tarefa será atribuída    │ │
│ │                                     │ │
│ │        ⏰ Retorno em: 48:32        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Tela bloqueada para tarefas]           │
└───────────────┬─────────────────────────┘
                │ após 1 hora
                ▼
┌─────────────────────────────────────────┐
│ TRABALHANDO (4h - 8h)                   │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ⏱️ 6h 30min | 🎯 1h 30min restantes│ │
│ │ ████████████████████████░░░░ 81%   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Tarefa Atual / Aguardando]             │
│                                         │
│ [Encerrar Turno] (no Perfil)            │
└─────────────────────────────────────────┘
```

---

## Considerações Técnicas

1. **Timer em tempo real**: Usar `setInterval` de 1 minuto para atualizar contadores
2. **Persistência**: Todos os dados salvos no banco para auditoria
3. **Offline**: Guardar timestamps localmente e sincronizar quando online
4. **Timezone**: Usar sempre horário de Brasília para cálculos
5. **Encerramento automático**: Se não encerrar até 22h, sistema encerra
