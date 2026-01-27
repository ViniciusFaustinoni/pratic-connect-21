

# Plano: Corrigir Contraste das Datas e Exibição dos Horários no AgendamentoBase

## Problemas Identificados

### 1. Baixo Contraste das Datas
Conforme a imagem fornecida, os números das datas (28, 29, 30, 31, 2) estão quase invisíveis no modo escuro. Isso ocorre porque:

- Os botões de data não selecionados não têm cor de texto explícita
- Os spans internos usam `opacity-70`, reduzindo ainda mais a visibilidade
- No fundo escuro (`bg: 214 63% 6%`), o texto herda branco mas fica muito tênue

### 2. Horários Não Aparecem Após Selecionar Data
O problema tem duas causas possíveis:

1. **Slots vazios**: A função `slotsHorario` retorna array vazio se `configBase?.base_horario_inicio` ou `configBase?.base_horario_fim` forem strings vazias
2. **Renderização vazia**: Se `slotsHorario.length === 0`, o grid é renderizado mas sem nenhum botão, aparentando não funcionar

## Arquitetura da Correção

```text
┌────────────────────────────────────────────────────────────────────┐
│                ANTES (Problemas)                                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Botões de Data:                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                            │
│  │   28    │  │   29    │  │   30    │  ← Texto quase invisível   │
│  │  (0.7)  │  │  (0.7)  │  │  (0.7)  │    devido a opacity-70    │
│  └─────────┘  └─────────┘  └─────────┘                            │
│                                                                    │
│  Após clicar na data:                                             │
│  ┌────────────────────────────┐                                   │
│  │ Horários disponíveis...    │                                   │
│  │ ┌──────────────────────┐  │  ← Grid vazio!                     │
│  │ │                      │  │    slotsHorario = []               │
│  │ └──────────────────────┘  │                                    │
│  └────────────────────────────┘                                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                DEPOIS (Correções)                                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Botões de Data:                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                            │
│  │   28    │  │   29    │  │   30    │  ← Texto claro e legível   │
│  │  seg    │  │  ter    │  │  qua    │    com cores explícitas    │
│  │  jan    │  │  jan    │  │  jan    │                            │
│  └─────────┘  └─────────┘  └─────────┘                            │
│                                                                    │
│  Após clicar na data:                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Horários disponíveis para 28 de janeiro                    │   │
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                       │   │
│  │ │08:00 │ │08:30 │ │09:00 │ │09:30 │ ...                   │   │
│  │ └──────┘ └──────┘ └──────┘ └──────┘                       │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  OU (se não houver config):                                       │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ ⚠ Horários de atendimento não configurados.                │   │
│  │ Entre em contato para agendar.                              │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## Implementação

### Arquivo: `src/components/cotacao-publica/AgendamentoBase.tsx`

#### Correção 1: Melhorar Contraste dos Botões de Data

**Linhas 182-211**: Adicionar cores explícitas para melhor legibilidade no modo escuro.

```typescript
// ANTES (linha 192-196)
className={cn(
  "flex flex-col items-center p-2 rounded-lg border transition-all text-center",
  isSelected
    ? "bg-primary text-primary-foreground border-primary"
    : "hover:border-primary/50 hover:bg-muted/50"
)}

// DEPOIS - cores explícitas para estado não selecionado
className={cn(
  "flex flex-col items-center p-2 rounded-lg border transition-all text-center",
  isSelected
    ? "bg-primary text-primary-foreground border-primary"
    : "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-muted/50"
)}
```

**Linhas 199-206**: Remover `opacity-70` e usar cores semânticas.

```typescript
// ANTES
<span className="text-[10px] uppercase tracking-wide opacity-70">
  {format(dia, 'EEE', { locale: ptBR })}
</span>
<span className="text-lg font-semibold">
  {format(dia, 'd')}
</span>
<span className="text-[10px] opacity-70">
  {format(dia, 'MMM', { locale: ptBR })}
</span>

// DEPOIS - cores com bom contraste
<span className="text-[10px] uppercase tracking-wide text-muted-foreground">
  {format(dia, 'EEE', { locale: ptBR })}
</span>
<span className="text-lg font-semibold text-foreground">
  {format(dia, 'd')}
</span>
<span className="text-[10px] text-muted-foreground">
  {format(dia, 'MMM', { locale: ptBR })}
</span>
```

#### Correção 2: Exibir Mensagem Quando Não Há Horários

**Linhas 228-259**: Adicionar fallback para array vazio.

```typescript
// DEPOIS
{loadingHorarios ? (
  <div className="grid grid-cols-4 gap-2">
    {[...Array(8)].map((_, i) => (
      <Skeleton key={i} className="h-10 w-full" />
    ))}
  </div>
) : slotsHorario.length === 0 ? (
  // NOVO: Mensagem quando não há slots configurados
  <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
    <AlertDescription className="text-amber-700 dark:text-amber-300">
      Os horários de atendimento não estão configurados. 
      Entre em contato para agendar sua vistoria.
    </AlertDescription>
  </Alert>
) : (
  <div className="grid grid-cols-4 gap-2">
    {slotsHorario.map((horario) => ...)}
  </div>
)}
```

#### Correção 3: Garantir Valores Default no Hook

**Arquivo**: `src/hooks/useAgendamentoBase.ts` (opcional)

Garantir que o hook sempre retorne valores válidos:

```typescript
// Na linha 68-69, verificar se o valor não é string vazia
base_horario_inicio: config.base_horario_inicio?.trim() || '08:00',
base_horario_fim: config.base_horario_fim?.trim() || '17:30',
```

## Resumo das Alterações

| Arquivo | Alteração | Impacto |
|---------|-----------|---------|
| `AgendamentoBase.tsx` | Adicionar `bg-card text-card-foreground` aos botões de data | Contraste legível no modo escuro |
| `AgendamentoBase.tsx` | Trocar `opacity-70` por `text-muted-foreground` | Texto sempre visível |
| `AgendamentoBase.tsx` | Adicionar fallback para `slotsHorario.length === 0` | Mensagem clara se não houver config |
| `useAgendamentoBase.ts` | Adicionar `.trim()` nos valores de horário | Evitar strings com espaços |

## Resultado Esperado

Após as correções:

1. **Datas**: Números claramente visíveis com bom contraste em ambos os modos (claro/escuro)
2. **Horários**: 
   - Se configurados: aparecem corretamente após selecionar data
   - Se não configurados: mensagem amigável orientando o cliente

