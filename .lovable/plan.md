## Objetivo

Permitir que o Monitoramento solicite **Retirada do rastreador** em três pontos, sempre escolhendo qual vistoria acompanha (a escolha sinaliza se o veículo sai da base ou permanece sem rastreador):

1. **Troca de Titularidade** — modal de aprovação do Monitoramento.
2. **Substituição de Veículo** — via Aprovação de Associados (fila canônica).
3. **Serviços de Campo › Serviços** — botão "Tratar como Retirada" no `ServicoDetailModal`, mesmo padrão do já existente "Tratar como Manutenção", para corrigir atribuição errada.

Semântica fixa dos 3 tipos de vistoria acompanhante (válida nas 3 entradas):
- **Vistoria de Retirada** → veículo SAI da base, cobertura encerra após execução.
- **Vistoria Enxuta** → veículo PERMANECE sem rastreador (chassi + motor + vídeo 360°).
- **Vistoria Completa** → veículo PERMANECE sem rastreador (31 fotos carro / 15 moto + vídeo 360°).

---

## Parte A — "Solicitar Retirada + Vistoria" no Monitoramento (Troca e Substituição)

### A.1 Onde aparece
- `src/components/relacionamento/troca-titularidade/ModalDetalhesTroca.tsx` — quando `modo === 'monitoramento'` e `solicitacao.status === 'aguardando_monitoramento'`.
- `src/components/monitoramento/aprovacao/AprovacaoInstalacaoDetalhe.tsx` (Substituição cai nessa fila canônica) — mesma condição, com veículo antigo tendo rastreador instalado.
- Posição: entre **"Solicitar Vistoria ▾"** e **"Agendar manutenção"**, rótulo **"Solicitar Retirada"**, ícone `PackageMinus`, variante `outline`.

### A.2 Fluxo do clique
1. Busca `rastreadores` com `status='instalado'` no veículo de origem (`veiculo_antigo_id` na troca; `veiculo_anterior_id` na substituição).
2. Sem rastreador → toast informativo, nada é aberto.
3. Com rastreador → abre **`SolicitarRetiradaComVistoriaDialog`** (novo) com:
   - Card resumo do rastreador (IMEI, modelo, plataforma).
   - Radio obrigatório dos 3 tipos de vistoria acompanhante (sem default).
   - Justificativa obrigatória (≥10 chars).
   - Data + período (reaproveita componentes de `RealocarServicoSimplesDialog`).

### A.3 O que é gravado
Materializa **2 serviços** no mesmo `agendamento_base` (mesmo padrão da Substituição):

1. **Retirada** — `servicos.tipo='retirada_rastreador'`, vinculado ao rastreador, `origem='troca_titularidade'` ou `'substituicao'`.
2. **Vistoria acompanhante** — derivada da escolha:
   - Retirada → `vistoria_retirada`
   - Enxuta → `vistoria_entrada` + `modalidade='enxuta_pos_retirada'`
   - Completa → `vistoria_entrada` + `modalidade='completa_pos_retirada'`

Auxiliares:
- `analises_relacionamento` — entrada `monitoramento_solicitou_retirada` com tipo + justificativa.
- `logs_auditoria` — `acao='criar'`, descrição prefixada `[monitoramento_retirada]`.
- Aprovação permanece pendente; "Aprovar" volta quando **ambos** os serviços tiverem status terminal.

### A.4 Semântica pós-execução
- **Vistoria de Retirada concluída** → fluxo padrão de cancelamento/saída segue (sem mudança).
- **Enxuta/Completa concluída** → veículo permanece ativo; rastreador vai para `retirado` e `veiculo_id` zerado (regra canônica "Vínculo rastreador-veículo").

---

## Parte B — "Tratar como Retirada" em Serviços de Campo › Serviços

Espelha exatamente o padrão consolidado de **"Tratar como Manutenção"** em `src/components/servicos-campo/ServicoDetailModal.tsx`.

### B.1 Onde
- `ServicoDetailModal.tsx`, ao lado do botão **"Tratar como Manutenção"**.
- Visível quando: `podeAcoesMonitor && isInstalacao && statusDevolvivel && servico.veiculo_id` (mesmas condições do botão de Manutenção).
- Rótulo: **"Tratar como Retirada"**, ícone `PackageMinus`, borda `border-amber-500/60`.

### B.2 Dialog `MarcarRetiradaDialog` (novo, espelho de `MarcarManutencaoDialog`)
- Mostra rastreador vinculado ao veículo. Sem rastreador → bloqueia com mensagem.
- **Mesmo radio dos 3 tipos** de vistoria acompanhante da Parte A.
- Justificativa obrigatória.
- Ao confirmar: converte o serviço atual em `retirada_rastreador` e cria o irmão de vistoria com a modalidade escolhida no mesmo `agendamento_base`.

### B.3 Garantias preservadas
- Regra **"1 serviço canônico vivo por origem"** continua valendo (mesma estratégia já usada em "Tratar como Manutenção").
- Bloqueia conversão se o veículo não tem rastreador vinculado coerente.
- Log em `servicos_atribuicoes_log` (`acao='converter_tipo_retirada'`) e `logs_auditoria`.
- "Realocar" continua sendo o caminho para mudar data/período/técnico. Este botão é só para **mudar o tipo** quando houve erro de atribuição.

---

## Fora de escopo
- Não cria dialog genérico "Alterar tipo de serviço" com todos os tipos — segue o padrão pontual ("um botão por conversão relevante").
- Não toca `AbrirRetiradaModal` (fluxo manual fora do Monitoramento) nem `useAbrirRetirada`.
- Não toca `ModalDetalhesSubstituicao` (só card de tracking).
- Não toca lógica de `realocar_servico` nem botão "Realocar".
- Sem novas edge functions.

---

## Detalhes técnicos

**Arquivos novos:**
- `src/components/monitoramento/retirada/SolicitarRetiradaComVistoriaDialog.tsx` (Parte A).
- `src/components/monitoramento/MarcarRetiradaDialog.tsx` (Parte B, espelho de `MarcarManutencaoDialog`).

**Arquivos editados:**
- `src/components/relacionamento/troca-titularidade/ModalDetalhesTroca.tsx` — botão + handler.
- `src/components/monitoramento/aprovacao/AprovacaoInstalacaoDetalhe.tsx` — botão + handler.
- `src/components/servicos-campo/ServicoDetailModal.tsx` — botão "Tratar como Retirada" + montar dialog.

**Migração mínima:**
- Ajustar CHECK em `servicos.modalidade` para aceitar `'enxuta_pos_retirada'` e `'completa_pos_retirada'`.
- Nenhuma nova tabela. Nenhuma nova edge.

**Memória a salvar pós-implementação:**
- `mem://logic/operations/retirada-com-vistoria-monitoramento` — Retirada solicitada pelo Monitoramento traz vistoria acompanhante obrigatória; tipo escolhido sinaliza intenção (Retirada=sai; Enxuta/Completa=permanece sem rastreador); materializa 2 serviços paralelos no mesmo `agendamento_base`; entradas em Troca, Substituição e Serviços de Campo via "Tratar como Retirada".