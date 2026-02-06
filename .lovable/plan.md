
## Plano: Limitar Datas de Agendamento para Hoje + 2 Dias

### Problema Identificado

Atualmente o sistema mostra **7 dias** disponíveis para agendamento de vistoria presencial (como visto na imagem: 6, 7, 9, 10, 11, 12, 13 de fevereiro). O usuário quer reduzir para mostrar apenas:
- **Hoje** (se houver períodos disponíveis)
- **Próximos 2 dias** (excluindo domingos)

### Localização do Código

**Arquivo:** `src/components/cotacao-publica/AgendamentoVistoria.tsx`
**Linhas:** 83-101

**Código atual:**
```typescript
// Gerar próximos 7 dias úteis (incluindo hoje se válido)
const hoje = new Date();
const datasDisponiveis: Date[] = [];

// Incluir hoje se não for domingo
if (!isDomingo(hoje)) {
  datasDisponiveis.push(hoje);
}

// Continuar com dias futuros até ter 7 datas
let dia = addDays(hoje, 1);
while (datasDisponiveis.length < 7) {
  if (!isDomingo(dia)) {
    datasDisponiveis.push(new Date(dia));
  }
  dia = addDays(dia, 1);
}
```

---

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/cotacao-publica/AgendamentoVistoria.tsx` | Alterar lógica para gerar apenas 3 datas (hoje + 2 dias futuros) |

---

### Alteração Proposta

**Linhas 83-101 - Alterar para:**

```typescript
// === LÓGICA DE DATAS ===
  
// Gerar hoje (se houver períodos) + próximos 2 dias úteis
const hoje = new Date();
const datasDisponiveis: Date[] = [];

// Incluir hoje se não for domingo E se ainda houver períodos disponíveis
if (!isDomingo(hoje)) {
  const periodosHoje = getPeriodosDisponivelsPorHora(hoje);
  if (periodosHoje.length > 0) {
    datasDisponiveis.push(hoje);
  }
}

// Continuar com dias futuros até ter no máximo 3 datas (hoje + 2 dias)
let dia = addDays(hoje, 1);
const maxDatas = 3;
while (datasDisponiveis.length < maxDatas) {
  if (!isDomingo(dia)) {
    datasDisponiveis.push(new Date(dia));
  }
  dia = addDays(dia, 1);
}
```

---

### Comparativo Visual

```
ANTES (7 dias):
┌───────────────────────────────────────────────────────────────────────────────┐
│  [6 fev] [7 fev] [9 fev] [10 fev] [11 fev] [12 fev] [13 fev]                  │
│   sexta   sábado segunda  terça    quarta   quinta   sexta                    │
└───────────────────────────────────────────────────────────────────────────────┘

DEPOIS (3 dias - hoje + 2):
┌─────────────────────────────────────────┐
│  [6 fev]  [7 fev]  [9 fev]              │
│   sexta    sábado   segunda             │
│   (hoje)                                │
└─────────────────────────────────────────┘
```

---

### Lógica de Verificação

1. **Hoje é domingo?**
   - Sim: Não mostra hoje (inicia pelo próximo dia)
   - Não: Verifica se há períodos disponíveis

2. **Hoje tem períodos disponíveis?** (usando `getPeriodosDisponivelsPorHora`)
   - Sim: Inclui hoje na lista
   - Não: Não inclui (ex: já são 18h e não há mais períodos)

3. **Completar com próximos dias até ter 3 datas**
   - Pula domingos automaticamente

---

### Resultado Esperado

| Cenário | Datas Mostradas |
|---------|-----------------|
| Sexta 06/02 às 10h (manhã disponível) | [6, 7, 9] |
| Sexta 06/02 às 14h (só tarde disponível) | [6, 7, 9] |
| Sexta 06/02 às 19h (sem períodos) | [7, 9, 10] |
| Sábado 07/02 às 10h (manhã OK) | [7, 9, 10] |
| Sábado 07/02 às 13h (sem períodos) | [9, 10, 11] |
| Domingo 08/02 (sempre fechado) | [9, 10, 11] |

A mudança garante um agendamento mais focado em datas próximas, facilitando a logística da equipe de vistoriadores.
