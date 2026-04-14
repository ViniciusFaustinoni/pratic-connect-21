

## Plano: Adicionar mensagem destacada na etapa de assinatura

### O que muda
Adicionar uma mensagem grande e chamativa logo após o cabeçalho do card, antes das informações do signatário, com o texto "Seu contrato está no seu e-mail para assinatura!" em fonte grande e destaque visual.

### Implementacao

**Arquivo: `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`**

Inserir entre a linha 770 (`</CardHeader>`) e a linha 772 (`<CardContent>`), dentro do `CardContent`, antes do bloco de informações do signatário:

```tsx
{/* Mensagem destaque */}
<div className="text-center py-4 px-3">
  <div className="inline-flex items-center gap-2 mb-2">
    <Mail className="h-6 w-6 text-primary animate-bounce" />
  </div>
  <p className="text-2xl md:text-3xl font-bold text-primary leading-tight">
    Seu contrato está no seu e-mail para assinatura!
  </p>
</div>
```

Isso aparecera como uma mensagem grande e visualmente destacada no topo do conteudo, antes do passo-a-passo.

