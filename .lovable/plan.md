

## Plano: Mostrar etapa de assinatura apenas quando o link estiver pronto

### Problema atual
O componente entra no estado `aguardando_assinatura` **antes** de ter o link da Autentique. Isso mostra a tela completa (instruções, área de "gerando link...") e os botões só aparecem depois via polling/realtime — exigindo que o usuário atualize a página.

### Solução
Manter o estado de **loading** (`enviando_autentique`) até que o `linkAssinatura` esteja efetivamente disponível. Só transicionar para `aguardando_assinatura` quando o link existir.

### Alterações em `EtapaAssinaturaContrato.tsx`

1. **`enviarParaAutentique`** (linha 256): Não mudar para `aguardando_assinatura` se não tiver link. Manter em `enviando_autentique` e iniciar polling interno até o link chegar.

2. **Polling de link (linhas 338-363)**: Mudar a condição para rodar também quando `etapaInterna === 'enviando_autentique'` e não só `aguardando_assinatura`. Quando o link chegar via polling, aí sim mudar para `aguardando_assinatura`.

3. **Realtime (linhas 280-335)**: Quando receber `autentique_url` via realtime e a etapa for `enviando_autentique`, transicionar para `aguardando_assinatura`.

4. **Remover o bloco condicional de "link loading"** (linhas 745-781) — como a etapa só será `aguardando_assinatura` quando o link existir, o `linkAssinatura` estará sempre presente nessa tela.

### Fluxo revisado
```
verificando → gerando_contrato → enviando_autentique (fica aqui até link chegar)
                                                      ↓ link recebido
                                               aguardando_assinatura (botões visíveis imediatamente)
                                                      ↓
                                                   assinado
```

### Resultado
- O usuário vê um spinner de "Preparando assinatura digital..." até o link estar pronto
- Quando a tela de assinatura aparecer, os botões "Assinar Contrato Agora" e "Copiar Link" já estarão visíveis
- Sem necessidade de recarregar a página

