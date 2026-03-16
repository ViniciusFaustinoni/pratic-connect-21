

## Diagnóstico

O problema é duplo:

1. **Linha 226**: `if (!regra) return 'negado'` — com a lógica whitelist, qualquer modelo que não bata exatamente (mesmo após normalização) retorna `'negado'`
2. **Linha 343**: `if (resultado === 'negado') continue` — o resultado `'negado'` da elegibilidade **exclui o plano** da lista

Como a normalização de modelo ainda pode falhar em muitos casos (variações de nome), praticamente todos os planos são filtrados.

## Solução

Transformar elegibilidade em **sinalização visual**, não em filtro hard. Os planos aparecem com base nos critérios de preço/FIPE/ano/categoria (que já funcionam), e a elegibilidade apenas adiciona um badge informativo.

### Alteração no `src/hooks/usePlanosCotacao.ts`

**1. Remover o `continue` do filtro de elegibilidade (linhas 330-357)**

Em vez de excluir o plano quando `resultado === 'negado'`, apenas registrar o status. O plano continua no array `planosCalculados` com o campo `elegibilidadeStatus` já existente preenchido.

```typescript
// Linhas 330-357: Remover o bloco que faz continue
// Manter apenas a verificação para popular elegibilidadeStatus
// (que já é feito nas linhas 478-485 ao montar o objeto)
```

**2. Manter a lógica whitelist (linha 226)** — ela está correta conceitualmente, só não deve ser usada como hard filter.

**3. Mover o cálculo de elegibilidadeStatus para antes do push** — já existe nas linhas 478-485, basta garantir que funciona sem o `continue` anterior.

### Alteração na UI (componente de card de plano)

Buscar onde os planos são renderizados e adicionar indicadores visuais:
- `elegibilidadeStatus === 'negado'` → badge vermelho "Restrição de modelo"
- `elegibilidadeStatus === 'limitado'` → badge amarelo "Aceitação condicionada"
- `elegibilidadeStatus === 'aprovado'` ou `undefined` → sem badge (normal)

Preciso verificar qual componente renderiza os cards de plano na cotação.

