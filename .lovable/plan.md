

## Plano: Corrigir tela "travada" no Acompanhamento de Proposta

### Diagnóstico

A cotação não travou — ela foi processada corretamente. O problema é que a edge function `contrato-gerar` cria o associado com status `pendente_vistoria`, mas a página de acompanhamento (`AcompanhamentoProposta.tsx`) **não tem tratamento para esse status** na função `getStatusInfo`. Resultado: cai no caso default "Proposta Recebida / Aguardando processamento", dando a impressão de que nada aconteceu.

### Correção

**Editar**: `src/pages/public/AcompanhamentoProposta.tsx`

Adicionar tratamento para o status `pendente_vistoria` na função `getStatusInfo`, antes do bloco de `documentacao_pendente` (por volta da linha 454):

```typescript
// Pendente vistoria
if (associado.status === 'pendente_vistoria') {
  return {
    status: 'pendente_vistoria',
    icon: Camera, // já importado
    color: 'warning',
    title: 'Aguardando Vistoria',
    description: 'Sua proposta foi recebida! Aguardando a realização da vistoria do veículo.',
    showDetails: true,
    showCriarConta: false,
    showEmRota: false,
    showEmAndamento: false,
    showAtribuidaRota: false,
  };
}
```

Também verificar se existem outros status possíveis do associado que não estão cobertos (ex: `pendente_documentacao`, `pendente_pagamento`) e adicionar tratamento similar para evitar que caiam no default genérico.

### Resultado
O cliente verá "Aguardando Vistoria" em vez de "Aguardando processamento", com orientação clara sobre o próximo passo.

### Arquivo
- **Editar**: `src/pages/public/AcompanhamentoProposta.tsx` (adicionar case `pendente_vistoria` em `getStatusInfo`)

