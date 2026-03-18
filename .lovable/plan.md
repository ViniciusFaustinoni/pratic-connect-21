

## Correção: APP + Deságio — Preço subordinado e exclusão do SELECT EXCLUSIVE

### Resumo das alterações

Três mudanças em `src/hooks/usePlanosCotacao.ts` e uma nova chave na tabela `configuracoes`:

---

### 1. Nova config: `categorias_que_sobrepoe_app`

Inserir na tabela `configuracoes`:
```sql
INSERT INTO configuracoes (chave, valor, descricao)
VALUES (
  'categorias_que_sobrepoe_app',
  '["chassi_remarcado","placa_vermelha","ex_taxi","taxi","leilao","ressarcimento_integral"]',
  'Categorias de deságio que anulam o adicional APP na precificação'
);
```

No hook, buscar essa config da mesma forma que `categorias_desagio` (novo `useQuery`).

---

### 2. Precificação: deságio anula adicional APP (linhas 499-510)

Lógica atual (problema):
```
1. Se isDesagio → valorMensal = valorDesagio
2. Se APP → resolverPrecoApp() soma R$35,90 sobre o valorDesagio ← BUG
```

Lógica corrigida:
```typescript
// Deságio: usar valor_desagio como base
if (isDesagio && valorDesagio != null && linhasComDesagio.includes(linhaSlug || '')) {
  valorMensal = valorDesagio;
}

// Adicional APP: NÃO aplicar se a categoria está em categorias_que_sobrepoe_app
const categoriaAnulaApp = isDesagio && categoriasQueSobrepoeApp.includes(categoria || '');
if (linhaSlug && tipoUsoOriginal === 'aplicativo' && !categoriaAnulaApp) {
  valorMensal = resolverPrecoApp(linhaSlug, regiaoLower, tipoUsoOriginal, valorMensal, adicionalApp, configApp);
}
```

O SELECT ONE (que tem coluna dedicada `aplicativo` na tabela de preços) continua funcionando normalmente porque `resolverPrecoApp` já retorna o valor direto sem somar adicional para linhas com coluna dedicada. Mas como a regra diz que SELECT ONE deve usar preço APP puro (sem deságio), adicionamos uma guarda:

```typescript
// SELECT ONE com coluna dedicada: ignorar deságio, usar preço APP direto
const temColunaAppDedicada = configApp.linhasComColunaApp.includes(linhaSlug || '');
if (isDesagio && valorDesagio != null && linhasComDesagio.includes(linhaSlug || '') && !temColunaAppDedicada) {
  valorMensal = valorDesagio;
}
```

---

### 3. Filtro: ocultar SELECT EXCLUSIVE em APP + deságio (linhas 406-412)

Adicionar filtro logo após o bloco de `blocked_categories`, usando o nome/codigo do plano ou o slug da product_line:

```typescript
// SELECT EXCLUSIVE: ocultar quando APP + categoria de deságio combinam
const isAppComDesagio = params.usoApp && !!categoria && categoria !== 'nenhuma'
  && categoriasQueSobrepoeApp.includes(categoria);
if (isAppComDesagio && plano.codigo?.toLowerCase().includes('exclusive')) {
  continue;
}
```

Alternativamente, se existir um campo mais confiável (slug da product_line = `select-exclusive`), usar esse. Se não, o `codigo` ou `nome` do plano servem.

---

### 4. Cota: resolver conflito APP vs deságio (linhas 542-545)

A lógica atual onde `isDesagio` sobrescreve `usoApp` na resolução de cota **já está correta** para o novo comportamento — quando APP + deságio, deságio prevalece também na cota. Nenhuma alteração necessária aqui.

---

### Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `src/hooks/usePlanosCotacao.ts` | Nova query `categorias_que_sobrepoe_app`, guarda no adicional APP, guarda no deságio para linhas com coluna dedicada, filtro exclusão EXCLUSIVE |
| BD: `configuracoes` | Nova chave `categorias_que_sobrepoe_app` |

### Fluxo resultante

```text
APP + deságio (ex: leilão):
  → Select/Lançamento: preço = valor_desagio (sem adicional APP)
  → Select One: preço = coluna 'aplicativo' da tabela (sem deságio)
  → Select Exclusive: OCULTO

APP sem deságio:
  → Todos: comportamento atual mantido (adicional APP aplicado)

Passeio + deságio:
  → Comportamento atual mantido (valor_desagio, sem APP)
```

