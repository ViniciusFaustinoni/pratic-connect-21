
# Correcao: Texto "Rastreador Veicular" condicional no termo

## Problema

Na linha 494 de `supabase/functions/_shared/termo-afiliacao-template.ts`, dentro de `generateSecao3`, o texto "Rastreador Veicular: Obrigatorio" e fixo e aparece mesmo para veiculos isentos.

## Correcao

Na funcao `generateSecao3`, chamar `exigeRastreador(data.veiculo, data.configRastreador)` e usar o resultado para exibir "Obrigatorio" ou "Opcional" dinamicamente.

**De (linha 493-495):**
```html
<div class="highlight-box">
  <strong>Rastreador Veicular:</strong> Obrigatório (instalação por técnico credenciado)
</div>
```

**Para:**
```typescript
const rastreador = exigeRastreador(data.veiculo, data.configRastreador);
const textoRastreador = rastreador.exige ? 'Obrigatório' : 'Opcional';
```
```html
<div class="highlight-box">
  <strong>Rastreador Veicular:</strong> ${textoRastreador} (instalação por técnico credenciado)
</div>
```

## Arquivo alterado

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/_shared/termo-afiliacao-template.ts` | Linha ~467 (inicio de generateSecao3): adicionar chamada a exigeRastreador; Linha ~494: usar variavel dinamica |

## Validacao

- Carro R$ 25k gasolina -> "Opcional"
- Carro R$ 35k gasolina -> "Obrigatorio"
- Carro R$ 15k diesel -> "Obrigatorio"
- Moto R$ 7k -> "Opcional"
- Moto R$ 12k -> "Obrigatorio"
