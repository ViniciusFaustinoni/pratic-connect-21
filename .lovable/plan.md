
# Plano: Restrição de Início de Instalação por Horário Agendado

## Resumo do Problema

Atualmente, o sistema possui validação parcial para o horário agendado:

1. **Na atribuição** (Edge Function): Bloqueia atribuição de serviços de hoje antes do horário (exceto encaixes)
2. **No início de rota** (Hook): Valida horário antes de iniciar, mas a UI não mostra feedback adequado

**Problema identificado**: O botão "Iniciar Rota" aparece habilitado mesmo quando o horário não foi atingido, e o usuário só descobre que não pode iniciar ao clicar (recebe erro). Além disso, a RPC não retorna o campo `permite_encaixe`.

## Requisitos de Negócio

| Cenário | Comportamento Esperado |
|---------|------------------------|
| Tarefa **SEM encaixe** | Só pode iniciar no horário exato agendado ou após |
| Tarefa **COM encaixe** | Pode iniciar a qualquer momento (antecipação permitida) |
| Tarefa atribuída manualmente pelo coordenador | Mesmas regras acima se aplicam |

## Solução Proposta

### Parte 1: Atualizar RPC para retornar `permite_encaixe`

A RPC `buscar_tarefa_atual_profissional` precisa retornar o campo `permite_encaixe` para que a UI possa mostrar feedback adequado.

**Alteração na RPC:**
```sql
CREATE OR REPLACE FUNCTION public.buscar_tarefa_atual_profissional(p_profissional_id uuid)
 RETURNS TABLE(
   -- ... campos existentes ...
   permite_encaixe boolean  -- NOVO CAMPO
 )
```

### Parte 2: Atualizar Hook para receber o campo

O hook `useTarefaAtual` precisa incluir o novo campo no tipo e no retorno.

### Parte 3: Bloquear botão "Iniciar Rota" na UI

No componente `TarefaAtualCard.tsx`, verificar se o horário agendado já foi atingido antes de habilitar o botão:

```tsx
// Verificar se pode iniciar rota (horário respeitado)
const podeIniciarRota = useMemo(() => {
  // Se não é hoje, pode iniciar
  const hoje = new Date().toISOString().split('T')[0];
  if (tarefa.data_agendada !== hoje) return true;
  
  // Se é encaixe, pode iniciar
  if (tarefa.permite_encaixe) return true;
  
  // Se não tem hora específica, pode iniciar
  if (!tarefa.hora_agendada) return true;
  
  // Verificar se hora atual >= hora agendada
  const horaAtual = new Date().toTimeString().slice(0, 5);
  return horaAtual >= tarefa.hora_agendada;
}, [tarefa.data_agendada, tarefa.hora_agendada, tarefa.permite_encaixe]);
```

### Parte 4: Feedback visual ao usuário

Quando o botão estiver desabilitado, mostrar mensagem explicativa:

```tsx
{!podeIniciarRota && (
  <div className="text-sm text-amber-600 flex items-center gap-1">
    <Clock className="h-3 w-3" />
    Disponível às {tarefa.hora_agendada?.slice(0, 5)}
  </div>
)}
```

### Parte 5: Atualização em tempo real do botão

Usar um efeito para atualizar o estado a cada minuto, permitindo que o botão seja habilitado automaticamente quando o horário chegar.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migração SQL | Atualizar RPC para retornar `permite_encaixe` |
| `src/hooks/useTarefaAtual.ts` | Adicionar campo `permite_encaixe` ao tipo `TarefaAtual` |
| `src/hooks/useServicos.ts` | Atualizar tipo `TarefaAtual` com `permite_encaixe` |
| `src/components/vistoriador/TarefaAtualCard.tsx` | Lógica de bloqueio e feedback visual |

## Detalhes Técnicos

### Migração SQL

