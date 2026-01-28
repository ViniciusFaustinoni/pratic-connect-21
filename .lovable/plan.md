

# Plano: Regras de Atribuicao e Inicio de Vistorias com Restricao de Horario

## Resumo do Requisito

Implementar restricoes para evitar que vistorias sem marcacao de "encaixe" sejam atribuidas ou iniciadas antes do horario agendado.

**Regras:**
1. Servicos **sem** `permite_encaixe = true` nao podem ser atribuidos antes do horario agendado
2. Servicos **com** `permite_encaixe = true` podem ser antecipados livremente
3. A validacao deve ocorrer tanto na atribuicao automatica (cron) quanto manual (edge function)

## Arquitetura Atual

O sistema possui dois fluxos de atribuicao:

```text
+---------------------------+     +---------------------------+
|  atribuir-proxima-tarefa  |     |   cron-atribuir-tarefas   |
|      (Edge Function)      |     |      (Edge Function)      |
|  Chamada pelo app PWA     |     |   Execucao periodica      |
+------------+--------------+     +------------+--------------+
             |                                 |
             +------------+--------------------+
                          |
                          v
               +---------------------+
               |   Tabela servicos   |
               |  (fonte da verdade) |
               +---------------------+
```

## Pontos de Intervencao

### 1. Edge Function `atribuir-proxima-tarefa`

**Arquivo:** `supabase/functions/atribuir-proxima-tarefa/index.ts`

**Alteracao:** Adicionar filtro na busca de servicos normais (hoje/amanha) para excluir servicos que ainda nao chegaram no horario agendado.

**Logica:**
```typescript
// Funcao para verificar se servico pode ser atribuido
function podeSerAtribuido(servico: any, agora: Date): boolean {
  const hojeStr = agora.toISOString().split('T')[0];
  
  // Encaixes podem ser atribuidos a qualquer momento
  if (servico.permite_encaixe) return true;
  
  // Servicos de datas futuras (amanha) podem ser atribuidos normalmente
  if (servico.data_agendada > hojeStr) return true;
  
  // Servicos de HOJE: verificar horario
  if (servico.data_agendada === hojeStr && servico.hora_agendada) {
    const horaAtual = agora.toTimeString().slice(0, 5); // "HH:MM"
    return horaAtual >= servico.hora_agendada;
  }
  
  // Sem hora especifica, pode ser atribuido
  return true;
}
```

**Local de aplicacao:** Apos buscar os servicos, filtrar usando esta funcao antes de calcular distancias.

### 2. Edge Function `cron-atribuir-tarefas`

**Arquivo:** `supabase/functions/cron-atribuir-tarefas/index.ts`

**Alteracao:** Aplicar a mesma logica de validacao de horario na busca e filtragem de servicos.

**Impacto:** O cron nao atribuira automaticamente servicos cujo horario agendado ainda nao chegou (exceto encaixes).

### 3. Validacao no Frontend (Opcional - Camada Extra)

**Arquivo:** `src/hooks/useTarefaAtual.ts`

**Alteracao:** Adicionar validacao nos hooks `useIniciarRota` e `useIniciarTarefa` para impedir inicio antes do horario.

Esta e uma camada de seguranca adicional, pois a validacao principal ocorre no backend.

## Alteracoes Detalhadas

### Edge Function `atribuir-proxima-tarefa`

**Adicionar funcao auxiliar (apos linha 30):**
```typescript
/**
 * Verifica se um servico pode ser atribuido no momento atual
 * Servicos com permite_encaixe = true podem ser atribuidos a qualquer momento
 * Servicos normais de HOJE so podem ser atribuidos apos o hora_agendada
 */
function podeSerAtribuido(
  servico: { data_agendada: string; hora_agendada: string | null; permite_encaixe: boolean },
  agora: Date,
  hojeStr: string
): boolean {
  // Encaixes podem ser atribuidos livremente
  if (servico.permite_encaixe) return true;
  
  // Servicos de datas futuras podem ser atribuidos (amanha)
  if (servico.data_agendada > hojeStr) return true;
  
  // Servicos de HOJE com hora especifica
  if (servico.data_agendada === hojeStr && servico.hora_agendada) {
    const horaAtual = agora.toTimeString().slice(0, 5);
    return horaAtual >= servico.hora_agendada;
  }
  
  // Sem hora especifica = pode ser atribuido
  return true;
}
```

