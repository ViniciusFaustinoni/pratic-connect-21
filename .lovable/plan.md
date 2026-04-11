

## Plano: Extrair linkAssinatura para estado independente

### Problema
As closures dos `useEffect` capturam `contrato?.linkAssinatura` no momento da criação. Os guards nas linhas 272, 296, 318, 350 usam o valor da closure (sempre `undefined`), mas o `setContrato` atualiza o objeto inteiro — os effects não re-executam corretamente porque `contrato?.linkAssinatura` na dependency array muda por referência de forma imprevisível.

### Alteração (1 arquivo)

**`src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`**

1. Adicionar estado independente (linha ~69):
```typescript
const [linkAssinatura, setLinkAssinatura] = useState<string | null>(null);
const linkEfetivo = linkAssinatura || contrato?.linkAssinatura || null;
```

2. **Step 4 polling** (linha 272): guard usa `linkEfetivo`, setter chama `setLinkAssinatura`
3. **Step 4b timeout** (linha 296): guard usa `linkEfetivo`
4. **Step 5 polling** (linhas 318, 350): setter chama `setLinkAssinatura` + `setLinkTimeout(false)`
5. **verificarManualmente** (linha 395): setter chama `setLinkAssinatura`
6. **enviarParaAutentique** (linha 224-231, 244): adicionar `setLinkAssinatura`
7. **verificarOuGerarContrato** (linha 157): adicionar `setLinkAssinatura`
8. **UI** (linha 695, 709, 715): trocar `contrato?.linkAssinatura` por `linkEfetivo`

### Resultado
O link tem ciclo de vida independente do objeto `contrato`. Qualquer polling que encontrar a URL a exibe imediatamente.

