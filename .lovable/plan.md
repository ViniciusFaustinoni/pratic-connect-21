

## Plano: Corrigir botão de assinatura que não aparece após link ser gerado

### Diagnóstico

O problema tem duas causas:

1. **O polling de sync (15s) recupera o link mas não atualiza o estado local.** O `autentique-sync-contrato` retorna `autentique_url` na resposta e salva no banco, mas o código do polling (step 5, linhas 308-353 de `EtapaAssinaturaContrato.tsx`) nunca usa esse valor para atualizar `contrato.linkAssinatura`. Ele só verifica se o contrato foi *assinado*, não se o *link apareceu*.

2. **O timeout de 30s mata a mensagem "Aguarde" antes do link chegar.** Após 30s, o componente mostra "Tentar gerar novamente" em vez de continuar buscando. Se o link apareceu no banco após o timeout, o polling leve (step 4) continua rodando mas o visual já mudou para o botão de retry.

### Alteração (1 arquivo)

**`src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`**

- No polling de sync (step 5, ~linha 315): após receber `syncResult`, verificar `syncResult?.autentique_url` e atualizar `contrato.linkAssinatura` se estiver ausente
- No fallback do mesmo polling (~linha 340): se `data?.autentique_url` existir e `contrato.linkAssinatura` não, atualizar também
- Aumentar timeout de 30s para 90s (alinhado com o timeout do `useContratoByToken`)

```typescript
// Dentro do polling step 5, após o console.log do syncResult:
if (syncResult?.autentique_url && !contrato?.linkAssinatura) {
  setContrato(prev => prev ? { ...prev, linkAssinatura: syncResult.autentique_url } : prev);
}

// No fallback DB check:
if (data?.autentique_url && !contrato?.linkAssinatura) {
  setContrato(prev => prev ? { ...prev, linkAssinatura: data.autentique_url } : prev);
}
```

### Resultado
Quando o Autentique demora para gerar o link, o polling de sync o recupera e o botão "Assinar Contrato Agora" aparece automaticamente sem precisar recarregar a página.

