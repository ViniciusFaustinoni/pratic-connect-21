## O que está acontecendo na cotação 434

Toyota Corolla (FIPE > 30k → precisa rastreador). O associado escolheu **agendamento base** para a instalação, mas ANTES do dia da instalação fez a **autovistoria** (padrão novo: foto do motor + foto do chassi + vídeo 360°) justamente para já liberar R&F antecipadamente.

Banco confirma: contrato com `tipo_vistoria='agendada_base'` + `vistorias` com `modalidade='autovistoria'`, status `pendente`, 3 fotos + vídeo 360°.

A UI do Cadastro deveria mostrar:
- Etapa 2 com as fotos da autovistoria + vídeo 360°
- Botão verde **"Liberar Cobertura Roubo e Furto"**
- Ao clicar: liberar R&F no veículo + mandar para Monitoramento (que depois faz a instalação base agendada)

Mas mostra **"Aprovar Proposta"** e ignora a autovistoria.

## Causas (duas, combinadas)

1. **Detecção de autovistoria quebrada** em `PropostaAnalise.tsx` (linha 94-97):
   ```ts
   isAutovistoria = (modalidade==='autovistoria' || tipo==='autovistoria')
                    && !instalacao_info && !isVistoriaBase
   ```
   `isVistoriaBase` vira `true` porque a cotação tem agendamento base **para a instalação posterior** — isso anula a autovistoria. Os dois eventos coexistem (autovistoria antecipada + base agendada para instalar rastreador), não são exclusivos.

2. **`autovistoriaCompleta` ainda valida o padrão antigo** (linhas 140-146): exige ≥31 fotos (carro) / ≥15 (moto). A nova canônica é **2 fotos (motor + chassi) + vídeo 360°** (já em `mem://...autovistoria-2-fotos-video-360`). Mesmo se o item 1 fosse corrigido, qualquer autovistoria nova cairia em "incompleta".

3. **Backend `aprovar-proposta`** já trata corretamente o caso "precisa rastreador → manda para Monitoramento", mas no caminho `algumPrecisouRastreador` ele **não libera R&F** nem marca a autovistoria como aprovada. Só faz isso no ramo sub-FIPE (linhas 494-546). Resultado: hoje, mesmo se a UI corrigida mostrasse o botão certo, o R&F não seria efetivamente liberado pelo Cadastro — só na aprovação do Monitoramento.

## Plano de correção (apenas onde falha; sem mexer no resto do fluxo)

### Frontend — `src/pages/cadastro/PropostaAnalise.tsx`

- **Desacoplar autovistoria do agendamento base.** Remover `&& !isVistoriaBase` da definição de `isAutovistoria`. Manter apenas `&& !instalacao_info` (uma instalação concluída é o que invalida considerar autovistoria como "fonte das fotos"). Comentário explicando que a base agendada é evento posterior.
- **Atualizar `autovistoriaCompleta` para a canônica nova:**
  ```
  autovistoriaCompleta = isAutovistoria
    ? ((totalFotos >= 2 && temVideo360)         // canônica 2+vídeo
       || totalFotos >= minFotosAutovistoria)    // legado 31/15 (compat)
    : true
  ```
- Nada mais muda em `podeAprovar`/`cadastroAvaliaFotos`/`aprovarApenasDocumentos` — a lógica deles já está correta uma vez que `isAutovistoria` e `autovistoriaCompleta` voltem a refletir a realidade.

### Frontend — `src/components/cadastro/proposta/PropostaApprovalStepper.tsx`

- Nenhuma mudança de lógica. O rótulo do botão (linha 433-437) já trata `isAutovistoria && !ocultarEtapaFotos && planoTemRouboFurto → "Liberar Cobertura Roubo e Furto"`. Voltará a funcionar automaticamente.
- Pequeno ajuste no banner contextual: quando há autovistoria completa **e** vistoria base agendada (caso 434), exibir um aviso explicando que a aprovação libera R&F agora e a instalação ocorrerá na data já agendada (texto curto, sem mexer em estrutura).

### Backend — `supabase/functions/aprovar-proposta/index.ts`

Antes do bloco `deveAguardarInstalacao`, detectar "autovistoria pendente + canônica completa + plano com R&F" e, nesse caso:

1. `UPDATE vistorias SET status='aprovada', aprovado_em=now(), aprovado_por=<aprovado_por> WHERE id=<vistoriaAutovistoria.id> AND status='pendente'`
2. `UPDATE veiculos SET cobertura_roubo_furto=true WHERE id=<veiculoId>`
3. Registrar histórico ("Cobertura Roubo/Furto liberada pelo Cadastro via autovistoria; instalação ocorrerá no agendamento base.")

Manter o resto intacto: associado segue para `aguardando_instalacao`, fila do Monitoramento, instalação base no dia já agendado. A flag `autovistoriaAprovada` (linha 617-630) passa a detectar o caso e a mensagem de histórico/notificação correta é enviada.

### Verificação

- Reabrir `/cadastro/propostas/842c835d-674d-462e-bd5f-982fd4dd6c94` — deve mostrar etapa "Fotos & Vistoria" com 2 fotos + vídeo 360° e botão **"Liberar Cobertura Roubo e Furto"**.
- Aprovar e conferir: `vistorias.status='aprovada'`, `veiculos.cobertura_roubo_furto=true`, `associados.status='aguardando_instalacao'`, proposta sai da fila do Cadastro e aparece no Monitoramento com a vistoria base já agendada preservada.
- Confirmar que cotações com autovistoria SEM agendamento base (sub-FIPE) continuam funcionando como antes (não há regressão no ramo `!veiculoPrecisaRastreador`).

## Detalhes técnicos (referência)

- Tabelas tocadas: `vistorias` (status), `veiculos` (cobertura_roubo_furto), `associados_historico` (insert).
- Nada muda em: `ativar-associado`, `aprovar-vistoria-monitoramento`, fluxo de instalação, agendamento base, SGA sync.
- Memórias respeitadas: ativação só via `ativar-associado` (não tocamos), autovistoria 2 fotos + 360° canônica, propostas pendentes saem por aprovação do Cadastro.