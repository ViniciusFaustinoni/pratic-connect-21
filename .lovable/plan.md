## Objetivo

Parar de descartar Contrato/Termo e Nota Fiscal na sincronização SGA. Subir agora com **códigos de teste** (já validados como aceitos pela Hinova) — mesmo que apareçam sem rótulo ou no rótulo errado no painel SGA. Quando o suporte Hinova devolver os códigos oficiais da regional Praticcar (ou descobrirmos pelo `QOO5C17 / 1659789`), basta 1 UPDATE em `hinova_mapeamentos` — sem deploy.

## Contexto

- Probe confirmou: Hinova aceita qualquer `codigo_tipo` numérico com `200 / "Inserido"`; não valida contra tabela.
- Códigos 1–12 já mapeados (CNH, CRLV, fotos do veículo, RG, CPF).
- Códigos 13–20 foram aceitos no probe mas caíram em "sem tipo" no painel.
- Veículo QOO5C17 mostra um contrato real categorizado como "DOCUMENTOS BENEFICIARIO" — número desconhecido.

## Plano

### 1. Ativar placeholders com códigos de teste

`UPDATE` em `hinova_mapeamentos` (linhas já criadas inativas no turno anterior):

| codigo_local | codigo_hinova (teste) | ativo |
|---|---|---|
| `contrato_assinado` | **13** | true |
| `termo_filiacao` | **13** | true |
| `contrato` | **13** | true |
| `nota_fiscal_veiculo` | **14** | true |
| `nota_fiscal` | **14** | true |

Resultado imediato: próxima sync de qualquer veículo passa a enviar contrato assinado e NF para o SGA. Eles podem aparecer sem rótulo ou com rótulo "errado" — mas o arquivo entra.

### 2. Marcar como temporário na descrição

Atualizo a `descricao` das 5 linhas para deixar explícito no banco que é código provisório, ex.:
`"CONTRATO/TERMO DE FILIAÇÃO — código de teste 13 (aguardando confirmação oficial Hinova)"`.

Assim qualquer dev/operador que abrir a tabela vê que é placeholder, não definitivo.

### 3. Quando a Hinova responder (ou QOO5C17 revelar o código)

Único passo: `UPDATE public.hinova_mapeamentos SET codigo_hinova = <oficial>, descricao = '<oficial>' WHERE tipo='tipo_foto' AND codigo_local IN (...)`.
Nada de código pra mudar, nada de redeploy.

### 4. Atualizar memória

Atualizar `mem://logic/integrations/sga-dia-vencimento-fonte`? Não — ela é sobre dia_vencimento.

Criar/ajustar nota em `mem://integrations/hinova/tipo-foto-contrato-temporario` (curta) registrando: **os códigos 13 (contrato) e 14 (NF) são provisórios**, devem ser trocados pelos oficiais assim que a Hinova confirmar; o sistema ENVIA mesmo sem rótulo correto por decisão de negócio (preferimos doc no SGA com rótulo errado a doc não enviado).

## Detalhes técnicos

- Migration: 1 `UPDATE` afetando 5 linhas. Sem mudança de schema.
- Nenhuma edge function precisa ser tocada — `buildFotosPayload` já resolve via tabela e respeita `ativo=true`.
- Não vou deployar nada (não há código mudando).

## Fora de escopo

- Mexer no `dia_vencimento` (já fixado no turno anterior).
- Adivinhar mais códigos / fazer novos probes.
- Deletar os PDFs de probe do veículo 36183 (manual no painel SGA).
