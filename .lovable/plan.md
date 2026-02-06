
## Plano: Sistema de Jornada de Trabalho com Controle de Almoço e Atraso

### Contexto Atual

O sistema já possui uma infraestrutura básica de jornada de trabalho:
- **Hook `useJornadaTrabalho`**: Gerencia o controle de tempo trabalhado e status de almoço
- **Tabela `turnos_profissionais`**: Armazena dados do turno diário
- **Overlay `AlmocoBloqueioOverlay`**: Exibe tela de bloqueio durante o almoço
- **Edge Function `cron-atribuir-tarefas`**: Já verifica status de almoço antes de atribuir tarefas

### O Que Precisa Ser Implementado

| Funcionalidade | Status Atual | Ação Necessária |
|----------------|--------------|-----------------|
| 4h de trabalho inicial | ✅ Implementado | Manter |
| 1h de almoço obrigatório | ✅ Implementado | Manter |
| 4h de trabalho após almoço | ⚠️ Parcial | Ajustar cálculo |
| Regra de atraso de almoço | ❌ Não existe | Implementar |
| Verificar almoço na Edge Function `atribuir-proxima-tarefa` | ❌ Faltando | Adicionar |

### Regra de Atraso Detalhada

```
Se o vistoriador atrasar X minutos para voltar do almoço:
→ Ele deve trabalhar X minutos extras no final do turno

Exemplo:
- Almoço iniciado: 12:00
- Fim previsto: 13:00
- Retorno real: 13:25 (25 min de atraso)
- Jornada restante: 4h + 25min = 4h25min
```

---

### Arquivos a Modificar/Criar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/atribuir-proxima-tarefa/index.ts` | Adicionar verificação de status de almoço |
| `src/hooks/useJornadaTrabalho.ts` | Adicionar cálculo de atraso de almoço |
| `src/components/vistoriador/AlmocoBloqueioOverlay.tsx` | Mostrar aviso de atraso após 1 hora |
| `src/components/vistoriador/JornadaStatusBar.tsx` | Exibir acréscimo por atraso |
| **SQL Migration** | Adicionar coluna `minutos_atraso_almoco` na tabela |

---

### Alterações no Banco de Dados

**Nova coluna na tabela `turnos_profissionais`:**

```sql
ALTER TABLE turnos_profissionais 
ADD COLUMN minutos_atraso_almoco INTEGER DEFAULT 0;

COMMENT ON COLUMN turnos_profissionais.minutos_atraso_almoco IS 
  'Minutos de atraso no retorno do almoço. Será acrescido à jornada restante.';
```

---

### Alterações no Hook `useJornadaTrabalho`

**1. Calcular atraso do almoço:**

```typescript
// Calcular atraso de almoço (além de 60 minutos)
let minutosAtrasoAlmoco = 0;
if (turno?.fim_almoco && turno?.inicio_almoco) {
  const inicioAlmoco = new Date(turno.inicio_almoco);
  const fimAlmoco = new Date(turno.fim_almoco);
  const duracaoRealMinutos = Math.floor((fimAlmoco.getTime() - inicioAlmoco.getTime()) / 60000);
  minutosAtrasoAlmoco = Math.max(0, duracaoRealMinutos - DURACAO_ALMOCO_MINUTOS);
}
```

**2. Ajustar jornada restante para considerar o atraso:**

```typescript
// Segunda metade = 4h + atraso
const jornadaSegundaMetade = TEMPO_ATE_ALMOCO_MINUTOS + minutosAtrasoAlmoco;
```

---

### Alterações na Edge Function `atribuir-proxima-tarefa`

Adicionar verificação de status de almoço (similar ao que já existe no `cron-atribuir-tarefas`):

