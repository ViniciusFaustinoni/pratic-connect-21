
## Plano: Implementar Disponibilidade Dinâmica de Períodos por Hora

### Contexto Atual

Seu sistema já possui:
- **Dois períodos** para vistorias presenciais: Manhã (08:00-12:00) e Tarde (14:00-18:00)
- **Limite de 10 vistorias por período por dia** (implementado na edge function `agendar-vistoria-presencial`)
- **Lógica de períodos por dia da semana**: Sábado exibe apenas Manhã, segunda a sexta exibem ambos
- **Dois fluxos de agendamento**: 
  - `AgendamentoVistoria.tsx` para vistoria presencial (contexto "presencial-direto")
  - `AgendarVistoria.tsx` para autovistoria (usa horários específicos legados)

### Observações do Usuário

✅ **10 vistorias por dia** = 10 por período (Manhã) + 10 por período (Tarde) = máximo 20/dia
✅ **Apenas períodos** (sem horários específicos) para vistoria presencial
✅ **Liberar por período levando em conta a hora atual** = Dinâmico baseado na hora local do browser

### Problema a Resolver

Atualmente, **ambos os períodos aparecem sempre**, independentemente da hora do dia. Se o usuário acessa às 15h, ainda vê "Manhã" como opção, quando deveria ver apenas "Tarde".

### Solução Proposta

Implementar função que **calcula dinamicamente quais períodos estão disponíveis baseado na hora atual**:

```
SE hora_atual < 14:00 (início da tarde):
  → Mostrar: Manhã E Tarde

SE hora_atual >= 14:00 (passou do horário de início da tarde):
  → Mostrar: Apenas Tarde (Manhã já expirou)

SE hora_atual >= 18:00 (passou do fim do expediente):
  → Mostrar: Nenhum período hoje
  → Cliente é direcionado para agendar a partir de amanhã
```

### Arquivos a Modificar

| Arquivo | Modificação | Detalhes |
|---------|-------------|----------|
| `src/data/autovistoriaConfig.ts` | Criar função `getPeriodosDisponivelsPorHora()` | Filtra períodos baseado na hora atual vs. `horarioInicio` do período |
| `src/components/cotacao-publica/AgendamentoVistoria.tsx` | Usar nova função ao renderizar períodos | Substitui `getPeriodosParaDia()` por lógica que também considera hora |
| `src/components/monitoramento/estoque/EnviarManutencaoModal.tsx` | Aplicar mesma lógica (manutenção também usa períodos) | Consistência entre fluxos |

---

### Detalhes de Implementação

#### 1. Criar Função em `autovistoriaConfig.ts`

```typescript
/**
 * Filtra períodos disponíveis baseado na hora ATUAL
 * Se for a MESMA data que hoje, bloqueia períodos que já expiraram
 * Se for uma data FUTURA, retorna todos os períodos do dia
 */
export const getPeriodosDisponivelsPorHora = (date: Date): PeriodoConfig[] => {
  const periodosDodia = getPeriodosParaDia(date); // Já filtra sábado
  
  // Se for uma data futura (não é hoje), retornar todos os períodos do dia
  const hoje = new Date();
  if (format(date, 'yyyy-MM-dd') !== format(hoje, 'yyyy-MM-dd')) {
    return periodosDodia;
  }
  
  // Se é hoje, filtrar períodos que ainda estão disponíveis
  const horaAgora = `${String(hoje.getHours()).padStart(2, '0')}:${String(hoje.getMinutes()).padStart(2, '0')}`;
  
  return periodosDodia.filter(periodo => {
    // Comparar horarioInicio do período com hora atual
    // Se 14:00 é horarioInicio da tarde e agora é 15:00, período não passa no filtro
    return periodo.horarioInicio > horaAgora;
  });
};
```

**Lógica:**
- Compara horário atual com `horarioInicio` de cada período
- Se período já começou, não é mais possível agendar
- Preserva a lógica de sábado (apenas manhã)

#### 2. Integração em `AgendamentoVistoria.tsx`

```typescript
// Linha ~105, substituir:
const periodosParaDataSelecionada = dataSelecionada 
  ? getPeriodosParaDia(dataSelecionada) // ← REMOVER
  ? getPeriodosDisponivelsPorHora(dataSelecionada) // ← USAR NOVA FUNÇÃO
  : PERIODOS_DISPONIVEIS;

// Linha ~111, também substituir:
const periodosDisponiveis = getPeriodosParaDia(dataSelecionada); // ← REMOVER
const periodosDisponiveis = getPeriodosDisponivelsPorHora(dataSelecionada); // ← USAR NOVA
```

**Comportamento visual:**
```
📱 Usuario acessa agendamento às 13:00 com data = hoje:
┌─────────────────────────────┐
│ Período (2 opções)           │
│ ☀️ Manhã (08:00-12:00)      │ ← Disponível
│ 🌅 Tarde (14:00-18:00)      │ ← Disponível
└─────────────────────────────┘

📱 Usuario acessa agendamento às 15:00 com data = hoje:
┌─────────────────────────────┐
│ Período (1 opção)            │
│ 🌅 Tarde (14:00-18:00)      │ ← Só this
│                             │
│ ⚠️ A manhã já expirou       │
└─────────────────────────────┘

📱 Usuario acessa agendamento às 18:30 com data = hoje:
┌─────────────────────────────┐
│ ⚠️ Nenhum período disponível  │
│    para hoje                 │
│                             │
│ Selecione uma data futura   │
│ para prosseguir             │
└─────────────────────────────┘

📱 Usuario acessa agendamento às 15:00 com data = amanhã:
┌─────────────────────────────┐
│ Período (2 opções)           │
│ ☀️ Manhã (08:00-12:00)      │ ← Ambos disponíveis
│ 🌅 Tarde (14:00-18:00)      │ ← (data futura)
└─────────────────────────────┘
```

#### 3. Fluxo de Alertas (Optional Enhancement)

Se nenhum período estiver disponível para hoje:
```typescript
if (dataSelecionada && format(dataSelecionada, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
  const periodosDisp = getPeriodosDisponivelsPorHora(dataSelecionada);
  if (periodosDisp.length === 0) {
    // Mostrar alerta e resetar data para amanhã
    toast.info('Todos os períodos de hoje já expiraram. Agende para amanhã.');
    setDataSelecionada(addDays(new Date(), 1));
  }
}
```

#### 4. Aplicar em `EnviarManutencaoModal.tsx` (Consistência)

Mesma substituição de função:
```typescript
const periodosDisponiveis = useMemo(() => {
  if (!dataSelecionada) return PERIODOS_DISPONIVEIS;
  return getPeriodosDisponivelsPorHora(dataSelecionada); // ← Usar nova função
}, [dataSelecionada]);
```

---

### Casos Especiais Tratados

| Caso | Comportamento |
|------|--------------|
| **Sábado 08:00** | Exibe apenas Manhã ✅ |
| **Sábado 14:00** | Exibe nada (Manhã expirou, Tarde não existe no sábado) |
| **Segunda 13:59** | Exibe ambos (Tarde começa 14:00) |
| **Segunda 14:00** | Exibe apenas Tarde |
| **Segunda 18:01** | Exibe nada para hoje |
| **Data futura** | Exibe todos os períodos disponíveis do dia |

---

### Impacto

✅ **UX melhorada**: Cliente não vê períodos expirados
✅ **Lógica coerente**: Impossível agendar para período que já começou
✅ **Consistente**: Mesma lógica em vistoria presencial e manutenção
✅ **Zero breaking changes**: Código anterior continua funcionando