**Modificar filtragem de servicos (apos linha 370):**
```typescript
// NOVO: Filtrar servicos que ainda nao podem ser atribuidos (horario futuro)
const agora = new Date();
const servicosFiltradosPorHorario = servicosDisponiveis.filter(s => 
  podeSerAtribuido(s, agora, hoje)
);

console.log(`[atribuir-proxima-tarefa] ${servicosFiltradosPorHorario.length} servicos apos filtro de horario`);
```

### Edge Function `cron-atribuir-tarefas`

**Adicionar mesma funcao auxiliar e aplicar filtro similar.**

### Validacao Frontend (Hook)

**Arquivo:** `src/hooks/useTarefaAtual.ts` - `useIniciarRota`

```typescript
// Validar horario antes de iniciar
const hojeStr = new Date().toISOString().split('T')[0];
const horaAtual = new Date().toTimeString().slice(0, 5);

// Buscar dados do servico
const { data: servico } = await supabase
  .from('servicos')
  .select('data_agendada, hora_agendada, permite_encaixe')
  .eq('id', tarefaId)
  .single();

// Bloquear inicio antes do horario (se nao for encaixe)
if (
  servico &&
  !servico.permite_encaixe &&
  servico.data_agendada === hojeStr &&
  servico.hora_agendada &&
  horaAtual < servico.hora_agendada
) {
  throw new Error(`Servico agendado para ${servico.hora_agendada}. Aguarde o horario.`);
}
```

## Resumo de Arquivos a Modificar

| Arquivo | Tipo de Alteracao |
|---------|-------------------|
| `supabase/functions/atribuir-proxima-tarefa/index.ts` | Adicionar funcao `podeSerAtribuido` e filtro |
| `supabase/functions/cron-atribuir-tarefas/index.ts` | Adicionar funcao `podeSerAtribuido` e filtro |
| `src/hooks/useTarefaAtual.ts` | Adicionar validacao de horario em `useIniciarRota` |

## Comportamento Esperado

### Antes da Alteracao

| Situacao | Comportamento |
|----------|---------------|
| Servico agendado para 14:00 (agora 10:00) | Atribuido normalmente |
| Servico com encaixe agendado para amanha | Atribuido como encaixe |

### Depois da Alteracao

| Situacao | Comportamento |
|----------|---------------|
| Servico agendado para 14:00 (agora 10:00) sem encaixe | **BLOQUEADO** - aguardar 14:00 |
| Servico agendado para 14:00 (agora 10:00) com encaixe | Atribuido como encaixe |
| Servico agendado para amanha sem encaixe | Atribuido normalmente (amanha) |

## Consideracoes Tecnicas

### Timezone

- O sistema usa hora local do servidor (UTC-3 para Brasil)
- A funcao `toTimeString()` retorna hora local
- Consistencia mantida entre frontend e backend

### Log de Debug

Os filtros serao logados para facilitar debugging:
```
[atribuir-proxima-tarefa] 5 servicos disponiveis no total
[atribuir-proxima-tarefa] 3 servicos apos filtro de horario (2 bloqueados por horario futuro)
```

### Margem de Tolerancia (Opcional)

Podemos adicionar 15 minutos de antecedencia como tolerancia:
```typescript
// Permitir 15 min antes do horario
const horaPermitida = new Date(agora.getTime() + 15 * 60 * 1000).toTimeString().slice(0, 5);
return horaPermitida >= servico.hora_agendada;
```