```sql
-- Atualizar RPC para incluir campo permite_encaixe
CREATE OR REPLACE FUNCTION public.buscar_tarefa_atual_profissional(p_profissional_id uuid)
 RETURNS TABLE(
   id uuid, tipo text, status text, data_agendada date, hora_agendada time,
   periodo text, associado_id uuid, associado_nome text, associado_telefone text,
   associado_whatsapp text, veiculo_id uuid, veiculo_placa text, veiculo_marca text,
   veiculo_modelo text, veiculo_cor text, logradouro text, numero text, bairro text,
   cidade text, uf text, cep text, latitude numeric, longitude numeric,
   cotacao_id uuid, contrato_id uuid, rastreador_id uuid, imei_rastreador text,
   local_vistoria text, observacoes text, rota_id uuid, iniciada_em timestamptz,
   em_rota_em timestamptz, instalacao_origem_id uuid, vistoria_origem_id uuid,
   confirmacao_whatsapp text, confirmado_via_whatsapp_em timestamptz,
   permite_encaixe boolean  -- NOVO
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    -- ... campos existentes ...
    COALESCE(s.permite_encaixe, false)::boolean AS permite_encaixe  -- NOVO
  FROM servicos s
  -- ... resto igual ...
END;
$function$;
```

### Lógica no TarefaAtualCard

```tsx
// Estado para forçar re-render a cada minuto
const [agora, setAgora] = useState(new Date());

useEffect(() => {
  const interval = setInterval(() => setAgora(new Date()), 60000);
  return () => clearInterval(interval);
}, []);

// Calcular se pode iniciar
const podeIniciarPorHorario = useMemo(() => {
  const hoje = agora.toISOString().split('T')[0];
  
  // Não é de hoje = pode iniciar
  if (tarefa.data_agendada !== hoje) return true;
  
  // É encaixe = pode iniciar
  if ((tarefa as any).permite_encaixe) return true;
  
  // Sem hora específica = pode iniciar
  if (!tarefa.hora_agendada) return true;
  
  // Verificar horário
  const horaAtual = agora.toTimeString().slice(0, 5);
  return horaAtual >= tarefa.hora_agendada;
}, [agora, tarefa.data_agendada, tarefa.hora_agendada, (tarefa as any).permite_encaixe]);

// Tempo restante para habilitar
const tempoRestante = useMemo(() => {
  if (podeIniciarPorHorario || !tarefa.hora_agendada) return null;
  
  const [h, m] = tarefa.hora_agendada.split(':').map(Number);
  const horaAgendada = new Date(agora);
  horaAgendada.setHours(h, m, 0, 0);
  
  const diff = horaAgendada.getTime() - agora.getTime();
  if (diff <= 0) return null;
  
  const minutos = Math.ceil(diff / 60000);
  return minutos;
}, [agora, tarefa.hora_agendada, podeIniciarPorHorario]);
```

## Fluxo Visual Final

```text
┌─────────────────────────────────────────────────────────────────┐
│  TAREFA SEM ENCAIXE - Agendada para 14:00                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Hora Atual: 13:45                                              │
│                                                                 │
│  [Botão Iniciar Rota] ← DESABILITADO                           │
│  ⏰ Disponível em 15 minutos (14:00)                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TAREFA SEM ENCAIXE - Agendada para 14:00                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Hora Atual: 14:00                                              │
│                                                                 │
│  [Iniciar Rota] ← HABILITADO                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TAREFA COM ENCAIXE ⚡ - Originalmente 16:00                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Hora Atual: 13:45                                              │
│                                                                 │
│  [Iniciar Rota] ← HABILITADO (encaixe permite início antecipado)│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Benefícios

1. **Cumprimento do horário** - Clientes que não aceitaram encaixe terão o horário respeitado
2. **Feedback claro** - Profissional sabe exatamente quando poderá iniciar
3. **Atualização automática** - Botão habilita sozinho quando o horário chega
4. **Flexibilidade mantida** - Encaixes continuam podendo ser antecipados
