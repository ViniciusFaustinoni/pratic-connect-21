

# Corrigir persistência de endereço no agendamento de vistoria completa

## Problema

Na linha 847 de `CotacaoContratacao.tsx`, o componente `AgendamentoVistoriaCompleta` é renderizado **sem a prop `enderecoInicial`**. Os dados de endereço do cliente existem na cotação (`cliente_cep`, `cliente_logradouro`, etc.) e já são passados corretamente em outro ponto do fluxo (linha 546), mas não nesta instância.

## Correção

### 1. Passar `enderecoInicial` ao `AgendamentoVistoriaCompleta` (CotacaoContratacao.tsx ~linha 847)

Adicionar a prop `enderecoInicial` com os dados de endereço da cotação, igual ao padrão já usado na Etapa 3:

```tsx
<AgendamentoVistoriaCompleta
  cotacaoId={cotacao.id}
  tipoVistoria="autovistoria"
  ...props existentes...
  enderecoInicial={{
    cep: cotacao.cliente_cep || '',
    logradouro: cotacao.cliente_logradouro || '',
    numero: cotacao.cliente_numero || '',
    complemento: cotacao.cliente_complemento || '',
    bairro: cotacao.cliente_bairro || '',
    cidade: cotacao.cliente_cidade || '',
    estado: cotacao.cliente_uf || '',
  }}
  onConfirmar={...}
/>
```

### 2. Verificar que `AgendamentoVistoriaCompleta` repassa `enderecoInicial` ao `AgendamentoVistoria`

O componente já aceita e repassa a prop — confirmado no código existente (linha 76 de `AgendamentoVistoriaCompleta.tsx` e linha 67-75 de `AgendamentoVistoria.tsx`).

## Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/public/CotacaoContratacao.tsx` | Adicionar prop `enderecoInicial` na instância do `AgendamentoVistoriaCompleta` |

