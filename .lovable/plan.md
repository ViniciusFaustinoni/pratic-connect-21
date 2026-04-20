

## Adaptar Aprovação para Vistoria na Base (sem fotos do associado)

### Problema
Quando o associado escolhe "Vistoria + Instalação na Base" (`cotacoes.tipo_vistoria = 'agendada_base'`), ele **não envia fotos nem vídeo 360°** — toda a mídia será capturada pelo técnico na oficina parceira no dia do atendimento. Hoje, o stepper de aprovação (`PropostaApprovalStepper`) sempre exige passar pela etapa "Fotos & Vistoria" e mostra "Sem fotos/vídeo disponíveis", confundindo o cadastro (caso real: Rafael Lucindo / KYS4C01).

### Solução
Quando `tipo_vistoria === 'agendada_base'` **e** ainda não existe vistoria executada (sem `instalacao_info` e sem `vistoria_base_info` concluída), o fluxo de aprovação deve:

1. **Pular automaticamente a Etapa 2 (Fotos & Vistoria)** — o stepper passa a ter apenas 2 etapas: Documentos → Aprovação Final.
2. **Aprovar com base apenas na documentação** — o botão "Aprovar Proposta" libera quando todos os documentos estão aprovados, sem exigir checkbox de revisão de fotos.
3. **Exibir banner informativo** na Etapa 3 explicando que as fotos serão capturadas presencialmente na base no dia do agendamento (com data/hora se disponível em `vistoria_base_info`/`agendamentos_base`).
4. **Manter texto de aprovação correto** — o botão diz "Aprovar Proposta" (não "Liberar Cobertura Roubo e Furto", que é específico de autovistoria).

Quando a vistoria na base **for executada** (técnico subiu fotos), o fluxo volta ao normal de 3 etapas — as fotos aparecem em `proposta.vistoria.fotos` e Etapa 2 reaparece automaticamente para revisão.

### Arquivos tocados

**1. `src/hooks/usePropostasPendentes.ts`**
- Adicionar campo `tipo_vistoria: 'autovistoria' | 'agendada' | 'agendada_base' | null` na interface `PropostaPendente`.
- Popular este campo no `useProposta` (e na lista resumida `usePropostasPendentes`) buscando de `cotacoes.tipo_vistoria` quando `contrato.cotacao_id` existir. Já existe a leitura na linha 319-323; basta propagá-la para o objeto retornado.

**2. `src/pages/cadastro/PropostaAnalise.tsx`**
- Calcular nova flag:
  ```ts
  const isVistoriaBaseSemFotos =
    proposta?.tipo_vistoria === 'agendada_base' &&
    !proposta?.vistoria_base_info?.concluida_em &&
    !(proposta?.vistoria?.fotos?.length);
  ```
- Passar `isVistoriaBaseSemFotos` como nova prop para `PropostaApprovalStepper`.

**3. `src/components/cadastro/proposta/PropostaApprovalStepper.tsx`**
- Aceitar prop `isVistoriaBaseSemFotos: boolean`.
- Quando `true`:
  - Renderizar apenas 2 itens no array `steps` (Documentos + Aprovação Final), reindexando o ID 3 para 2.
  - `step2Complete` (fotos) é forçado para `true` (não bloqueia avanço/aprovação).
  - Substituir o card de "Fotos & Vistoria" no resumo da Etapa Final por um card informativo:
    > 📍 **Vistoria agendada na base** — As fotos do veículo serão registradas pelo técnico no dia do atendimento presencial em `{data_agendamento}`. Aprove apenas a documentação para liberar o agendamento.
  - O botão de aprovar mantém o texto "Aprovar Proposta" e desabilita só por `!step1Complete`.

### Validação
1. Rafael Lucindo (KYS4C01): abrir a proposta → stepper mostra 2 etapas, Etapa 2 some, botão "Aprovar Proposta" libera quando docs estiverem 100% aprovados.
2. Proposta autovistoria normal: continua com 3 etapas e checkbox de revisão de fotos (sem regressão).
3. Proposta `agendada_base` **após** o técnico da oficina concluir a vistoria e subir fotos: volta a 3 etapas, fotos aparecem para revisão.
4. Proposta `agendada` (rota domiciliar) sem fotos ainda: continua bloqueada aguardando execução (`aguardandoExecucao`), comportamento atual preservado.

