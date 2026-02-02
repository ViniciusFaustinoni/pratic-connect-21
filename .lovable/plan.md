
# Plano: Ajustar Calendário de Instalações

## Contexto

A página de Calendário de Instalações (`/monitoramento/calendario`) precisa de ajustes:
1. **Remover** o botão "Agendar"
2. **Mostrar** todas as instalações independente do status
3. **Agrupar visualmente** as instalações por horário/período

## Alterações

### Arquivo: `src/pages/monitoramento/CalendarioInstalacoes.tsx`

#### 1. Remover botão "Agendar" (linhas 135-138)

Remover completamente o botão de agendamento do header:

```typescript
// ANTES
<div className="flex gap-2">
  <Button variant="outline" onClick={() => navigate('/monitoramento/instalacoes')}>
    Ver Lista
  </Button>
  <Button onClick={() => navigate('/monitoramento/instalacoes/agendar')}>
    <Plus className="mr-2 h-4 w-4" />
    Agendar
  </Button>
</div>

// DEPOIS
<Button variant="outline" onClick={() => navigate('/monitoramento/instalacoes')}>
  Ver Lista
</Button>
```

---

#### 2. Agrupar instalações por horário no useMemo (linhas 41-50)

Modificar a lógica para agrupar por período (manhã/tarde/noite):

```typescript
// Agrupar instalações por data E período
const instalacoesPorData = useMemo(() => {
  const map = new Map<string, { manha: typeof instalacoes; tarde: typeof instalacoes; noite: typeof instalacoes }>();
  
  instalacoes.forEach((inst) => {
    const dataStr = inst.data_agendada;
    if (!dataStr) return;
    
    if (!map.has(dataStr)) {
      map.set(dataStr, { manha: [], tarde: [], noite: [] });
    }
    
    const grupo = map.get(dataStr)!;
    const periodo = inst.periodo || 'manha';
    grupo[periodo as 'manha' | 'tarde' | 'noite'].push(inst);
  });
  
  return map;
}, [instalacoes]);
```

---

#### 3. Atualizar a renderização das células do calendário (linhas 178-226)

Exibir instalações separadas por período com labels visuais:

```typescript
{/* Instalações do dia - agrupadas por período */}
{temInstalacoes && (
  <div className="mt-1 space-y-1.5">
    {/* Manhã */}
    {instalacoesDia.manha.length > 0 && (
      <div className="space-y-0.5">
        <span className="text-[10px] text-muted-foreground font-medium">☀️ Manhã</span>
        {instalacoesDia.manha.slice(0, 2).map((inst) => (
          <Badge key={inst.id} variant="secondary" className={cn(...)}>
            {inst.veiculos?.placa || ...}
          </Badge>
        ))}
        {instalacoesDia.manha.length > 2 && (
          <span className="text-[10px] text-muted-foreground">+{instalacoesDia.manha.length - 2}</span>
        )}
      </div>
    )}
    
    {/* Tarde */}
    {instalacoesDia.tarde.length > 0 && (
      <div className="space-y-0.5">
        <span className="text-[10px] text-muted-foreground font-medium">🌅 Tarde</span>
        {/* Similar ao manhã */}
      </div>
    )}
    
    {/* Noite */}
    {instalacoesDia.noite.length > 0 && (
      <div className="space-y-0.5">
        <span className="text-[10px] text-muted-foreground font-medium">🌙 Noite</span>
        {/* Similar ao manhã */}
      </div>
    )}
  </div>
)}
```

---

## Resumo Visual

```text
┌─────────────────────────────────────────────────────────────┐
│  Calendário de Instalações          [Ver Lista]             │
│  Visualize as instalações agendadas por dia                 │
├─────────────────────────────────────────────────────────────┤
│    <   Fevereiro 2026   [Hoje]   >                          │
├──────┬──────┬──────┬──────┬──────┬──────┬──────────────────┤
│ Dom  │ Seg  │ Ter  │ Qua  │ Qui  │ Sex  │ Sáb              │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────────────┤
│      │  2   │      │      │      │      │                  │
│      │☀️Manhã│     │      │      │      │                  │
│      │QOO5C17│     │      │      │      │                  │
│      │      │      │      │      │      │                  │
│      │🌅Tarde│     │      │      │      │                  │
│      │ABC1234│     │      │      │      │                  │
└──────┴──────┴──────┴──────┴──────┴──────┴──────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/monitoramento/CalendarioInstalacoes.tsx` | Remover botão, agrupar por período, ajustar renderização |
