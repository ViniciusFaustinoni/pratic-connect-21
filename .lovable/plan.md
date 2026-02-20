
# Adicionar Horário de Comunicação (created_at) na Tabela de Sinistros

## Problema

A coluna "Data" em `SinistrosList.tsx` (linha 500) mostra apenas a **data da ocorrência** (`data_ocorrencia`) no formato `dd/MM/yyyy`. O usuário quer também ver o **horário exato em que o sinistro foi comunicado** (campo `created_at`) — especialmente importante para sinistros recebidos via WhatsApp.

## O que precisa mudar

### Arquivo: `src/pages/eventos/SinistrosList.tsx`

**Mudança 1 — Expandir a coluna "Data" para exibir dois campos:**

A célula atual na linha 500:
```tsx
<TableCell>{formatDate(sinistro.data_ocorrencia)}</TableCell>
```

Será transformada em um bloco com dois campos empilhados:

```tsx
<TableCell>
  <div>
    <p className="font-medium">{formatDate(sinistro.data_ocorrencia)}</p>
    <p className="text-xs text-muted-foreground">
      Comunicado: {formatDateTime(sinistro.created_at)}
    </p>
  </div>
</TableCell>
```

**Mudança 2 — Adicionar a função `formatDateTime` (linha 237 aprox.):**

Próximo à função `formatDate` existente, adicionar:

```typescript
const formatDateTime = (date: string | null) => {
  if (!date) return '-';
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};
```

## Resultado visual esperado

Na coluna "Data" da tabela de sinistros:

```
20/02/2026
Comunicado: 20/02/2026 às 15:46
```

- A data da ocorrência (que o associado informou) continua em destaque
- O horário exato do comunicado (`created_at`) aparece abaixo em texto menor e cinza
- O label "Comunicado:" deixa claro que é o momento do registro, não da ocorrência

## Arquivos Alterados

| Arquivo | Linha | Alteração |
|---|---|---|
| `src/pages/eventos/SinistrosList.tsx` | ~237 | Adicionar função `formatDateTime` |
| `src/pages/eventos/SinistrosList.tsx` | ~500 | Expandir célula para mostrar `created_at` com horário |
