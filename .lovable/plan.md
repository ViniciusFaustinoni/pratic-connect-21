
# Adicionar CNH ao Termo de Filiacao

## Problema

A CNH (numero, validade, categoria) e extraida via OCR e salva na tabela `cotacoes` (campos `cliente_cnh`, `cliente_cnh_validade`, `cliente_cnh_categoria`), e tambem copiada para o contrato na edge function `contrato-gerar`. Porem, esses dados **nunca chegam ao Termo de Afiliacao** porque:

1. A interface `ClienteData` em `termo-afiliacao-utils.ts` nao tem campos para CNH
2. A funcao `mapearDadosParaTemplate()` nao mapeia esses campos
3. O template HTML em `termo-afiliacao-template.ts` nao exibe a CNH
4. O mapa de variaveis em `template-utils.ts` nao inclui variaveis `associado.cnh`

## Solucao

Adicionar os campos da CNH em toda a cadeia: interface, mapeamento, template HTML e variaveis dinamicas.

### Alteracoes

**1. `supabase/functions/_shared/termo-afiliacao-utils.ts`**

- Adicionar campos `cnh`, `cnh_validade` e `cnh_categoria` na interface `ClienteData`
- Na funcao `mapearDadosParaTemplate`, mapear `contrato.cliente_cnh`, `contrato.cliente_cnh_validade` e `contrato.cliente_cnh_categoria`

**2. `supabase/functions/_shared/termo-afiliacao-template.ts`**

- Na secao 1 (Qualificacao do Associado), adicionar uma linha com CNH, validade e categoria logo abaixo do RG

Exemplo do HTML a ser adicionado:
```html
<div class="field-row">
  <div class="field">
    <span class="field-label">CNH:</span>
    <span class="field-value">${data.cliente.cnh || '---'}</span>
  </div>
  <div class="field">
    <span class="field-label">Validade:</span>
    <span class="field-value">${formatDate(data.cliente.cnh_validade)}</span>
  </div>
  <div class="field">
    <span class="field-label">Categoria:</span>
    <span class="field-value">${data.cliente.cnh_categoria || '---'}</span>
  </div>
</div>
```

**3. `supabase/functions/_shared/template-utils.ts`**

- Adicionar variaveis `associado.cnh`, `associado.cnh_validade` e `associado.cnh_categoria` no mapa de substituicao, permitindo que templates dinamicos tambem usem esses dados

### Arquivos alterados

- `supabase/functions/_shared/termo-afiliacao-utils.ts` (interface + mapeamento)
- `supabase/functions/_shared/termo-afiliacao-template.ts` (exibicao HTML)
- `supabase/functions/_shared/template-utils.ts` (variaveis dinamicas)

### Deploy necessario

As 3 edge functions que usam esses arquivos compartilhados precisarao ser re-deployed:
- `contrato-gerar`
- Qualquer outra function que renderize o termo
