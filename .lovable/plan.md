
# Corrigir exibicao de horario com timezone incorreto

## Problema

O horario da ocorrencia esta sendo exibido 3 horas a menos do que o informado pelo associado. Exemplo: o associado informou 06:00, mas o card mostra 03:00.

## Causa raiz

Na edge function `criar-sinistro`, linha 500, o horario e salvo assim:

```text
"2026-02-17T06:00:00"  (sem indicador de timezone)
```

O Postgres interpreta como UTC (porque a coluna e `timestamptz`). Quando o navegador em Brasilia (UTC-3) exibe esse valor, subtrai 3 horas: 06:00 UTC vira 03:00 BRT.

O horario deveria ter sido salvo como:

```text
"2026-02-17T06:00:00-03:00"  (horario de Brasilia)
```

## Solucao

### 1. Corrigir a edge function `criar-sinistro`

Adicionar o offset de Brasilia (-03:00) ao montar a data/hora na linha 500:

**Antes:**
```text
dataHoraOcorrencia = `${ano}-${mes}-${dia}T${payload.hora_evento}:00`;
```

**Depois:**
```text
dataHoraOcorrencia = `${ano}-${mes}-${dia}T${payload.hora_evento}:00-03:00`;
```

Isso garante que o Postgres armazene o horario corretamente como UTC (09:00 UTC para 06:00 BRT), e o navegador em Brasilia exibira 06:00 corretamente.

### 2. Corrigir o sinistro existente no banco

O SIN-20260217-0008 tem `data_ocorrencia = 2026-02-17 06:00:00+00` que deveria ser `2026-02-17 09:00:00+00` (06:00 BRT = 09:00 UTC):

```text
UPDATE sinistros SET data_ocorrencia = '2026-02-17T06:00:00-03:00' WHERE protocolo = 'SIN-20260217-0008';
```

### 3. Verificar e corrigir o formatDateTime no frontend

A funcao `formatDateTime` em `SinistroDetalhe.tsx` (linha 142) ja usa `new Date()` que respeita timezone, entao apos a correcao no backend ela exibira o horario correto automaticamente.

## Arquivos alterados

1. **`supabase/functions/criar-sinistro/index.ts`** -- adicionar offset -03:00 na formatacao da data
2. **Migration SQL** -- corrigir data_ocorrencia do sinistro existente
