## Plano para corrigir o fluxo de cadastro do novo associado

## Objetivo
Garantir que o fluxo siga exatamente esta ordem:

```text
Agendamento / Auto vistoria
        ↓
Entrada na fila do Cadastro
        ↓
Aprovação do Cadastro
        ↓
Criação/liberação do serviço de instalação
        ↓
Instalação concluída
        ↓
Aprovação do Monitoramento
        ↓
Associado ativo + tela pública atualizada + mensagem "Proteção 360 ativada" + SGA ativo
```

Também garantir que:
- reprovação no Cadastro não envie o associado ao SGA como ativo;
- reprovação no Monitoramento não envie o associado ao SGA como ativo;
- a tela pública mostre claramente cada etapa e cada reprovação.

## Diferenças encontradas hoje
- A instalação ainda pode ser criada antes da aprovação do Cadastro.
- `aprovar-proposta` ainda ativa contrato/associado temporariamente antes de voltar para `aguardando_instalacao`.
- A aprovação do monitoramento envia mensagem e ativa localmente, mas não fecha o fluxo garantindo SGA como `ativo`.
- A reprovação do monitoramento não aparece de forma clara na tela pública.

## Implementação

### 1. Travar a criação antecipada da instalação
Ajustar o fluxo para que agendamento e autovistoria apenas salvem os dados necessários, sem materializar instalação antes da aprovação do Cadastro.

Arquivos:
- `supabase/functions/criar-instalacao-pos-pagamento/index.ts`
- `supabase/functions/agendar-vistoria-presencial/index.ts`
- `supabase/functions/agendar-vistoria-completa/index.ts`

Mudanças:
- impedir que `criar-instalacao-pos-pagamento` crie instalação enquanto o contrato ainda estiver pendente de aprovação cadastral;
- remover o comportamento opcional que hoje cria instalação logo após o agendamento se o pagamento já estiver confirmado;
- manter apenas o salvamento do agendamento/cotação nessa fase.

### 2. Corrigir a aprovação do Cadastro
Refatorar `aprovar-proposta` para não fazer ativação temporária e depois desfazer.

Arquivo:
- `supabase/functions/aprovar-proposta/index.ts`

Mudanças:
- se o veículo exigir rastreador, ao aprovar o cadastro:
  - manter contrato fora de `ativo` até a etapa final;
  - colocar associado em `aguardando_instalacao`;
  - manter SGA como `pendente`;
  - somente então liberar/criar a instalação;
- se o veículo não exigir rastreador, manter a ativação direta como exceção válida;
- padronizar histórico e mensagens para refletir a etapa correta.

### 3. Tornar o Monitoramento o ponto final de ativação
Mover a ativação definitiva para a aprovação do monitoramento.

Arquivo:
- `src/hooks/useAprovacaoMonitoramento.ts`

Mudanças:
- ao aprovar no monitoramento:
  - ativar veículo/associado/contrato/cotação de forma definitiva;
  - chamar `sga-hinova-sync` com `status_sga_destino: 'ativo'`;
  - só depois disparar a mensagem de “Proteção 360 ativada”; 
- ao reprovar no monitoramento:
  - impedir qualquer ativação final;
  - persistir status e histórico de reprovação de forma rastreável;
  - manter o associado fora do estado ativo.

### 4. Atualizar a tela pública
Deixar a jornada pública coerente com o novo funil.

Arquivo:
- `src/pages/public/AcompanhamentoProposta.tsx`

Mudanças:
- exibir estados distintos para:
  - em análise cadastral;
  - cadastro aprovado / aguardando instalação;
  - instalação concluída / aguardando monitoramento;
  - proteção 360 ativada;
  - cadastro reprovado;
  - monitoramento reprovado;
- ajustar textos para não indicar ativação antes da hora;
- manter o aviso correto quando houver pendência ou reprovação.

### 5. Ajustar a fila operacional do Cadastro
Garantir que a listagem e as ações da análise cadastral continuem coerentes após a mudança da ordem do funil.

Arquivo:
- `src/hooks/usePropostasPendentes.ts`

Mudanças:
- revisar os critérios da fila para continuar exibindo corretamente propostas aguardando análise;
- garantir que aprovação, solicitação de documentos e reprovação reflitam o novo encadeamento;
- manter a reprovação cadastral encerrando o fluxo sem ativação SGA.

## Validação esperada
Após a alteração:
- o agendamento pode acontecer antes, mas a instalação só nasce/libera depois da aprovação do Cadastro;
- aprovação do Cadastro não ativa temporariamente o associado;
- após aprovação cadastral, o associado vai para `aguardando_instalacao` e SGA `pendente` quando aplicável;
- a ativação final só acontece após instalação concluída e aprovação do Monitoramento;
- a mensagem “Proteção 360 ativada” só sai no momento correto;
- reprovação no Cadastro ou no Monitoramento impede SGA `ativo`;
- a tela pública passa a mostrar claramente o estágio real do associado.

## Detalhes técnicos
Arquivos principais:
- `supabase/functions/aprovar-proposta/index.ts`
- `supabase/functions/criar-instalacao-pos-pagamento/index.ts`
- `supabase/functions/agendar-vistoria-presencial/index.ts`
- `supabase/functions/agendar-vistoria-completa/index.ts`
- `src/hooks/useAprovacaoMonitoramento.ts`
- `src/hooks/usePropostasPendentes.ts`
- `src/pages/public/AcompanhamentoProposta.tsx`

Sem mudança de schema prevista neste ajuste, a princípio. O foco é corrigir a orquestração do fluxo, os gatilhos de ativação e os estados exibidos.