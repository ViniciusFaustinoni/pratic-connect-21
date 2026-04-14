

## Plano: Corrigir overflow de varchar na duplicação de linhas

### Problema encontrado
Ao duplicar a linha ADVANCED com sufixo "SP", região "São Paulo" e desconto 10%, o sistema retorna:
**"Erro ao duplicar linha: value too long for type character varying(100)"**

### Causa raiz
O código de duplicação de linha (`usePlansAdmin.ts`, linhas 1188-1189) **não trunca** os campos `codigo` e `slug` dos planos antes de concatenar o uid:

```typescript
codigo: `${planData.codigo}-c-${uid()}`,   // sem truncação
slug: `${planData.slug || planData.codigo}-c-${uid()}`,  // sem truncação
```

Planos que já são cópias de cópias possuem slugs/codigos de 79-99 caracteres. Ao adicionar `-c-1776189000000-xxxx` (22 chars), o total excede o limite de `varchar(100)`.

Os campos `benefits.slug` e `coberturas.codigo` já possuem `.slice(0, 80)` (linhas 1251, 1328), mas os campos de **planos** não têm essa proteção.

### Correção

**Arquivo: `src/hooks/usePlansAdmin.ts`**

Linha 1188-1189 — truncar `codigo` e `slug` antes de concatenar:

```typescript
codigo: `${(planData.codigo || '').slice(0, 70)}-c-${uid()}`,
slug: `${(planData.slug || planData.codigo || '').slice(0, 70)}-c-${uid()}`,
```

O uid gera ~18 chars + prefixo `-c-` = ~22 chars. Com base de 70 chars, total máximo = 92, seguro dentro do limite de 100.

Além disso, aplicar a mesma proteção nos nomes de planos (linha 1187) e benefícios (linha 1250) que recebem sufixo, garantindo que não excedam os limites das colunas:
- `planos.nome`: sem limite de varchar definido (text), ok
- `coberturas.nome`: varchar(100) — truncar se nome + sufixo > 100

Linha 1327: `nome: sufixo ? \`${cobData.nome}${sufixo}\` : cobData.nome` — adicionar `.slice(0, 100)` ao resultado.

### Teste após correção
Repetir a duplicação da linha ADVANCED com os mesmos parâmetros (SP, 10%, São Paulo) e verificar:
1. Criação sem erro
2. Valores com 10% de desconto aplicado corretamente
3. Regras de região sobrescritas para São Paulo (UUID `b507f9c7-d7c0-4613-8a94-4c1e1278b3f2`)
4. Excluir a linha duplicada após verificação

