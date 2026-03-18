

## Correção do baseMatch em `usePlanosCotacao.ts`

Estou em modo de planejamento e não posso editar arquivos diretamente. Aprove este plano para que eu aplique a correção.

### Alteração

**Arquivo:** `src/hooks/usePlanosCotacao.ts`, linhas 304-307

Substituir:
```typescript
const baseBanco = modeloBanco.split(' ')[0];
const baseMatch = baseBanco.length >= 2 && (
  modeloAPIClean.startsWith(baseBanco + ' ') || modeloAPIClean === baseBanco
);
```

Por:
```typescript
const palavrasBanco = modeloBanco.split(' ');
const baseBanco = palavrasBanco[0];
const baseMatch = palavrasBanco.length === 1 && baseBanco.length >= 2 && (
  modeloAPIClean.startsWith(baseBanco + ' ') || modeloAPIClean === baseBanco
);
```

### Lógica da correção

A condição `palavrasBanco.length === 1` impede que modelos multi-palavra no banco (como "COROLLA FIELDER", "PAJERO DAKAR", "VECTRA GT") façam match usando apenas a primeira palavra. Somente modelos de palavra única (como "COROLLA", "PAJERO") poderão usar o `baseMatch`. Modelos multi-palavra dependem exclusivamente do `prefixMatch` ou `containsMatch`, que são mais precisos.

### Validação dos 6 casos após aplicação

Será verificado por leitura de código que:
1. **Corolla XEi 2013** → match com "COROLLA" (1 palavra, baseMatch OK) mas não com "COROLLA FIELDER" (2 palavras, baseMatch bloqueado)
2. **Pajero TR4** → match com "PAJERO" mas não com "PAJERO DAKAR"
3. **Pajero Dakar** → match com "PAJERO DAKAR" via containsMatch, mas não com "PAJERO TR4"
4. **L200 Sport** → match com "L200" mas não com "TRITON L200" (containsMatch pode pegar — verificar)
5. **207 SW** → match com "207" mas não com "207 SEDAN" ou "207 ESCAPADE"
6. **Vectra 2003** → match com "VECTRA" mas não com "VECTRA GT"

Caso 4 e 5 possam ter problema residual com `containsMatch`, será ajustado.

