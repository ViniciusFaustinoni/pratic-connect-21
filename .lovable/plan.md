

# Mostrar Loading e Polling Automático Enquanto o Link de Assinatura é Gerado

## Problema
Quando o contrato é criado no Autentique, o `short_link` pode demorar alguns segundos para ficar disponível. Nesse intervalo, o botão "Assinar Contrato Agora" não aparece e o associado não tem feedback visual do que está acontecendo.

## Solução

### `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`

1. **Substituir o bloco condicional do botão (linhas 662-685)** para incluir um estado de loading quando `linkAssinatura` ainda é `null`:

```tsx
{contrato?.linkAssinatura ? (
  // Botão de assinatura (código existente)
  <motion.div ...>
    <Button ...>Assinar Contrato Agora</Button>
    <CopyLinkButton ... />
  </motion.div>
) : (
  // Loading enquanto o link é gerado
  <motion.div className="space-y-3 text-center p-4 bg-amber-50 border border-amber-200 rounded-lg">
    <Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-600" />
    <p className="text-sm font-medium text-amber-800">
      Aguarde... estamos gerando seu link de assinatura
    </p>
    <p className="text-xs text-amber-600">
      Isso pode levar alguns segundos
    </p>
  </motion.div>
)}
```

2. **Reduzir o intervalo do polling de 15s para 5s** enquanto o link não estiver disponível, e manter 15s depois:

Na linha 343, alterar o `setInterval` para usar intervalo dinâmico:
```typescript
const interval = setInterval(verificarAssinatura, contrato?.linkAssinatura ? 15000 : 5000);
```

3. **Atualizar o `linkAssinatura` a partir da resposta do sync no polling** — isso já está implementado nas linhas 320-322 e 362-364, então o botão aparecerá automaticamente assim que o link chegar.

4. **Reduzir o fallback inicial de 3s para polling contínuo** — o setTimeout de 3s (linhas 254-265) já existe como fallback, mas o polling de 5s cobrirá melhor esse caso.

## Arquivo alterado
| Arquivo | Ação |
|---------|------|
| `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx` | Adicionar estado loading + polling 5s para link ausente |

