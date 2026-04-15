

## Plano: Incluir o dia de hoje na agenda presencial da base

### Problema
A linha 48 de `AgendamentoBase.tsx` usa `addDays(new Date(), 1)` -- sempre começa em **amanhã**, impedindo agendamentos para hoje. Para atendimento presencial na base, o associado deveria poder marcar para hoje caso ainda haja horários futuros disponíveis.

### Correção

**Arquivo: `src/components/cotacao-publica/AgendamentoBase.tsx`**

1. **Linha 48** -- Mudar para começar em `hoje` (offset 0):
```typescript
let currentDate = addDays(new Date(), weekOffset * 7); // Começa hoje
```

2. **Filtrar slots passados quando for hoje** (dentro de `slotsHorario`, linhas 61-88):
   - Após gerar os slots, se `dataSelecionada` for hoje, remover horários que já passaram (comparando com a hora atual de Brasilia + margem de 30min para preparação).

```typescript
// Após gerar slots[], filtrar horários passados se for hoje
const agora = new Date();
const isHoje = dataSelecionada && 
  format(dataSelecionada, 'yyyy-MM-dd') === format(agora, 'yyyy-MM-dd');

if (isHoje) {
  const horaAtual = agora.getHours();
  const minAtual = agora.getMinutes();
  // Filtrar slots que já passaram (margem de 30min)
  return slots.filter(slot => {
    const [h, m] = slot.split(':').map(Number);
    return (h * 60 + m) > (horaAtual * 60 + minAtual + 30);
  });
}
```

3. **Se todos os horários de hoje já expiraram**, esconder o dia ou exibir um indicador visual de "lotado/expirado" (similar ao que `AgendamentoVistoria.tsx` já faz na linha 406-410).

### Resultado
- Hoje aparece como primeira opção na agenda
- Apenas horários futuros (com 30min de margem) ficam selecionáveis
- Se não sobrou nenhum horário hoje, o dia aparece desabilitado com indicação clara

