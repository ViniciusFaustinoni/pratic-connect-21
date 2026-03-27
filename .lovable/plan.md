

# Adicionar Blocos de Assinatura na Proposta de Filiação (Edge Function)

## Problema

A seção de assinatura nos templates das edge functions (`generateSecao8` e `generateSecaoAssinatura`) gera apenas a linha de data/local, mas não inclui os campos de assinatura com nome e CPF do associado e da empresa. O template React (`TermoFiliacaoTemplate.tsx`) já tem esses campos corretamente (linhas 482-498), mas as edge functions que geram o HTML para o Autentique estão incompletos.

## Correção

Adicionar os blocos de assinatura (signature-block) com linhas para nome, CPF e papel (ASSOCIADO / PRATICCAR) nas duas funções:

### 1. `supabase/functions/_shared/termo-afiliacao-template.ts` — `generateSecao8`

Após a `<p class="signature-local-data">`, adicionar:

```html
<div style="text-align: center;">
  <div class="signature-block">
    <div class="signature-line">
      <p class="signature-name">${data.cliente.nome}</p>
      <p class="signature-doc">CPF: ${formatCPF(data.cliente.cpf)}</p>
      <p class="signature-role">ASSOCIADO</p>
    </div>
  </div>
  <div class="signature-block" style="margin-left: 40pt;">
    <div class="signature-line">
      <p class="signature-name">${data.empresa.razaoSocial}</p>
      <p class="signature-doc">CNPJ: ${data.empresa.cnpj}</p>
      <p class="signature-role">PRATICCAR</p>
    </div>
  </div>
</div>
```

### 2. `supabase/functions/_shared/template-utils.ts` — `generateSecaoAssinatura`

Mesma adição de blocos de assinatura, usando `dados.cliente.nome`, `dados.cliente.cpf`, `dados.empresa.razaoSocial`, `dados.empresa.cnpj`.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `supabase/functions/_shared/termo-afiliacao-template.ts` | Adicionar blocos de assinatura em `generateSecao8` |
| `supabase/functions/_shared/template-utils.ts` | Adicionar blocos de assinatura em `generateSecaoAssinatura` |

