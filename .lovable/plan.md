

## Diagnóstico — Por que o sistema não detectou a assinatura

### Causa raiz (confirmada via API Autentique)

Consultei o documento da Camilly diretamente na API do Autentique. A resposta mostra:

```
signatures[1]:
  name: CAMILLY VITÓRIA CALIXTO CARNEIRO
  action: SIGN
  viewed: 2026-04-16T17:12:54Z   ✓ visualizou
  signed: null                    ✗ NÃO assinado (oficialmente)
  verifications: [{ type: PF_FACIAL, verified_at: null }]   ⏳ biometria pendente
  biometric_approved: null
  biometric_rejected: null
```

A Camilly **completou o fluxo de assinatura no celular** (incluindo a selfie), mas o algoritmo de **biometria facial (`PF_FACIAL`)** do Autentique **não conseguiu confirmar a identidade dela com confiança suficiente** e jogou a assinatura em **modo de revisão manual** — o que gerou exatamente a tela que ela viu: *"Aguarde a verificação. Sua assinatura foi realizada com sucesso, o criador do documento foi notificado e precisará verificar a sua assinatura manualmente."*

Enquanto um administrador da conta Autentique não aprovar manualmente em `painel.autentique.com.br`:
- `signed.created_at` permanece `null` na API GraphQL
- o webhook `signature.accepted` **não é disparado**
- o sync polling vê apenas `viewed`, nunca `signed`
- por isso o sistema continua mostrando "visualizado", e está **tecnicamente correto**

**Não é bug do sistema** — é o fluxo desenhado do Autentique para casos de biometria duvidosa, e está alinhado com a política `mem://integrations/autentique/signature-credits-policy` e `mem://features/contracts/autentique-signing-flow-v7`.

### O que precisa ser feito (duas frentes)

**Frente A — Operacional (imediato, para destravar a Camilly):**

1. Acessar `https://painel.autentique.com.br` com a conta admin da PraticCar
2. Abrir o documento `Termo de Afiliação CTR-20260416171135-2RI0GS - CAMILLY VITÓRIA CALIXTO CARNEIRO`
3. Revisar a foto/selfie capturada da Camilly comparando com a CNH/RG dela
4. **Se for ela mesma:** aprovar manualmente a verificação biométrica → o Autentique então marca como `signed`, dispara o webhook, e o nosso sistema atualiza automaticamente em segundos
5. **Se houver dúvida:** reenviar o termo para nova assinatura (a Camilly refaz a selfie em melhor iluminação)

**Frente B — Melhoria de produto (para evitar reincidência e dar visibilidade):**

Atualmente o sistema **não tem como saber** que uma assinatura está travada em revisão manual de biometria — ele apenas vê "viewed" e fica em loop de polling. Proponho 3 melhorias:

1. **Detectar estado "biometria em revisão" no `autentique-sync-contrato`**
   Adicionar leitura dos campos `verifications.verified_at`, `biometric_approved` e `biometric_rejected` na query GraphQL. Quando `viewed != null && signed == null && verifications[PF_FACIAL].verified_at == null` por mais de **15 minutos**, marcar `autentique_status = 'biometric_review'` no contrato.

2. **UI: badge e alerta no painel de contratos**
   No card do contrato (admin) e na tela pública de acompanhamento (`/cotacao/:token`), exibir aviso laranja quando `autentique_status = 'biometric_review'`:
   *"Assinatura em revisão biométrica pelo Autentique. Um administrador precisa aprovar manualmente em painel.autentique.com.br. Tempo médio: 1h útil."*
   Botão direto para `https://painel.autentique.com.br/documentos/{autentique_documento_id}` (apenas para roles admin/diretor).

3. **Notificação automática para a diretoria**
   Quando o sync detectar `biometric_review` pela primeira vez, criar uma notificação interna (`notificacoes`) para os diretores com link direto para aprovar no painel Autentique. Evita que o cliente fique horas esperando sem ninguém saber.

### Arquivos afetados (Frente B)

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/autentique-sync-contrato/index.ts` | Ampliar query GraphQL com `verifications` e `biometric_*`; adicionar lógica para status `biometric_review` |
| `supabase/functions/autentique-webhook/index.ts` | Tratar evento `signature.updated` quando contém `biometric_rejected` |
| `src/hooks/useAutentiqueStatusPublico.ts` | Expor novo campo `biometric_status` |
| `src/pages/AcompanharContratacao.tsx` (ou similar do fluxo público) | Banner laranja quando em revisão biométrica |
| `src/components/contratos/ContratoCard.tsx` (admin) | Badge "Biometria em revisão" + botão direto Autentique |
| Novo: nenhuma migração de banco — o campo `autentique_status` já existe |

### Ação imediata recomendada

**Antes de implementar a Frente B**, resolva a Frente A para a Camilly (pode levar 1 minuto): acesse `painel.autentique.com.br` com a conta admin, aprove a biometria dela e o sistema atualizará tudo sozinho via webhook.

**Quer que eu implemente a Frente B agora?** São ~4 arquivos editados, sem migração de banco, e cobre 100% dos casos futuros de biometria travada.

