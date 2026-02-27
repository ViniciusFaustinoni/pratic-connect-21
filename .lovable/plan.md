

# Corrigir operador e unificar funcao exigeRastreador

## Resumo

Corrigir o operador de comparacao de `>` para `>=` em todas as copias da funcao `exigeRastreador`, atualizar comentario desatualizado e remover a copia local duplicada em `termo-afiliacao-template.ts`.

## Alteracoes

### 1. `src/types/termo-filiacao.ts` (linhas 202, 206)

Trocar `>` por `>=`:

```typescript
// linha 202
if (veiculo.tipo === 'carro' && veiculo.valorFipe >= thresholdCarro) {
// linha 206
if (veiculo.tipo === 'moto' && veiculo.valorFipe >= thresholdMoto) {
```

### 2. `supabase/functions/_shared/template-utils.ts` (linhas 704, 708)

Trocar `>` por `>=`:

```typescript
// linha 704
if (isMoto && valorFipe >= thresholdMoto) {
// linha 708
if (!isMoto && valorFipe >= thresholdCarro) {
```

### 3. `supabase/functions/_shared/termo-afiliacao-template.ts`

**Remover a funcao local** `exigeRastreador` (linhas 858-889) e **importar** de `template-utils.ts`:

- Adicionar import no topo do arquivo:
  ```typescript
  import { exigeRastreador } from './template-utils.ts';
  ```
- Remover linhas 856-889 (comentario + funcao local inteira)

Isso elimina a duplicacao e o comentario desatualizado (linha 862: "FIPE > R$ 20.000") de uma so vez.

**Nota**: A funcao em `template-utils.ts` ja usa os mesmos campos (`valor_fipe`, `categoria`, `combustivel`) que o template espera, entao a importacao e direta sem ajustes.

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/types/termo-filiacao.ts` | `>` para `>=` nas linhas 202 e 206 |
| `supabase/functions/_shared/template-utils.ts` | `>` para `>=` nas linhas 704 e 708 |
| `supabase/functions/_shared/termo-afiliacao-template.ts` | Importar `exigeRastreador` de `template-utils.ts`; remover funcao local duplicada (linhas 856-889) |

## Validacao

- Carro FIPE = R$ 30.000 -> Obrigatorio
- Carro FIPE = R$ 29.999 -> Opcional
- Moto FIPE = R$ 9.000 -> Obrigatorio
- Moto FIPE = R$ 8.999 -> Opcional
- Diesel qualquer valor -> Obrigatorio

