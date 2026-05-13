## Fluxo unificado para veículos sub-FIPE (sem rastreador)

Regras de elegibilidade (já existentes — não mexer):
- Carro FIPE < R$ 30.000 não-Diesel → sem rastreador
- Moto FIPE < R$ 9.000 não-Diesel → sem rastreador
- Função canônica: `exigeRastreador()` em `src/types/termo-filiacao.ts` e `supabase/functions/_shared/template-utils.ts`

### Fluxo alvo

```text
Link público (sub-FIPE)
  └─ Plano → Documentos → Contrato → VISTORIA (31 carro / 15 moto, mesmo set do instalador)
                                          │
                                          ▼ (sem agendamento, sem escolha de modalidade)
                                       Pagamento
                                          │
                                          ▼
                                       Cadastro
                                          │
                                          ▼
                            Monitoramento › Aprovação de Associados
                                          │
                ┌─────────────────────────┼─────────────────────────┐
                ▼                         ▼                         ▼
           Aprovar               Solicitar Vistoria             Reprovar
        (ativa proteção)       (técnico presencial)          (já existente)
                                          │
                                          ▼
                       servicos.tipo = 'vistoria_entrada'
                       (sem instalação, mesmas 31/15 fotos)
                       cenário Rota/Base + repasse mínimo
                       Base = gratuita; Rota = R$25
                                          │
                                          ▼ Técnico executa
                              Volta para Aprovação Monitoramento
```

### Mudanças

**1. Link público (`src/components/cotacao-publica/EtapaVistoria.tsx` + `CotacaoContratacao.tsx` + `useCotacaoContratacao.ts`)**
- Quando `exigeRastreador(veiculo).exige === false`, a etapa Vistoria NÃO mostra mais os 3 cards (autovistoria/técnico/base). Renderiza diretamente um novo componente `VistoriaSubFipeCotacao` que reaproveita `vistoriaConfigCompleta.ts` (31 carro / 15 moto) — mesmo set que o instalador usa.
- `tipo_vistoria` da cotação passa a aceitar valor `'autovistoria_completa_sub_fipe'` (cotação só nasce nesse formato quando elegível). Para fluxo ≥FIPE nada muda.
- Reusa hooks `useFotosCotacaoVistoria`/`useUploadFotoCotacaoVistoria` existentes; só troca a fonte de fotos (config completa ao invés do array de 9).
- Após upload da última foto, finalizar vistoria igual hoje (`useFinalizarVistoriaCotacao`) e seguir para Pagamento.

**2. Pós-pagamento (`supabase/functions/criar-instalacao-pos-pagamento/index.ts` + `aprovar-proposta`)**
- Sub-FIPE com vistoria já enviada → NÃO cria `servicos.tipo = 'instalacao'` nem `agendamentos_base`. Cria diretamente registro de `vistorias` (a partir das fotos da cotação) + envia para fila Monitoramento › Aprovação de Associados, igual ao caminho atual de "vistoria sem rastreador" mas sem etapa de campo prévia.
- Reaproveita o trigger/edge `aplicar-conclusao-vistoria` que materializa fotos.

**3. Tela de aprovação Monitoramento (`src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx` + `useAprovacaoMonitoramento.ts`)**
- Adicionar terceiro botão `Solicitar Vistoria de Técnico` ao lado de Reprovar/Aprovar, visível SOMENTE quando o serviço/veículo é sub-FIPE (`exigeRastreador === false`).
- Botão abre dialog "Solicitar Vistoria Presencial" com: motivo (textarea obrigatória) + escolha Rota/Base (default conforme cenário da cotação original) + data/período se Rota.
- Dispara nova edge function `solicitar-vistoria-tecnico-sub-fipe`:
  - Cria `servicos.tipo = 'vistoria_entrada'` com flag `dados_extras.escopo = 'vistoria_sem_instalacao'` e `dados_extras.fotos_obrigatorias = 31|15`.
  - Cria `agendamentos_base` ou agendamento Rota conforme escolha (respeitando dedupe — fechar antigos primeiro).
  - Marca o registro de aprovação atual como `pendente_revistoria` (não ativa proteção, não reprova).
  - Reverte `veiculos.status` para `instalacao_pendente` (mantém suspensão de cobertura existente).
  - Aplica repasse: Base = 0; Rota = R$25 (mesma constante de `mem://logic/commissions/repasse-volante-isenta-adesao`).

**4. Execução do técnico (`src/pages/instalador/...` + edges de conclusão)**
- Quando o serviço aberto é `vistoria_entrada` com `dados_extras.escopo = 'vistoria_sem_instalacao'`, o app do técnico exibe APENAS o roteiro de fotos da `vistoriaConfigCompleta.ts` (31/15) — esconde checklist de instalação, IMEI, vídeo de instalador.
- Conclusão do serviço materializa fotos em `vistorias`/`vistoria_fotos` e envia novamente para Monitoramento › Aprovação (mesmo fluxo já existente).

**5. Memória**
- Atualizar `mem://logic/operations/vistoria-sem-rastreador-flow` com o novo fluxo (substituir "autovistoria OU presencial" por "autovistoria completa 31/15 obrigatória; presencial só sob demanda do monitoramento").

### Detalhes técnicos

- Banco:
  - Adicionar valor `'vistoria_sem_instalacao'` ao enum `escopo_servico` se existir, ou usar campo `servicos.dados_extras` (jsonb) para sinalizar (preferido — não exige migração de enum).
  - Não criar novo `tipo_servico`; reusar `vistoria_entrada`.
  - Migração apenas para criar índice em `servicos((dados_extras->>'escopo'))` se necessário para filtros.

- Edge functions novas:
  - `solicitar-vistoria-tecnico-sub-fipe` (POST): valida monitoramento, cria serviço + agendamento, atualiza fila.
  
- Edge functions modificadas:
  - `criar-instalacao-pos-pagamento`: branch sub-FIPE → não cria instalação; envia direto pra fila monitoramento.
  - `aprovar-proposta`: idem para idempotência.
  - `aplicar-conclusao-vistoria`: aceitar serviços com escopo `vistoria_sem_instalacao` (encerrar serviço + retornar à fila monitoramento).

- Frontend novo:
  - `src/components/cotacao-publica/VistoriaSubFipeCotacao.tsx` — wrapper sobre `vistoriaConfigCompleta` que reutiliza fluxo de upload da Autovistoria.
  - Dialog `SolicitarVistoriaTecnicoDialog.tsx` em `src/components/monitoramento/`.
  - Hook `useSolicitarVistoriaTecnico.ts`.

### Fora de escopo
- Mudanças em ≥FIPE (rastreador obrigatório) — fluxo continua idêntico.
- Sinistro / vistoria periódica — não tocar.
- Substituição/inclusão/troca: tratamos depois (esta entrega cobre nova adesão).
