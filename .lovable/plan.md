

## Plano: Restaurar botao de confirmacao WhatsApp para todos os servicos

### Problema
`podeEnviarConfirmacao` exclui itens com `permite_encaixe = true`. O item na tela e um encaixe, entao o botao de envio do template de confirmacao nao aparece.

### Correcao
**`src/components/mapa/MapaVistoriasContent.tsx`** - remover a condicao `!v.permite_encaixe` da funcao `podeEnviarConfirmacao`:

```typescript
// De:
const podeEnviarConfirmacao = (v: VistoriaMapa) => {
  return !!v.servico_id_unificado
    && !v.permite_encaixe 
    && (!v.confirmacao_whatsapp || v.confirmacao_whatsapp === 'recusada')
    && !STATUS_REALIZADOS.includes(v.status);
};

// Para:
const podeEnviarConfirmacao = (v: VistoriaMapa) => {
  return !!v.servico_id_unificado
    && (!v.confirmacao_whatsapp || v.confirmacao_whatsapp === 'recusada')
    && !STATUS_REALIZADOS.includes(v.status);
};
```

Unica alteracao, 1 linha removida.

