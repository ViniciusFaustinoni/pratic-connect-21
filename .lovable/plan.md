# Cancelada azul vs Cancelada vermelha — diagnóstico e fix

## Por que algumas Cancelada são azuis e outras vermelhas

A aba "Outros Processos" monta cada linha por um de **dois caminhos diferentes**, e cada caminho tem o seu próprio mapa de status:

```
Linha tem cotação criada?
├── SIM → bloco "via cotação"  → usa COTACAO_STATUS_LABELS  ← BUG aqui
└── NÃO → bloco "só solicitação" → usa etapaMap próprio
```

Arquivo: `src/hooks/useOutrosProcessos.ts`

| Linha do screenshot | Tem cotação? | Caminho | Mapa usado | Resultado |
|---|---|---|---|---|
| LTB4J74 (COT-…-183) | sim | cotação | `COTACAO_STATUS_LABELS` | "Cancelada" sem entrada → fallback `humanizeStatus` + tone **`info`** → **azul** |
| RVW1A14 (—) | não | substituição direta | `etapaMap` interno | `cancelada: { tone: 'danger' }` → **vermelho** |
| QOO5C17 (—) | não | substituição direta | `etapaMap` interno | `cancelada: { tone: 'danger' }` → **vermelho** |

Olhando o código (linhas 113–119):

```ts
const COTACAO_STATUS_LABELS = {
  rascunho:    { ..., tone: 'warn' },
  enviada:     { ..., tone: 'info' },
  aceita:      { ..., tone: 'ok' },
  recusada:    { ..., tone: 'danger' },
  expirada:    { ..., tone: 'danger' },
  // ❌ 'cancelada' não existe aqui
};
```

E o fallback (linha 136):

```ts
return COTACAO_STATUS_LABELS[cotacaoStatus]
  ?? { label: humanizeStatus(cotacaoStatus), tone: 'info' };  // ← cai aqui = azul
```

Resumo: o mesmo conceito ("cancelada") tem **dois donos** no código, e só um foi preenchido. Quando o segundo cai no fallback, vira `info` (azul) em vez de `danger` (vermelho).

## Fix

Uma única mudança em `src/hooks/useOutrosProcessos.ts`:

1. Adicionar a entrada faltante em `COTACAO_STATUS_LABELS`:
   ```ts
   cancelada: { label: 'Cancelada', tone: 'danger' },
   ```

Isso já basta para uniformizar todas as Cancelada como vermelhas, independente do caminho (cotação ou solicitação).

## Hardening opcional (recomendo)

Para não acontecer de novo com outros status, vale também:

2. No fallback do `humanizeStatus`, detectar palavras-chave de cancelamento/reprovação e devolver tone `danger` em vez de `info`:
   ```ts
   const fallbackTone = /^(cancel|reprov|expir|recus|falh|err)/i.test(cotacaoStatus)
     ? 'danger'
     : 'info';
   ```

Isso é defesa contra qualquer status novo que aparecer no enum sem alguém lembrar de atualizar o mapa.

## Sem migrations, sem mudanças de dados

Fix é 100% UI. Não toca banco, não toca edges, não toca outras telas. `TipoEntradaBadge`, `TrocaTitularidadeBadge` e `statusConfig` continuam intactos.

## O que aprovar

- **(A)** Só o fix (item 1) — uniformiza imediato
- **(B)** Fix + hardening (itens 1 e 2) — recomendado

Me confirma A ou B que eu mudo para build mode.
