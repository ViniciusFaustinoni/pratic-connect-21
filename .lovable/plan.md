## Diagnóstico

O Termo de Filiação **nunca chega ao SGA** por **três falhas combinadas** na cadeia Autentique → Documentos → SGA:

### 1. Insert do termo em `documentos` falha silenciosamente
Em `supabase/functions/autentique-webhook/index.ts` (linha 204), quando o contrato é assinado, o webhook tenta:
```ts
supabase.from("documentos").insert({ tipo: "contrato_assinado", ... })
```
Mas a coluna `documentos.tipo` é do enum `tipo_documento`, e esse enum **não contém `contrato_assinado`** (só CNH, CRLV, fotos do veículo etc.). O insert quebra com `invalid input value for enum`, o erro é apenas logado (`// Não falha a operação principal, apenas loga`) e **nenhum registro é gravado**. O PDF fica só em `contratos.pdf_assinado_url`.

Confirmado no banco: `contratos_documentos` tem 0 registros com `tipo='contrato_assinado'`; `documentos` também não aceita esse valor.

### 2. `sga-hinova-sync` não lê `contratos.pdf_assinado_url`
Em `supabase/functions/sga-hinova-sync/index.ts` (linhas 977–1010) a função monta `documentosEntrada` a partir de `documentos` + `contratos_documentos` + `associados.avatar_url` + `vistoria_fotos`. **O campo `contratos.pdf_assinado_url` nunca é consultado**, então mesmo se o insert da etapa 1 funcionasse, o PDF gerado direto em storage também ficaria fora do envio.

### 3. Não existe mapeamento `tipo_foto → contrato_assinado` na Hinova
Em `hinova_mapeamentos` (tipo `tipo_foto`) só há códigos 1–12 (CNH, CRLV, Comp. Residência, fotos do veículo, KM, RG, CPF). O `aliasTipo` em `_shared/hinova-payloads.ts` também não trata `contrato_assinado`. Mesmo que o documento existisse, ele cairia em `descartadasSemTipo` (visível nos logs `enviar_fotos_descarte`, onde já caem `laudo_vistoria`, `assinatura_cliente`, etc. pelo mesmo motivo).

> Observação: a Hinova expõe o endpoint `/veiculo/foto/cadastrar` que aceita PDF — então o termo pode ser enviado por essa mesma rota, desde que tenha um `codigo_tipo` válido na conta da regional.

---

## Plano de correção

### Passo 1 — Migração de banco
1. Adicionar valor `contrato_assinado` ao enum `tipo_documento` (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`).
2. Inserir linha em `hinova_mapeamentos`:
   - `tipo='tipo_foto'`, `codigo_local='contrato_assinado'`, `codigo_hinova=<código fornecido pelo usuário>`, `descricao='CONTRATO ASSINADO'`, `ativo=true`.
   - **Bloqueio:** preciso do número do tipo de foto correspondente no painel Hinova/SGA da PRATICCAR (ex.: 13, 14, 15…). Vou pedir antes de aplicar — se você não souber, podemos rodar `/tipo-foto/listar` na Hinova ou cadastrar lá primeiro.

### Passo 2 — `autentique-webhook` (e `autentique-sync-contrato`)
- Trocar a gravação de `documentos` para `contratos_documentos` (que é `varchar`, sem enum), mantendo `tipo='contrato_assinado'`, `cotacao_id` e `contrato_id`. Essa é a tabela já lida pelo `sga-hinova-sync`.
- Manter `contratos.pdf_assinado_url` igual (UI já depende).
- Replicar a mesma correção em `autentique-sync-contrato/index.ts` (mesmo bug nas linhas 74–94).

### Passo 3 — `sga-hinova-sync`
- Em `_shared/hinova-payloads.ts` `aliasTipo`, adicionar aliases:
  `contrato`, `termo`, `termo_filiacao`, `termo_afiliacao`, `contrato_assinado` → `contrato_assinado`.
- Em `index.ts` (bloco de fotos, ~linha 977), além do `or(associado_id, veiculo_id)` em `documentos`, **fazer fallback** para `contratos.pdf_assinado_url` quando não houver registro `contrato_assinado` em `contratos_documentos`. Isso cobre contratos antigos (145 já têm PDF mas nenhum registro em `contratos_documentos`).

### Passo 4 — Backfill (opcional, sob aprovação)
Script SQL/edge para varrer os 145 contratos com `pdf_assinado_url` preenchido e criar o registro correspondente em `contratos_documentos` (`tipo='contrato_assinado'`, `status='aprovado'`). Permite que o próximo `sga-hinova-sync` (manual ou via "Reprocessar" da fila) reenvie o termo para os já cadastrados na Hinova.

### Passo 5 — Verificação
1. Reprocessar um veículo na fila SGA pelo painel.
2. Conferir em `sga_sync_logs` action `enviar_fotos`: o `request_payload` deve agora conter o item com `codigo_tipo` do contrato.
3. Conferir no painel Hinova que o PDF aparece anexado ao veículo.

---

## Pergunta antes de aplicar

Para fechar o Passo 1 preciso do **código de tipo de foto da Hinova** que representa "Contrato/Termo de Filiação" na conta da PRATICCAR (sequência depois do 12=CPF).

- Você sabe esse código?
- Ou prefere que eu cadastre primeiro um `tipo_foto` novo na Hinova via API e depois grave o mapeamento?
