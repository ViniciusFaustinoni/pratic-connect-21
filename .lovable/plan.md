## Diagnóstico (raiz)

Auditando o caso do contrato KXT0874 (DAVID VIEIRA DOS SANTOS / Marcos Vinícius), encontrei **dois bugs distintos** na geração do termo:

### Bug 1 — `{{veiculo.categoria}}` imprime tipo de carroceria, não a CATEGORIA do CRLV

- No CRLV, **CATEGORIA** = uso jurídico do veículo: **Particular** ou **Aluguel**.
- No nosso schema, `contratos.veiculo_categoria` está guardando `"carro"` (vem da `cotacoes.categoria`, que na verdade é o tipo de veículo). 
- O termo (`template-utils.ts:172` e `termo-afiliacao-utils.ts:430`) usa esse campo direto → imprime "carro" no contrato.
- A informação correta JÁ EXISTE: `cotacoes.veiculo_tipo_uso = 'particular'` e `contratos.uso_aplicativo` (boolean). Não foi propagada.

### Bug 2 — `{{veiculo.portas}}` é INFERIDA por categoria → sempre cai em 4

- `termo-afiliacao-utils.ts:359` (`inferirPortas`) chuta 4 portas para qualquer "carro".
- `template-utils.ts:181` tem fallback hardcoded `?? 4`.
- Resultado: Celta 2P imprime "4 portas" no contrato vs. 2 no CRLV.
- A `plate-lookup` já retorna `numero_portas` da API, mas esse dado **não é persistido** em `cotacoes`/`veiculos`/`contratos` hoje.

---

## Correções na raiz (sem afetar o que funciona)

### 1. `supabase/functions/_shared/termo-afiliacao-utils.ts`

- **Remover** a função `inferirPortas` e o uso dela.
- Adicionar campo `tipo_veiculo` (carro/moto) separado de `categoria` no objeto.
- Em `mapearDadosParaTemplate`:
  - `veiculo.categoria` ← derivar de `uso_aplicativo`: `true → "Aluguel"`, `false → "Particular"`. Se vier `veiculo_tipo_uso` explícito (`'aluguel'`/`'particular'`), respeitar.
  - `veiculo.tipo_veiculo` ← guardar o atual `"carro"`/`"moto"` (vem de `contrato.veiculo_categoria`).
  - `veiculo.portas` ← ler de `veiculoDB?.numero_portas` ou `cotacao?.numero_portas`; **sem fallback numérico**.

### 2. `supabase/functions/_shared/template-utils.ts`

- `'veiculo.categoria'` → mostrar `Particular`/`Aluguel` conforme regra acima (não mais o tipo de carroceria).
- `'veiculo.tipo'` → manter como tipo de veículo (carro/moto/utilitário) — separar das duas variáveis.
- `'veiculo.portas'` → `dados.veiculo.portas ? String(dados.veiculo.portas) : '—'` (parar de chutar 4).
- `'veiculo.tipo_uso'` → continua mostrando "Particular"/"Aplicativo" (não mexe; é variável diferente).

### 3. Persistência do `numero_portas` (mínima, sem migration de schema)

- `contratos.veiculo_categoria` permanece intocado no banco para compatibilidade (continua "carro"); o termo deixa de usá-lo como CATEGORIA.
- Para portas: adicionar coluna `cotacoes.numero_portas INTEGER NULL` via migration (campo opcional, sem default — não quebra nada). 
- Em `EtapaConsultaFipe.tsx`, quando o `vehicleData.numero_portas` vier preenchido, gravar na cotação (já há fluxo de update por placa).
- Em `contrato-gerar/index.ts`, ao criar o contrato, copiar `cotacao.numero_portas` para um campo equivalente. Como `contratos` não tem coluna ainda, adicionar `contratos.veiculo_numero_portas INTEGER NULL`.
- O termo lê dessa coluna se existir; se não, mostra "—".

### 4. Backfill leve do registro afetado

- Atualizar a cotação/contrato de `KXT0874` para `numero_portas = 2` (consta no CRLV anexado pelo usuário) e regerar o termo, validando antes de fechar.

---

## Arquivos a tocar

```text
supabase/functions/_shared/termo-afiliacao-utils.ts   (lógica categoria + portas)
supabase/functions/_shared/template-utils.ts          (variáveis do template)
supabase/functions/plate-lookup/index.ts              (já retorna numero_portas — só conferir)
supabase/functions/contrato-gerar/index.ts            (copiar numero_portas da cotação p/ contrato)
src/components/cotacao/EtapaConsultaFipe.tsx          (persistir numero_portas vindo da plate-lookup)
supabase/migrations/<novo>.sql                         (ADD COLUMN numero_portas em cotacoes e contratos)
```

## O que NÃO muda (zero regressão)

- `contratos.veiculo_categoria` continua sendo gravado igual — qualquer relatório/integração que lê esse campo segue funcionando.
- `veiculo_tipo_uso`, flags de depreciação, fluxo Hinova, fluxo de assinatura, vistoria e tudo mais permanecem intocados.
- A variável `{{veiculo.tipo_uso}}` segue mostrando Particular/Aplicativo (semântica diferente — é a comercial, não a do CRLV).
- Apenas as variáveis do template `{{veiculo.categoria}}` e `{{veiculo.portas}}` mudam de comportamento.

## Validação

1. Regerar termo do contrato KXT0874 → verificar Categoria = "Particular" e Portas = "2".
2. Smoke test: criar uma cotação nova → conferir que `numero_portas` persiste e aparece no termo.
3. Caso o `plate-lookup` falhe ou a API não retorne portas, o termo deve imprimir "—" sem quebrar.
