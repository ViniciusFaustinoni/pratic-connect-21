## Objetivo

Remover "Noite" como opção selecionável de período em todo o sistema. O usuário só poderá criar/editar registros com **manhã** ou **tarde**. Registros legados continuam exibindo "Noite" via `formatPeriodoLabel` para não quebrar histórico.

---

## Comportamento esperado após o ajuste

- **Formulários (Instalação, Vistoria, Reagendamento, Edição)**: dropdown só lista Manhã e Tarde. Tentar enviar `noite` falha na validação Zod.
- **Calendários e filtros de monitoramento**: deixam de exibir a coluna/aba/checkbox Noite. Registros legados que tenham `periodo='noite'` ou horário ≥18h continuam visíveis, agrupados em **Tarde** (fallback).
- **Cards e listas**: ícone 🌙/Moon e label "Noite" só aparecem se o registro vier do banco com valor legado — UI nova nunca produz isso.
- **Saudação "Boa noite"** no Dashboard e telas de instalador/cadastro permanece (não tem relação com período de agendamento).
- **Banco de dados**: nenhuma alteração de schema ou enum. Dados existentes ficam preservados.

---

## Arquivos a alterar

### 1. Tipos canônicos (definição de fonte de verdade)
- **`src/types/monitoramento.ts`** (L18, L33): tipo `PeriodoInstalacao` passa a `'manha' | 'tarde'`; remover `noite` do label map.
- **`src/types/database.ts`** (L178, L693, L749): mesmo ajuste em `PeriodoInstalacao` e nas duas constantes de label.
- **`src/lib/periodo-utils.ts`**:
  - `PERIODO_INICIO`, `PERIODO_LABEL`, `PERIODO_FAIXA`, `PeriodoCanonico`, `normalizePeriodo`, `periodoToTime`: tipos passam a `'manha' | 'tarde'` e removem chave `noite`.
  - `periodoFromHora`: horários ≥18h passam a retornar `'tarde'` (não mais `'noite'`).
  - `formatPeriodoLabel`: **mantém** suporte a `noite`/HH:MM≥18 retornando "Noite" — necessário para legacy.
- **`src/hooks/useServicos.ts`** (L35, L259): `PeriodoServico` passa a `'manha' | 'tarde'`; remover label `noite`.

### 2. Formulários (validação)
- **`src/components/instalacoes/InstalacaoFormDialog.tsx`** (L52): `z.enum(['manha', 'tarde'])`. Remover `<SelectItem value="noite">` se presente.
- **`src/pages/monitoramento/InstalacaoDetalhe.tsx`** (L729): remover `<SelectItem value="noite">Noite (18h-21h)</SelectItem>` do dropdown de edição.

### 3. Calendário e filtros de monitoramento
- **`src/pages/monitoramento/CalendarioInstalacoes.tsx`** (L146-L420): remover bucket `noite` do agrupamento. No loop de classificação (L157), tratar registros legados com `periodo='noite'` como `tarde` (fallback de visualização). Remover a coluna/render `🌙 Noite`.
- **`src/components/monitoramento/CalendarioDiaModal.tsx`** (L385-L396): remover `noite: []` do agrupamento e do meta-objeto de labels. Legados caem em `tarde`.
- **`src/components/monitoramento/InstalacaoFilters.tsx`** (L77): remover `{ value: 'noite', label: 'Noite (18h-22h)' }` da lista de opções.

### 4. Cards de listas (somente legado)
Os arquivos abaixo mantêm a entrada `noite` apenas como dicionário de tradução para não quebrar render de registros antigos. Decisão: **manter** as entradas de label/ícone mas **não** as expor em formulários. Nenhuma mudança necessária:
- `src/components/instalador/InstalacaoCard.tsx`
- `src/components/rotas/InstalacaoMiniCard.tsx`
- `src/components/rotas/VistoriaMiniCard.tsx`
- `src/components/vistoriador/EncaixeCard.tsx`
- `src/pages/Dashboard.tsx` (L567)

### 5. Geração de link/contrato (entrada externa)
- **`src/hooks/useContratoLink.ts`** (L750-L785): a função normaliza o período recebido do payload. Passa a converter `noite` → `tarde` (ao invés de manter `noite`), garantindo que novos contratos nunca sejam gerados com período `noite`.
- **`src/hooks/useAlterarEnderecoTipo.ts`** (L100-L106): mesma normalização — `noite` recebido vira `tarde`.

### 6. Cron de reagendamento (não alterar)
- **`supabase/functions/cron-reagendamento-automatico/index.ts`** (L289): `cutoffPeriodo.noite = '21:15'` permanece. Garante que registros legados ainda sejam processados corretamente pelo cron até serem encerrados naturalmente.

### 7. Não tocar
- `src/pages/Dashboard.tsx` L164, `src/pages/instalador/InstaladorHome.tsx` L111, `src/components/cadastro/DashboardCadastro.tsx` L82: string "Boa noite" é saudação por hora do dia, sem relação com período.
- `src/pages/app/AppConfiguracoes.tsx` L490 (`noturno`): preferência de notificação, não é período de agendamento.
- `src/integrations/supabase/types.ts`: gerado automaticamente, não editar manualmente.

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Registros legados com `periodo='noite'` sumiriam do calendário | `CalendarioInstalacoes` e `CalendarioDiaModal` aplicam fallback visual: legados aparecem na coluna **Tarde**. |
| `formatPeriodoLabel` ainda devolve "Noite" para legados, gerando UI inconsistente em listas | Aceito como trade-off — a alternativa seria reescrever `noite`→`tarde` em massa no banco, o que apaga a verdade histórica. |
| Cron processa cutoff `21:15` para legados | Mantido; sem impacto em novos registros (que nunca terão `noite`). |
| Edge functions / payloads externos enviarem `noite` | Os hooks `useContratoLink` e `useAlterarEnderecoTipo` passam a normalizar para `tarde` antes de gravar. |

---

## Validação pós-implementação

1. Abrir `InstalacaoFormDialog` e confirmar que o select só mostra Manhã e Tarde.
2. Editar uma instalação em `/monitoramento/instalacao/:id` e confirmar a remoção da opção Noite.
3. Abrir `/monitoramento/calendario` e confirmar que só existem 2 colunas por dia (Manhã/Tarde).
4. Verificar via console que registros antigos com `periodo='noite'` aparecem na coluna Tarde do calendário.
5. Confirmar que o caso da MARLI SILVA (KWX4D43) continua visível (cai em Tarde) ou pode ser reagendado normalmente para Manhã/Tarde.

Pronto para aprovação.