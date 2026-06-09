## Diagnóstico (com base no código, não em suposição)

KXL5D31 / COT-20260609-124904496-110:
- `tipo_entrada='inclusao'`, `cenario_adesao='isenta_rota'`, `status_contratacao='contrato_assinado'`
- `dados_extras.via_vistoria_sub_fipe = NULL` (cliente nunca chegou no seletor)
- 0 fotos, `vistoria_concluida_em IS NULL`
- Veículo é sub-FIPE → `fn_veiculo_precisa_rastreador=false`

Sub-FIPE no `EtapaVistoria.tsx` já tem 3 vias canônicas:
- **Via 1** `completa_celular` — 30 fotos + vídeo 360° (carro) / 10 + vídeo (moto)
- **Via 2** `rf_celular` — fotos R&F + vídeo 360°, depois agenda presencial
- **Via 3** `sem_fotos` — pula fotos pelo celular, agenda presencial direto

A via escolhida persiste em `cotacoes.dados_extras.via_vistoria_sub_fipe`.

**Causa raiz do erro:** `confirmar-adesao-zerada` (linhas 104–163) ignora `via_vistoria_sub_fipe`. O único escape do gate é `troca_titularidade`. Logo, qualquer cliente sub-FIPE que escolheu Via 3 (ou ainda não escolheu via, como KXL5D31) bate em `autovistoria_pendente` com 0 fotos. Não é processo novo — é o gate desalinhado das 3 vias que já existem.

Ordem canônica sub-FIPE permanece como é hoje (Plano → Documentos → Contrato → Pagamento → Vistoria). O ajuste é só no gate + numa proteção de UX pra impedir clicar "Confirmar adesão isenta" sem antes ter aberto a etapa 5 e escolhido a via.

---

## Parte 1 — Destrave de KXL5D31 (1ª rodada)

Como o cliente ainda não escolheu via, o destrave canônico é:
1. Confirmar com o associado **qual via ele quer** (presumivelmente Via 3 "sem fotos" — pela situação relatada).
2. Gravar `dados_extras.via_vistoria_sub_fipe='sem_fotos'` na cotação (única manipulação manual — apenas registra a escolha que ele faria pela UI).
3. Reenviar o link público; cliente reabre etapa 5 (Vistoria) → escolhe a via já marcada → vai para `sub_fipe_presencial_chooser` (agendamento presencial). Esse passo já cria/atualiza serviço de vistoria presencial pelo caminho normal do componente.
4. Após o cliente concluir o agendamento, o gate de `confirmar-adesao-zerada` precisa estar JÁ corrigido (Parte 2) pra reconhecer Via 3 e liberar a adesão isenta — caso contrário ele bate no mesmo erro. **Por isso o destrave real só completa após a Parte 2 mergeada.**

Se o associado preferir Via 1 ou 2, basta orientá-lo a tirar as fotos no link público — sem ação no banco.

Nenhum atalho de status ou criação de serviço fantasma: o cliente continua percorrendo o caminho canônico do link público intocável.

---

## Parte 2 — Correção raiz: gate respeitar as 3 vias sub-FIPE

Mexer **só** em `supabase/functions/confirmar-adesao-zerada/index.ts`. Manter a ordem do stepper, manter as 3 vias existentes, manter o componente `EtapaVistoria`.

### Regras do gate por via (todas dentro do `if (isSubFipe)` existente)

Ler `via = (cotacaoMeta as any)?.dados_extras?.via_vistoria_sub_fipe` logo no início do bloco sub-FIPE e decidir:

