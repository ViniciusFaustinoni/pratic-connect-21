## Contexto consolidado

- Probe nos códigos 13–20 retornou `200 / "Inserido"` em todos.
- Conferência visual no SGA (vehículo 36183 / KOU-6D37) mostrou os 8 PDFs **sem rótulo na coluna "Tipo Imagem/Documento"** — nenhum dos códigos 13–20 está mapeado nessa regional.
- Conclusão: a numeração correta de "Termo de Filiação", "Nota Fiscal", "CRLV" etc. é definida na regional Praticcar e precisa vir do suporte Hinova. A API não valida o número.
- Em paralelo, o `dia_vencimento` está sendo enviado correto pelo sistema mas chega errado no SGA — isso é independente do mapeamento de fotos e deve ser corrigido agora.

## Plano

### 1. Solicitação à Hinova (fora do código)

Você abre chamado pedindo:
- Tabela oficial `codigo_tipo` × rótulo da regional Praticcar para o endpoint `cadastrar-fotos` (associado e veículo).
- Confirmação de qual código corresponde a: **Termo de Filiação / Contrato**, **Nota Fiscal do Veículo**, **CRLV**, **CNH**, **Comprovante de Endereço**, **Foto Veículo (frente/lateral/etc.)**, **Chassi**, **Motor**.
- Lista da regional (não a genérica da Hinova).

Sem essa tabela, qualquer mapeamento que eu chutar continuará caindo na lixeira "sem tipo" igual aos probes 13–20.

### 2. Tornar o mapeamento configurável (preparar terreno)

Hoje os códigos estão hardcoded em edge functions. Mudo para a tabela `hinova_mapeamentos` que já existe, com seed vazio para os tipos faltantes:

- Adicionar entradas `tipo='tipo_foto_sga'` com `codigo_local` ∈ {`contrato_assinado`, `nota_fiscal_veiculo`, `crlv`, `cnh`, `comprovante_endereco`, `foto_veiculo_frente`, `foto_chassi`, `foto_motor`} e `codigo_hinova = NULL` + `ativo=false`.
- Edge `sga-hinova-sync` e qualquer outra que chame `cadastrar-fotos` passam a ler dessa tabela. Quando `codigo_hinova IS NULL` ou `ativo=false`, **pula o envio dessa foto** e loga `mapping_pendente` (em vez de mandar um número errado).
- Quando a Hinova devolver os números, você (ou eu via migration de 1 linha) preenche `codigo_hinova` + marca `ativo=true` e o sistema passa a enviar sem deploy.

Benefício: a próxima descoberta de código (ou correção de regional) vira UPDATE de 1 linha, não nova edge.

### 3. Limpeza do probe

- Remover edge `probe-tipo-foto-contrato` (já cumpriu o papel).
- Deletar do SGA os 8 PDFs `probe_termo_filiacao_tipo_13..20` do veículo 36183 (manual no painel — não tem endpoint público de delete confiável).

### 4. Fix do `dia_vencimento` (independente, paralelo)

Já tinha sido mapeado anteriormente. Resumo do que aplico:

- Auditar `sga-hinova-sync` / `cadastrar-associado-sga`: hoje o `dia_vencimento` vem do contrato local mas é convertido em data completa antes de enviar — em alguns caminhos o dia está sendo recalculado a partir de `created_at` (timezone UTC) e cai 1 dia antes para vencimentos perto da virada do mês.
- Forçar envio do **número puro do dia** (1–31) lido de `contratos.dia_vencimento` (BRT), sem reconstruir data.
- Validar com 2 contratos de homologação cobrindo dias 1, 15 e 31.
- Registrar em `mem://logic/integrations/sga-dia-vencimento-fonte` que o campo é número 1–31 lido direto de `contratos.dia_vencimento` (sem timezone).

## Detalhes técnicos

- Tabela: `hinova_mapeamentos (tipo text, codigo_local text, codigo_hinova int, descricao text, ativo bool)` — já existe; só insiro linhas novas.
- Edges tocadas no item 4: `sga-hinova-sync/index.ts` (e helpers de payload). Sem mudança de schema.
- Edges tocadas no item 2: helper compartilhado de `cadastrar-fotos` (criar `_shared/sga-tipo-foto.ts` que resolve `codigo_local → codigo_hinova` via tabela; cache em memória por invocação).
- Migration para deletar a edge `probe-tipo-foto-contrato` via `supabase--delete_edge_functions`.

## Fora de escopo

- Adivinhar mais códigos sem confirmação da Hinova.
- Mexer em qualquer outra integração SGA (situação, RENAVAM, etc.).
