

# Auditoria: Processo de Assinatura de Filiação — Diagnóstico e Plano

## Fluxo Completo Mapeado

O processo de assinatura tem **dois fluxos**:

1. **Fluxo Público** (associado): `CotacaoContratacao.tsx` → `EtapaAssinaturaContrato` → `contrato-gerar` → `autentique-create` → polling via `autentique-sync-contrato`
2. **Fluxo Interno** (vendedor): `Contratos.tsx` → `useSendToAutentique` → `autentique-create` → webhook + sync manual

---

## Problema Crítico Encontrado

### Mismatch de campos entre `autentique-create` e `EtapaAssinaturaContrato`

A edge function `autentique-create` retorna:
```json
{
  "success": true,
  "documentId": "xxx",
  "signatureLink": "https://...",
  "templateUsed": "..."
}
```

O componente `EtapaAssinaturaContrato` (linha 206) espera:
```javascript
const linkAssinatura = data.link_assinatura || data.autentique_url;
// ...
autentiqueDocumentoId: data.autentique_documento_id
```

**Nenhum dos campos bate.** O resultado:
- O botão "Assinar Contrato Agora" **nunca aparece** no fluxo público (linha 531: `{contrato?.linkAssinatura && (`), porque `linkAssinatura` é `undefined`
- O associado fica preso na tela de "aguardando assinatura" sem link direto, dependendo apenas do email do Autentique
- O polling funciona porque lê do banco (onde os dados estão corretos), mas a UX é degradada

### Impacto no Fluxo Interno

O fluxo interno (`Contratos.tsx`) **NÃO é afetado** porque `useSendToAutentique` não usa os campos de resposta para exibir link — ele apenas invalida queries e a UI re-renderiza com dados do banco.

---

## O Que Está Funcionando Corretamente

| Componente | Status |
|-----------|--------|
| `contrato-gerar` — criação de contrato + associado + veículo + adicionais | OK |
| `autentique-create` — geração de HTML e envio para Autentique | OK |
| `autentique-webhook` — recebe callback de assinatura e atualiza banco | OK |
| `autentique-sync-contrato` — polling manual de status | OK |
| `Contratos.tsx` — enviar/reenviar/copiar link/WhatsApp | OK |
| `ContratoDetailDrawer` — ver detalhes do contrato | OK |
| Proteção contra duplicidade (contrato e documento Autentique) | OK |
| Propagação de adicionais para `associados_beneficios_adicionais` | OK (Parte 2) |

---

## Plano de Correção

### Correção única: Alinhar campos de resposta em `EtapaAssinaturaContrato`

**Arquivo**: `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`

Linha 206 — mudar de:
```javascript
const linkAssinatura = data.link_assinatura || data.autentique_url;
```
Para:
```javascript
const linkAssinatura = data.signatureLink || data.link_assinatura || data.autentique_url;
```

Linha 211 — mudar de:
```javascript
autentiqueDocumentoId: data.autentique_documento_id,
```
Para:
```javascript
autentiqueDocumentoId: data.documentId || data.autentique_documento_id,
```

Essa correção é cirúrgica e resolve o problema sem alterar a edge function (que retorna campos consistentes com o padrão da API do Autentique).

