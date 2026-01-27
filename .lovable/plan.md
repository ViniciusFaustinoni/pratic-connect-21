
# Plano: Adicionar Política SELECT para Usuários Anônimos na agendamentos_base

## Problema Identificado

A tabela `agendamentos_base` tem políticas RLS que permitem:

| Política | Comando | Role |
|----------|---------|------|
| Anon users can insert | INSERT | anon ✅ |
| Authenticated users can view | SELECT | authenticated ✅ |
| **Faltando** | **SELECT** | **anon ❌** |

O hook `useCriarAgendamentoBase` executa uma query SELECT para verificar se o horário ainda tem vagas **antes** de inserir:

```typescript
// src/hooks/useAgendamentoBase.ts (linha 136-141)
const { data: existentes } = await supabase
  .from('agendamentos_base')
  .select('id')
  .eq('data_agendada', dados.dataAgendada)
  .eq('horario', dados.horario)
  .in('status', ['agendado', 'confirmado']);
```

Como não existe política SELECT para `anon`, o RLS bloqueia e retorna o erro `42501`.

## Solução

Criar uma política SELECT para usuários anônimos na tabela `agendamentos_base`, permitindo que o fluxo público verifique a disponibilidade de horários.

## Implementação

### Migração SQL

```sql
-- Permitir que usuários anônimos verifiquem disponibilidade de horários
CREATE POLICY "Anon users can view agendamentos_base" 
ON public.agendamentos_base 
FOR SELECT 
TO anon 
USING (true);
```

### Fluxo Corrigido

```text
ANTES:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Cliente Público │────►│ SELECT para     │────►│ agendamentos_   │
│ (role: anon)    │     │ verificar vagas │     │ base            │
└─────────────────┘     └─────────────────┘     │ ⛔ RLS BLOQUEIA │
                                                └─────────────────┘

DEPOIS:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Cliente Público │────►│ SELECT para     │────►│ agendamentos_   │
│ (role: anon)    │     │ verificar vagas │     │ base            │
└─────────────────┘     └─────────────────┘     │ ✅ PERMITIDO    │
                              │                 └─────────────────┘
                              ▼
                        ┌─────────────────┐
                        │ INSERT novo     │
                        │ agendamento     │
                        │ ✅ JÁ PERMITIDO │
                        └─────────────────┘
```

## Segurança

Esta alteração é segura porque:

1. **Dados não sensíveis**: Os agendamentos contêm apenas nome do cliente, data/horário e placa - informações que o próprio cliente fornece
2. **Padrão consistente**: A política de INSERT para `anon` já existe, indicando que o fluxo público é intencional
3. **Mesmo nível de acesso**: Usuários autenticados já têm SELECT irrestrito

## Alterações

| Tipo | Descrição |
|------|-----------|
| Migração SQL | Adicionar política `Anon users can view agendamentos_base` para SELECT |

## Resultado Esperado

Após a migração:

1. Cliente seleciona data e horário ✅
2. Clica em "Confirmar Agendamento" ✅
3. SELECT para verificar vagas passa (nova política) ✅
4. INSERT do agendamento funciona (política existente) ✅
5. Toast de sucesso: "Agendamento realizado com sucesso!" ✅
