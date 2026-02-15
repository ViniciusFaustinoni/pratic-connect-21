

# Adicionar etapa de Agendamento na Timeline

## Problema

A timeline (`TimelineEventoTab.tsx`) busca os links de evento mas so exibe "Link enviado". Nao exibe quando cada etapa foi completada pelo associado, em especial a etapa 4 (Agendamento).

## Alteracao

### Arquivo: `src/components/sinistros/TimelineEventoTab.tsx`

Na secao 3 (links do evento), expandir o `select` para incluir os campos de conclusao de cada etapa:

```typescript
.select('id, created_at, tipo, status, etapa_atual, etapa1_completada_em, etapa2_completada_em, etapa3_completada_em, etapa4_completada_em')
```

Apos o push do "Link enviado", adicionar entradas na timeline para cada etapa completada:

- **etapa1_completada_em**: "Auto Vistoria concluída pelo associado" (icone Car)
- **etapa2_completada_em**: "B.O. enviado pelo associado" (icone FileText)
- **etapa3_completada_em**: "Relato enviado pelo associado" (icone MessageSquare)
- **etapa4_completada_em**: "Agendamento realizado pelo associado" (icone Calendar, badge verde "Agendado")

Cada entrada so sera adicionada se o respectivo campo nao for null, e usara a data/hora do campo como timestamp.

