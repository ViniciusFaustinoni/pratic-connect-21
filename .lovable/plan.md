
## Diagnóstico

No popup do mapa aparece "Agendada: 16/04/2026" mas a vistoria foi agendada para **17/04/2026** (sexta-feira), conforme tela de confirmação mostrada ao cliente.

### Causa provável

Bug clássico de **timezone**: a data vem do banco como string `2026-04-17` (DATE puro, sem hora), mas em algum ponto está sendo convertida via `new Date("2026-04-17")` que o JavaScript interpreta como **UTC meia-noite**. Ao formatar no fuso de Brasília (UTC-3), volta como `2026-04-16 21:00`, exibindo dia 16.

### Investigação necessária

1. Localizar no `MapaVistoriasContent.tsx` onde a data agendada é formatada para o popup (provável `format(new Date(v.data_agendada), 'dd/MM/yyyy')`).
2. Conferir como o campo é exposto na query/hook que alimenta o mapa.
3. Verificar se o mesmo padrão ocorre em outros locais: card lateral, modal de confirmação, lista de "outras tarefas", toast de atribuição.

## Correção

### Helper utilitário
Criar/usar um formatador seguro para datas DATE puras:

```ts
// src/lib/date-utils.ts
export const formatDataAgendada = (data?: string | null) => {
  if (!data) return '';
  // Trata "YYYY-MM-DD" como data local, sem timezone
  const [y, m, d] = data.split('T')[0].split('-').map(Number);
  return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
};
```

Ou usar `parseISO` + `format` do `date-fns` apenas se a string contiver hora; para DATE puro, o split manual é mais confiável.

### Aplicar nos pontos afetados
Substituir todas as ocorrências de formatação direta de `data_agendada` (e variantes como `vistoria_data_agendada`, `agendado_para`) no:
- `src/components/mapa/MapaVistoriasContent.tsx` (popup, lista lateral, modais, toasts)
- Outros componentes onde o mesmo bug pode estar (calendário de monitoramento, lista de vistorias, cards de cotação) — busca dirigida por `new Date(.*data_agendada` e `format(.*data_agendada`.

## Não vou mexer

- Schema do banco / tipo da coluna (mantém `DATE`).
- Datas que já vêm como `timestamp` com hora (essas usam o fuso corretamente).
- Lógica de filtro por período no `useVistoriasEvento` (já usa `format(hoje, 'yyyy-MM-dd')` corretamente).

## Resultado

A vistoria da Kelly aparece como "Agendada: 17/04/2026" em todos os locais (popup, lista, modais), batendo com a data confirmada ao cliente. Bug de timezone fica blindado por helper centralizado.
