

# Plano: Link de assinatura aparece sem reload

## Problema
Quando `autentique-create` não retorna o `signatureLink` na resposta (Autentique ainda processando), o fallback é um único retry após 3s. O polling de 5s existe mas chama `autentique-sync-contrato` (edge function pesada) antes de checar o banco — e o link pode já estar salvo no banco pelo próprio `autentique-create` que terminou de processar.

## Solução

### 1. Adicionar polling leve dedicado ao link (`EtapaAssinaturaContrato.tsx`)
Quando `etapaInterna === 'aguardando_assinatura'` e `!contrato?.linkAssinatura`, criar um **useEffect separado** com polling rápido (2-3s) que apenas faz um SELECT leve no banco (`contratos.autentique_url`) — sem chamar edge functions. Assim que encontrar o link, atualiza o state e o polling para.

### 2. Remover o setTimeout fallback isolado (linhas 254-264)
O setTimeout de 3s com retry único se torna desnecessário com o polling dedicado.

### 3. Manter o polling existente para status de assinatura
O polling de 15s com `autentique-sync-contrato` continua responsável por detectar quando o contrato foi **assinado**, mas não precisa mais se preocupar com o link.

## Detalhes técnicos

Novo useEffect em `EtapaAssinaturaContrato.tsx`:
```typescript
// Polling rápido para capturar o link quando ainda não disponível
useEffect(() => {
  if (etapaInterna !== 'aguardando_assinatura' || !contrato?.id || contrato?.linkAssinatura) return;

  const buscarLink = async () => {
    const { data } = await publicSupabase
      .from('contratos')
      .select('autentique_url')
      .eq('id', contrato.id)
      .maybeSingle();
    if (data?.autentique_url) {
      setContrato(prev => prev ? { ...prev, linkAssinatura: data.autentique_url } : prev);
    }
  };

  const interval = setInterval(buscarLink, 3000);
  buscarLink(); // imediato
  return () => clearInterval(interval);
}, [etapaInterna, contrato?.id, contrato?.linkAssinatura]);
```

- Remove o `setTimeout` de 3s nas linhas 254-264
- O polling existente (linhas 282-347) mantém o intervalo de 5s/15s para checar assinatura, mas a lógica de `data.autentique_url && !contrato?.linkAssinatura` nas linhas 320-322 se torna redundante (pode ser removida para simplificar)

## Arquivo modificado
- `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`

