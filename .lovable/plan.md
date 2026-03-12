

# Corrigir lógica de elegibilidade: veículos fora da lista devem ser aceitos

## Problema encontrado

Há um **bug crítico** na linha 196 de `usePlanosCotacao.ts`:

```typescript
if (!regra) return 'negado';
```

Quando um plano tem regras de elegibilidade configuradas mas o veículo específico **não está na lista**, o sistema retorna "negado" e **oculta o plano**. Isso é o oposto do que o usuário precisa: veículos fora da lista devem ser **aceitos**.

A lista de elegibilidade é usada apenas para registrar exceções (veículos negados ou com limitação). Se o veículo não aparece em nenhuma regra, ele passa normalmente.

## Mudanças

### 1. Corrigir `verificarElegibilidadeModelo` em `src/hooks/usePlanosCotacao.ts`

**Linha 196**: Trocar `return 'negado'` por `return 'aprovado'`

Lógica corrigida:
- Plano sem regras → `'aprovado'` (já funciona)
- Veículo não encontrado nas regras do plano → `'aprovado'` (FIX)
- Veículo encontrado com status `'negado'` → `'negado'` (oculta plano)
- Veículo encontrado com status `'limitado'` → `'limitado'` (mostra badge de restrição)

### 2. Alerta visível para planos limitados (já existe, sem alteração necessária)

O badge "Aceitação com restrições" já aparece nos cards de plano (`PlanoCardCotacao.tsx` e `CotacaoFormDialog.tsx`). Nenhuma mudança necessária nesta parte.

## Impacto

Uma única linha alterada. Todos os veículos que não estiverem explicitamente cadastrados na aba de Elegibilidade passarão a ser aceitos normalmente, e apenas veículos com regra explícita de "negado" ou "limitado" terão tratamento diferenciado.

