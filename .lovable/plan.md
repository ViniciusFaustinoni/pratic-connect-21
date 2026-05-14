## Diagnóstico do estado atual

Para sub-FIPE (carro <30k / moto <9k não-Diesel), hoje:

1. Cliente conclui plano → docs → termo → pagamento → autovistoria 31/15 no link público. ✅ já existe.
2. `finalizar-autovistoria-cotacao` materializa `vistorias` + `vistoria_fotos` + `servicos.tipo='vistoria_entrada' status='concluida'` → **vai DIRETO para a fila Monitoramento › Aprovação de Associados**, pulando o Cadastro.
3. Monitoramento aprova OU pede vistoria de técnico via `solicitar-vistoria-tecnico-sub-fipe` (já existe, só fotos, sem instalação). Pós-vistoria volta para Monitoramento via `aplicar-conclusao-vistoria`. Aprovação final chama `ativar-associado` → SGA. ✅ já existe.

**Gap:** falta o passo **Cadastro analisa autovistoria → libera Roubo/Furto → manda pro Monitoramento**. Hoje o Cadastro é pulado nesse fluxo.

## Mudanças propostas

### 1. `supabase/functions/finalizar-autovistoria-cotacao/index.ts`
- Detectar sub-FIPE (`!precisaRastreador(...)`) carregando `veiculos.valor_fipe`, `combustivel`, `categoria`.
- Se sub-FIPE: criar `servicos` com `status='em_analise'` (não `concluida`) e tag `[AUTOVISTORIA_AGUARDA_CADASTRO]` em `observacoes`.
- Atualizar `cotacoes.status_contratacao='aguardando_aprovacao_cadastro'`.
- Se ≥30k continua igual (não muda nada).

### 2. Cadastro › Propostas Pendentes
- `src/pages/cadastro/PropostasPendentes.tsx` + `PropostaAnalise.tsx`: detectar sub-FIPE com autovistoria já concluída e exibir um painel de análise da autovistoria (fotos via `useFotosByVistoriaId` + vídeo 360° + docs já anexados via `DocumentosAnexadosPanel`).
- 3 ações: **Aprovar (libera Roubo/Furto)** | **Solicitar documentos** | **Reprovar**.
- Badge específico no card da fila para diferenciar de propostas com rastreador.

### 3. Edge nova `aprovar-cadastro-sub-fipe`
- Service role; recebe `cotacaoId`.
- Idempotente: se já promovido, retorna sucesso.
- Marca `contratos.cadastro_aprovado=true`, `veiculos.cobertura_roubo_furto=true`.
- Promove `servicos` (`vistoria_entrada` da cotação) de `em_analise` → `concluida` → entra na fila do Monitoramento.
- Atualiza `cotacoes.status_contratacao='aguardando_aprovacao_monitoramento'`.
- Insere `associados_historico` `cadastro_aprovou_autovistoria_sub_fipe`.
- **Não** chama `ativar-associado` (segue regra: ativação só pelo Monitoramento).

### 4. Monitoramento › Aprovação
- Sem mudanças estruturais — o caso já chega na fila assim que o serviço vira `concluida`.
- Confirmar UI: botão "Solicitar Vistoria de Técnico" (já existe via `useSolicitarVistoriaTecnico`) e botão Aprovar (já chama `ativar-associado`). Pós-vistoria do técnico → `aplicar-conclusao-vistoria` devolve para Monitoramento (já existe).

### 5. Documentação
- Atualizar `mem://logic/operations/vistoria-sem-rastreador-flow` para descrever o passo do Cadastro entre autovistoria e Monitoramento, e a liberação de Roubo/Furto na aprovação do Cadastro.
- Atualizar `mem://logic/operations/autovistoria-materializa-vistoria` para refletir o novo destino (`em_analise` para sub-FIPE, `concluida` para ≥30k).

## Fora de escopo

- Fluxo ≥30k (com rastreador) — inalterado.
- Etapas de plano/docs/termo/pagamento — inalteradas.
- `solicitar-vistoria-tecnico-sub-fipe`, `aplicar-conclusao-vistoria`, `ativar-associado` — já atendem.
- Cron de expiração / link público (sem mudanças visuais).

## Notas técnicas

- Sem novas tabelas/colunas — reaproveitamos `cadastro_aprovado`, `cobertura_roubo_furto`, `status_contratacao` e `servicos.status`.
- **Backfill:** cotações sub-FIPE já em `aguardando_aprovacao_monitoramento` sem `cadastro_aprovado=true` ficam onde estão (não retroceder casos vivos); novos seguem o fluxo novo.
- Chamadas repetidas de `aprovar-cadastro-sub-fipe` são seguras (idempotentes por `servicos.status`/`cadastro_aprovado`).
