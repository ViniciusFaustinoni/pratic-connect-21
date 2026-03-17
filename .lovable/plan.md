

## Diagnóstico

**Linha 347-348** de `usePlanosCotacao.ts`:
```ts
const isPlanoAplicativo = tipoUsoPlano === 'aplicativo' || categoriaPlano === 'aplicativo';
if (isPlanoAplicativo) continue;
```

Isso exclui **incondicionalmente** todo plano com `tipo_uso = 'aplicativo'`, independente do que o consultor selecionou. O SELECT EXCLUSIVE (id `43fe1e6a`, `tipo_uso = 'aplicativo'`) nunca aparece.

**Linha 367-369** já tem um filtro de `supports_app`, mas ele só roda para planos que sobrevivem ao filtro anterior — o que nunca acontece para o SELECT EXCLUSIVE.

## Correção

Substituir as linhas 346-348 por um filtro bidirecional baseado em `params.usoApp`:

```ts
// Filtrar por tipo de uso: passeio vs aplicativo
if (params.usoApp && tipoUsoPlano !== 'aplicativo') continue;
if (!params.usoApp && tipoUsoPlano === 'aplicativo') continue;
```

**Lógica:**
- `usoApp = true` → mostra apenas planos com `tipo_uso = 'aplicativo'`
- `usoApp = false` → mostra apenas planos com `tipo_uso != 'aplicativo'`

Remover também a checagem por `categoriaPlano === 'aplicativo'` nesse ponto, pois `categoria` tem outro propósito (categorias de veículo aceitas, tratado nas linhas 380-389).

O filtro de `supports_app` na linha 367 continua funcionando como validação adicional (linhas que não suportam APP são excluídas mesmo que o plano tenha `tipo_uso = 'aplicativo'`).

## Impacto

- SELECT EXCLUSIVE (`tipo_uso = 'aplicativo'`) volta a aparecer quando `usoApp = true`
- SELECT BASIC e PREMIUM (`tipo_uso = 'passeio'`) continuam aparecendo quando `usoApp = false`
- Nenhum outro arquivo precisa ser alterado

