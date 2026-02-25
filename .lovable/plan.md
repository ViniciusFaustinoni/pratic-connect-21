

# Remover blocos de assinatura duplicados dos termos (Autentique ja inclui)

## Problema

Todos os termos gerados pelo sistema incluem um bloco "ASSINATURA" com linhas para assinatura do associado e da PraticCar. Porem, a Autentique ja adiciona automaticamente sua propria pagina de assinaturas. Resultado: o documento final fica com assinatura duplicada.

## O que manter

- O titulo "ASSINATURA" 
- A data/local (com espacamento maior acima)

## O que remover

- Os blocos `signature-block` com linhas de assinatura (associado + PraticCar)

## Arquivos afetados

### 1. `supabase/functions/_shared/template-utils.ts` (linhas 547-578)
Funcao `generateSecaoAssinatura`: remover os dois `signature-block` divs, manter apenas titulo e data com espacamento.

### 2. `supabase/functions/_shared/termo-afiliacao-template.ts` (linhas 754-784)
Funcao `generateSecao8`: mesma logica -- remover blocos de assinatura, manter titulo e data.

### 3. `supabase/functions/_shared/termo-afiliacao-template.ts` (linhas 986-1000)
Aditivo de rastreador: remover o `signature-block` do comodatario.

### 4. `supabase/functions/autentique-cancelamento-create/index.ts` (linhas 143-149 e 196-202)
Dois blocos de assinatura (template dinamico e hardcoded): remover signature-blocks, manter data.

### 5. `supabase/functions/autentique-evento-create/index.ts` (linhas 243-262 e 352-371)
Dois blocos (template dinamico e fallback): remover signature-blocks, manter data.

### 6. `supabase/functions/autentique-os-saida-create/index.ts` (linhas 229-248 e 344-363)
Dois blocos (template dinamico e fallback): remover signature-blocks, manter data.

### 7. `supabase/functions/autentique-vistoria-create/index.ts` (linhas 211-218)
Remover bloco de assinatura do proprietario (Autentique cuida disso).

## Novo formato padrao da area de assinatura

```html
<div class="signature-area">
  <h2 class="section-title">ASSINATURA</h2>
  <br><br>
  <p class="signature-local-data">
    LOCAL, DATA
  </p>
</div>
```

O espacamento maior entre o titulo e a data (com `<br><br>`) garante separacao visual.

## Deploy

Apos as alteracoes, fazer deploy de todas as edge functions modificadas:
- `autentique-cancelamento-create`
- `autentique-evento-create`
- `autentique-os-saida-create`
- `autentique-vistoria-create`

As funcoes `_shared` sao deployadas automaticamente como dependencias.

