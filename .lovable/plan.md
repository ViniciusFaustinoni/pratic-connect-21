# Ícone do Autentique — visibilidade restrita

## Objetivo
Em **Cotações › Outros Processos**, na coluna **Ações** de uma linha de Troca de Titularidade, o ícone do Autentique (`FileText` que abre o termo) deve aparecer **somente** durante a janela:

- **DEPOIS** do termo de cancelamento ser **enviado** ao titular antigo
- **ANTES** da assinatura ser concluída

Em qualquer outro estado (pendente sem envio, assinado, recusado/cancelado), o ícone fica oculto.

## Escopo

### `src/components/cotacoes/OutrosProcessosPanel.tsx`
Trocar a condição atual:
```tsx
{item.termo_url && item.termo_status !== 'assinado' && ( ...botão Autentique... )}
```
por:
```tsx
{item.termo_url && item.termo_status === 'enviado' && ( ...botão Autentique... )}
```

Isso garante que o ícone só apareça quando o termo já foi enviado e ainda não foi assinado/recusado/cancelado. Os demais ícones (lápis/olho, enviar/reenviar, abrir cotação) permanecem inalterados.

## Fora de escopo
- Sem mudanças em hooks, edge functions, banco de dados ou no `TrocaTimelineDrawer`.
- Os outros tipos de processo (substituição, inclusão, migração) não usam esse ícone — nada muda para eles.
