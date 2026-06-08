# Diagnóstico — COT-20260606-142420151-266 (PATRICK · LTP7C50 ← RJN2A96)

## Estado no banco

- `cotacoes` 3a2147db: `tipo_entrada='substituicao_placa'`, `dados_extras.tipo_entrada='substituicao_placa'`, `dados_extras.solicitacao_substituicao_id=a8194750…`, `dados_extras.veiculo_antigo_id=9d4ca07a…` (RJN2A96), `status_contratacao='aguardando_aprovacao_cadastro'`, `vistoria_completa_data_agendada='2026-06-09 tarde'`, `tipo_vistoria='autovistoria'`, `contrato_gerado_id=6786afcc…`.
- `contratos` 6786afcc: `status='assinado'`, `tipo_entrada='substituicao_placa'`, `autentique_documento_id` presente (termo da Autentique foi disparado — mas como **termo de filiação**, não de substituição — ver bug raiz #2).
- `servicos` da cotação: **apenas 1 linha** — `vistoria_entrada` modalidade `autovistoria` (e6c1d6ef…), status `em_analise`. **Nenhum** `instalacao` nem `vistoria_retirada`.
- `agendamentos_base` da cotação: **vazio**. `instalacoes` da cotação: **vazio**.
- `substituicoes_veiculo` para o associado/contrato: **vazio** — a entidade canônica nunca foi materializada.
- `solicitacoes_substituicao_placa` a8194750: `status='cotacao_criada'`, `termo_cancelamento_*` todos `null` (esperado — substituição usa o próprio termo de filiação como cancelamento, não o termo da troca).
- Veículos: `LTP7C50` em `em_analise` (novo, ok), `RJN2A96` ainda `ativo` (antigo, esperado até efetivar).
- Edge functions invocadas: `efetivar-substituicao`, `criar-substituicao-agendamentos-separados` e `enviar-termo-cancelamento-substituicao` **nunca rodaram** para esta cotação.

## Bug raiz

Existem **3 leituras** comparando `tipo_entrada` com o literal errado `'substituicao'` (canônico é `'substituicao_placa'`, ver `mem://constraints/contracts/tipo-entrada-substituicao-canonical`):

1. `src/pages/public/CotacaoContratacao.tsx:173`
   ```ts
   const isSubstituicao = dadosExtras?.tipo_entrada === 'substituicao';
   ```
   Como `dados_extras.tipo_entrada` vem `'substituicao_placa'` (escrita normalizada pelo `normalizarTipoEntrada`), `isSubstituicao` ficou **permanentemente `false`** no link público. Resultado: o associado nunca viu o seletor "mesmo local / locais separados" nem o componente `AgendamentoSubstituicaoSeparado`. Como o veículo tem FIPE R$ 70.995 (> R$ 30k), o caminho "adesão acima do mínimo" abriu a **autovistoria enxuta opcional** — que NÃO existe em substituição (canônico passo 7 exige instalação física + retirada). O cliente fez a autovistoria, a cotação foi promovida para `aguardando_aprovacao_cadastro`, e o caminho de substituição (retirada do antigo, termo de substituição, materialização em `substituicoes_veiculo`) nunca ocorreu.

2. `supabase/functions/autentique-create/index.ts:275` e
3. `supabase/functions/autentique-create-by-token/index.ts:473`
   Mesma comparação errada → o termo gerado para o contrato 6786afcc saiu como "Proposta de Filiação", não como "Proposta de Substituição".

## Plano

### Parte 1 — Saneamento do caso (PATRICK)

Objetivo: reabrir o caminho canônico para o associado agendar **instalação no veículo novo + retirada no antigo** sem refazer cotação/pagamento.

1. Cancelar/limpar o ramo da autovistoria que se materializou indevidamente:
   - `UPDATE servicos SET status='cancelada', motivo_cancelamento='saneamento: substituição não permite autovistoria — fluxo canônico exige instalação+retirada presencial', cancelada_em=now() WHERE id='e6c1d6ef-b528-447d-833f-a16d2cafc50a'`.
   - `UPDATE vistorias SET status='cancelada' WHERE id='9214bb9d-bad1-40dd-bfab-1eeac3a43d88'` (e marcar fotos como descartadas se houver).
2. Devolver a cotação ao ponto de agendamento (mantém pagamento e contrato):
   - `UPDATE cotacoes SET status_contratacao='aguardando_agendamento', vistoria_concluida_em=NULL, vistoria_completa_data_agendada=NULL, vistoria_completa_periodo=NULL, tipo_vistoria=NULL WHERE id='3a2147db-…'`.
   - Limpar bandeiras de cadastro promovido: `UPDATE contratos SET cadastro_aprovado=false, aprovado_em=NULL, documentos_aprovados_em=NULL WHERE id='6786afcc-…'` (já estão `false`/`null` — defesa).
3. Reabrir o link público (sem invalidar token). Após o fix da Parte 2, o link já vai renderizar `AgendamentoSubstituicaoSeparado` → cliente agenda os 2 serviços → `criar-substituicao-agendamentos-separados` materializa retirada + instalação + `substituicoes_veiculo`.
4. Comunicar o associado por WhatsApp com o link existente — não disparar novo termo (contrato 6786afcc já assinado é aproveitado).

Tudo via migration única (sem alterar schema, só dados) com auditoria em `logs_auditoria`.

### Parte 2 — Correção definitiva (impedir reincidência)

1. **Trocar o literal errado nos 3 pontos** para usar `normalizarTipoEntrada` (já existe em `src/lib/cotacoes/tipoEntrada.ts` e `supabase/functions/_shared/tipo-entrada.ts`) ou comparar explicitamente com `'substituicao_placa'` aceitando o alias `'substituicao'` como defesa em profundidade:
   - `src/pages/public/CotacaoContratacao.tsx:173`
   - `supabase/functions/autentique-create/index.ts:275`
   - `supabase/functions/autentique-create-by-token/index.ts:473`

2. **Bloquear autovistoria em substituição no link público**: em `CotacaoContratacao.tsx`, na seção que decide entre autovistoria/agendamento (ramo "FIPE acima do mínimo"), forçar `tipoVistoria='presencial'` quando `isSubstituicao=true` e nunca renderizar o cartão de autovistoria opcional (canônico passo 7).

3. **Guard backend (defesa em profundidade)**: em `supabase/functions/finalizar-autovistoria-cotacao/index.ts`, rejeitar com `409 { code: 'autovistoria_nao_permitida_em_substituicao' }` quando `cotacoes.tipo_entrada='substituicao_placa'` (ou `dados_extras.solicitacao_substituicao_id` presente). Garante que, mesmo se o front regredir, o banco não promove a cotação por autovistoria.

4. **Atualizar memória `mem://constraints/contracts/tipo-entrada-substituicao-canonical`** com o aprendizado: leitores DEVEM normalizar; literal `'substituicao'` jamais aparece em DB nem deve ser comparado diretamente. Linkar este caso (LTP7C50 / COT-20260606-142420151-266) como evidência.

### Fora de escopo

- Não mexer no fluxo de troca de titularidade.
- Não criar novo edge nem nova tabela — a infra de substituição já está completa (`criar-substituicao-agendamentos-separados`, `efetivar-substituicao`, `substituicoes_veiculo`), só não foi acionada por causa do `if` quebrado.
- Não alterar `dados_extras.tipo_entrada` em cotações antigas — a normalização escreve `substituicao_placa`; o que estava errado eram os LEITORES.

## Critério de aceite

- Reabrindo o link público do PATRICK após o saneamento, aparece o seletor "mesmo local / locais separados" e ao confirmar locais separados o componente `AgendamentoSubstituicaoSeparado` deixa o cliente agendar instalação (LTP7C50) e retirada (RJN2A96). Ao confirmar, `criar-substituicao-agendamentos-separados` materializa 2 serviços + `substituicoes_veiculo`.
- Nova cotação `tipo_entrada='substituicao_placa'` no link público nunca mais oferece autovistoria; tentar invocar `finalizar-autovistoria-cotacao` para uma substituição retorna 409.
- Novo contrato de substituição é enviado à Autentique com o rótulo "Proposta de Substituição".