- `via === 'completa_celular'` (Via 1) — mantém o comportamento atual: chama `checarCompletudeAutovistoriaSubFipe(...)`. Bloqueia com 409 `autovistoria_pendente` se incompleta. (sem mudança funcional)
- `via === 'rf_celular'` (Via 2) — exige só as fotos obrigatórias do conjunto R&F (`obrigatoriasParaTipoRF` — adicionar helper em `_shared/fotosVistoriaSubFipe.ts`) + vídeo 360°. Se completo, libera. Senão, 409 `autovistoria_rf_pendente`.
- `via === 'sem_fotos'` (Via 3) — libera o gate sem checar fotos. A vistoria presencial é responsabilidade do back-office (já materializada pelo fluxo do `sub_fipe_presencial_chooser`).
- `via == null` (cliente clicou em confirmar isenta sem escolher via) — 409 novo `via_sub_fipe_nao_escolhida` com mensagem "Escolha como será sua vistoria na etapa 5 antes de confirmar a adesão isenta."

Escape `troca_titularidade` continua acima desse bloco, intacto.

### Defesa em profundidade na UI (mínima, dentro de presentation/frontend)

No `EtapaPagamentoCotacao.tsx`, antes de chamar `confirmarAdesaoIsenta('adesao_zerada', …)`, checar `cotacao.dados_extras?.via_vistoria_sub_fipe`. Se sub-FIPE e via não escolhida, em vez de chamar a edge, mostrar toast "Volte à etapa Vistoria para escolher como sua vistoria será feita." e (idealmente) navegar o `etapaAtual` pra 4 (índice da vistoria). Sem reordenar steps, sem mudar fluxo, só evita o 409 ruim e direciona o usuário.

### Memória canônica

Atualizar `mem://logic/operations/sub-fipe-gates-canonicos` para registrar:
- Gate de `confirmar-adesao-zerada` agora reconhece as 3 vias sub-FIPE canonicamente (Via 1 completa, Via 2 R&F, Via 3 sem fotos liberada para back-office).
- `via_vistoria_sub_fipe='sem_fotos'` é caminho oficial; ausência de via é erro do cliente, não do back-end.
- Inclusão sub-FIPE segue exatamente o mesmo ciclo de adesão sub-FIPE — não há gate específico de inclusão.

---

## Detalhes técnicos

### Arquivos tocados
- `supabase/functions/confirmar-adesao-zerada/index.ts` — branch por via no bloco `isSubFipe`.
- `supabase/functions/_shared/fotosVistoriaSubFipe.ts` — novo helper `obrigatoriasParaTipoRF` e variante `checarCompletudeAutovistoriaSubFipeRF`.
- `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx` — guard local + redirect pra etapa 5 quando sub-FIPE sem via escolhida.
- Memória `mem://logic/operations/sub-fipe-gates-canonicos`.

### Sem mudanças em
- `EtapaVistoria.tsx`, `CotacaoContratacao.tsx` (ordem do stepper preservada).
- Triggers DB, `aprovar-proposta`, `finalizar-autovistoria-cotacao`.
- Fluxo acima-FIPE (autovistoria opcional enxuta) — branch isolado.

### Validação
1. Reenviar KXL5D31: associado escolhe Via 3 → agenda presencial → confirma adesão isenta → passa direto, contrato segue pra Cadastro/Monitoramento via caminho canônico de `vistoria-sem-rastreador-flow`.
2. Cotação sub-FIPE nova Via 1 incompleta → continua bloqueada (regressão zero).
3. Cotação sub-FIPE Via 2 com fotos R&F + vídeo → libera.
4. Cotação sub-FIPE sem via escolhida → 409 didático + redirect UI.
5. Cotação acima-FIPE isenta → comportamento idêntico ao atual.

### Manual data fix (proposto, depende de aprovação)
```
UPDATE cotacoes
SET dados_extras = jsonb_set(coalesce(dados_extras,'{}'::jsonb), '{via_vistoria_sub_fipe}', '"sem_fotos"')
WHERE id = 'fb3a2b12-4b98-466e-b8c4-4ff4d2c063d4';
```
Só rodar **após** o cliente confirmar por WhatsApp que quer Via 3. Se preferir Via 1 ou 2, não rodar — basta orientá-lo a tirar as fotos.