```typescript
// VERIFICAR STATUS DE JORNADA (ALMOÇO)
const hoje = new Date().toISOString().split('T')[0];
const { data: turnoHoje } = await supabase
  .from('turnos_profissionais')
  .select('id, status, inicio_almoco, inicio_turno')
  .eq('profissional_id', profissionalId)
  .eq('data', hoje)
  .maybeSingle();

// Se está em almoço, não atribuir
if (turnoHoje?.status === 'em_almoco') {
  return new Response(
    JSON.stringify({
      resultado: 'em_almoco',
      mensagem: 'Você está em horário de almoço. Aguarde o término para receber novas tarefas.'
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Forçar almoço se atingiu 4h sem iniciar
if (turnoHoje && turnoHoje.status === 'ativo' && !turnoHoje.inicio_almoco && turnoHoje.inicio_turno) {
  const inicioTurno = new Date(turnoHoje.inicio_turno);
  const agora = new Date();
  const minutosTrabalhados = Math.floor((agora.getTime() - inicioTurno.getTime()) / 60000);

  if (minutosTrabalhados >= 240) { // 4 horas
    await supabase
      .from('turnos_profissionais')
      .update({ 
        status: 'em_almoco',
        inicio_almoco: new Date().toISOString()
      })
      .eq('id', turnoHoje.id);
    
    return new Response(
      JSON.stringify({
        resultado: 'almoco_iniciado',
        mensagem: 'Você completou 4 horas de trabalho. Horário de almoço iniciado automaticamente.'
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
```

---

### Alterações no Overlay de Almoço

Após 1 hora de almoço, mostrar mensagem de atraso:

```tsx
// Detectar atraso
const emAtraso = segundosRestantes <= 0;
const minutosAtraso = Math.abs(Math.floor(segundosRestantes / 60));

// Se em atraso, mostrar aviso
{emAtraso && (
  <div className="bg-red-900/30 rounded-lg p-3 border border-red-700/50">
    <p className="text-red-400 font-medium">
      ⚠️ Atraso de {minutosAtraso} minutos
    </p>
    <p className="text-xs text-red-300/70 mt-1">
      Este tempo será acrescido à sua jornada de hoje.
    </p>
  </div>
)}
```

---

### Fluxo Visual Completo

```
┌───────────────────────────────────────────────────────────────────┐
│                    INÍCIO DO TURNO (08:00)                        │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│    [4h de trabalho] ────────────────────────────────> (12:00)    │
│                                                                   │
│    ⏰ 4h atingidas → Sistema inicia ALMOÇO AUTOMATICAMENTE        │
│                                                                   │
│    ┌────────────────────────────────────────────────────────┐    │
│    │  🍽️  OVERLAY DE ALMOÇO                                │    │
│    │       Contador: 60:00 → 00:00                         │    │
│    │                                                        │    │
│    │  Se atrasar:                                          │    │
│    │       Contador: -05:23 (atraso)                       │    │
│    │       ⚠️ "5 minutos serão acrescidos"                 │    │
│    └────────────────────────────────────────────────────────┘    │
│                                                                   │
│    [Fim do almoço] ─────────────────────────────────────> (13:05)│
│                                                                   │
│    📊 Atraso registrado: 5 minutos                               │
│                                                                   │
│    [4h + 5min de trabalho] ─────────────────────────> (17:10)    │
│                                                                   │
│    ✅ Jornada completa: 8h05min (inclui compensação)              │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

### Impacto na Interface

**JornadaStatusBar** - Mostrar informações de acréscimo:

```
┌──────────────────────────────────────────────────────────────────┐
│  ⏱️ 5h30min trabalhadas          🎯 2h35min restantes           │
│  [████████████████████░░░░░░░░░░░] 68%                          │
│                                                                  │
│  ⚠️ +5min de acréscimo por atraso no almoço                     │
└──────────────────────────────────────────────────────────────────┘
```

---

### Sequência de Implementação

1. **Migração SQL**: Adicionar coluna `minutos_atraso_almoco`
2. **Edge Function**: Adicionar verificação de almoço em `atribuir-proxima-tarefa`
3. **Hook**: Atualizar `useJornadaTrabalho` com lógica de atraso
4. **Overlay**: Mostrar contador negativo e aviso de atraso
5. **Status Bar**: Exibir acréscimo por atraso

---

### Resultado Esperado

| Cenário | Comportamento |
|---------|---------------|
| Trabalha 4h | Sistema inicia almoço automaticamente |
| Durante almoço (1h) | Overlay bloqueia interface, Edge Functions não atribuem |
| Volta pontual do almoço | Trabalha mais 4h normais |
| Volta 15min atrasado | Trabalha 4h15min (compensa atraso) |
| Volta 30min atrasado | Trabalha 4h30min (compensa atraso) |
