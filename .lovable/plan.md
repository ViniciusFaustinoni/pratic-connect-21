

# Corrigir Valor da Cota de Coparticipacao na Cobranca

## Problema

A cobranca da cota de coparticipacao esta sendo gerada com R$ 750,00 (valor padrao fixo) em vez do valor correto calculado com base na FIPE e no plano do associado.

## Causa Raiz

A Edge Function `aprovar-sinistro` calcula a cota dinamicamente (% da FIPE ou minimo do plano), porem a query de busca do sinistro na linha 38-43 nao inclui os campos necessarios para o calculo:

```text
SELECT: id, protocolo, status, tipo
JOIN veiculo: placa, marca, modelo  <-- FALTA "id"
```

Como o campo `id` do veiculo nao e selecionado, a variavel `veiculoId` fica `undefined`. A busca separada por `valor_fipe` nunca retorna dados e o calculo falha silenciosamente. Resultado: `valorCotaCalculado` permanece `null` e o campo `valor_cota_participacao` nunca e atualizado na aprovacao.

Quando o `autentique-webhook` detecta a assinatura do termo e gera a cobranca no Asaas, ele usa o valor armazenado `sinistro.valor_cota_participacao` que esta com o valor padrao de R$ 750,00 ou zerado.

## Solucao

### 1. Corrigir select na `aprovar-sinistro`

**Arquivo:** `supabase/functions/aprovar-sinistro/index.ts`

Adicionar `id` ao join de veiculos na query:
- De: `veiculo:veiculos!sinistros_veiculo_id_fkey(placa, marca, modelo)`
- Para: `veiculo:veiculos!sinistros_veiculo_id_fkey(id, placa, marca, modelo)`

Isso garante que `(sinistro.veiculo as any)?.id` retorne o ID correto, permitindo a busca de `valor_fipe` e o calculo dinamico da cota.

### 2. Adicionar log de fallback quando calculo falha

**Arquivo:** `supabase/functions/aprovar-sinistro/index.ts`

Adicionar log de aviso caso `valorCotaCalculado` fique `null` apos a tentativa de calculo, para facilitar diagnostico futuro.

### 3. Garantir que `autentique-webhook` tambem recalcule (defesa em profundidade)

**Arquivo:** `supabase/functions/autentique-webhook/index.ts`

Na secao de geracao de cobranca (linha 472-550), antes de usar `sinistroDoc.valor_cota_participacao`, adicionar uma validacao:
- Se `valor_cota_participacao` for 0 ou igual ao valor padrao (750), recalcular a cota dinamicamente buscando o plano e o valor FIPE
- Usar o valor recalculado para a cobranca
- Atualizar o campo no sinistro com o valor correto

Isso funciona como fallback caso a aprovacao nao tenha calculado corretamente.

## Detalhes Tecnicos

### Calculo esperado para o caso reportado

```text
Veiculo: valor_fipe = R$ 70.008,00
Plano: cota_participacao = 6%, cota_minima = R$ 1.200,00
Calculo: max(70008 * 6 / 100, 1200) = max(4200.48, 1200) = R$ 4.200,48
Valor cobrado (errado): R$ 750,00
```

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/aprovar-sinistro/index.ts` | Adicionar `id` ao select de veiculos + log de fallback |
| `supabase/functions/autentique-webhook/index.ts` | Recalcular cota se valor armazenado for inconsistente |
