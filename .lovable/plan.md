# Diagnóstico confirmado

Reproduzi o caso como **admin** no preview, abri a proposta do DIOGO e cliquei em **Aprovar documentação (Monitoramento finaliza)**.

O resultado real foi:
- a UI abre normalmente o modal de confirmação
- ao confirmar, a edge **`aprovar-proposta`** responde **409**
- erro retornado: **`caminho_publico_incompleto`**
- verificações do backend: **`instalacao_concluida,instalacao_ativa,agendamento_base,vistoria_incompleta`**

Ou seja: **o sistema está contraditório**. A tela diz que o caso já está pronto para seguir, mas o backend diz que o caminho público ainda não foi concluído.

## Prova técnica coletada

### No browser
- botão exibido: **Aprovar documentação (Monitoramento finaliza)"
- toast após confirmar:
  - "Não é possível aprovar: o cliente ainda não concluiu o caminho público... [caminho_publico_incompleto]"

### Na edge `aprovar-proposta`
- log capturado:
  - `BLOQUEIO caminho_publico_incompleto`
  - `motivos: instalacao_concluida, instalacao_ativa, agendamento_base, vistoria_incompleta`

### Nos dados do caso
- existe **1 serviço** do tipo `vistoria_entrada`
- `modalidade = autovistoria`
- `origem = autovistoria_publica`
- `profissional_id = null`
- `video_360_url` no **serviço** está preenchido
- existem **32 mídias** em `cotacoes_vistoria_fotos`
- existe **1 vídeo** em `cotacoes_vistoria_fotos` (`tipo = video_360`)
- existe **1 vistoria materializada** para o contrato
- nessa `vistorias`, o campo **`video_360_url` está `null`**

## Conclusão

O DIOGO **cumpriu o ciclo canônico do caso dele**, mas houve **dessincronia de materialização/sync**:
- a mídia existe
- o serviço enxerga o vídeo
- a vistoria materializada não recebeu o `video_360_url`
- o guard do backend valida a `vistorias` materializada + `vistoria_fotos`
- por isso ele classifica como **`vistoria_incompleta`**

# Resposta objetiva às suas 3 dúvidas

## 1) “O sistema errou?”
**Sim.**
A UI permite uma ação que o backend necessariamente vai bloquear para esse contrato.

## 2) “Tem a ver com as mudanças dos últimos dias?”
**Sim, parcialmente.**
Não parece que as mudanças recentes criaram a falta do vídeo em si, mas elas **expuseram e agravaram** o problema:
- o guard canônico da edge ficou mais rígido/correto
- a UI do stepper continua liberando o botão com base em um estado mais permissivo
- resultado: ficou um **descasamento entre frontend e backend**

Em resumo:
- **bug de dados/sync**: `vistorias.video_360_url = null`
- **bug de UX/regra de tela**: a tela mostra “Monitoramento finaliza” e deixa clicar, mesmo com o guard backend ainda reprovando

## 3) “Entrou pela regra antiga e precisa de saneamento?”
**Não parece ser caso de regra antiga do veículo/fluxo legado.**
O caso é atual, materializado como `autovistoria_publica`, com mídia nova e serviço novo.

O que ele **precisa** é de **saneamento de dados desse padrão quebrado**, não por ser fluxo antigo, e sim por ter caído no gap de sincronização:
- `servicos.video_360_url` preenchido
- `cotacoes_vistoria_fotos` com vídeo
- `vistorias.video_360_url` nulo

# Plano de implementação

## 1. Corrigir o caso do DIOGO imediatamente
- preencher a `vistorias.video_360_url` a partir da mídia já existente
- revalidar a aprovação em ambiente real
- confirmar que o contrato sai do bloqueio sem bypass manual

## 2. Saneamento histórico do mesmo padrão
- localizar todos os casos com esta assinatura:
  - `vistorias.modalidade = 'autovistoria'`
  - `vistorias.video_360_url is null`
  - existe vídeo em `cotacoes_vistoria_fotos` e/ou `servicos.video_360_url`
- gerar backfill seguro e idempotente
- deixar relatório dos contratos afetados

## 3. Blindar a materialização/sync da autovistoria
- ajustar o ponto canônico que materializa a vistoria para sempre carregar o vídeo 360
- garantir cobertura para os dois caminhos observados:
  - vídeo vindo de `cotacoes_vistoria_fotos`
  - vídeo já presente em `servicos.video_360_url`
- manter idempotência

## 4. Alinhar a UI com o mesmo gate do backend
- impedir que o stepper mostre **“Aprovar documentação (Monitoramento finaliza)”** quando a edge ainda reprovaria por `caminho_publico_incompleto`
- mostrar o motivo correto para o analista antes do clique
- evitar o falso positivo visual de “caso pronto” quando ainda há dessincronia técnica

## 5. Corrigir a rotulagem enganosa do fluxo
- revisar os textos que hoje sugerem **“vistoria agendada/presencial”** para um caso que, na prática, foi **autovistoria pública concluída**
- alinhar o resumo do cadastro e o link público ao estado canônico

# Detalhes técnicos

## Arquivos diretamente envolvidos
- `supabase/functions/aprovar-proposta/index.ts`
- `src/components/cadastro/proposta/PropostaApprovalStepper.tsx`
- possivelmente o ponto de materialização/sync da autovistoria e o helper de etapa pública

## Evidência do descompasso atual
- frontend libera a ação no stepper
- backend exige uma das condições:
  - autovistoria enxuta concluída
  - vistoria presencial materializada
  - agendamento ativo
  - instalação ativa/concluída
- neste contrato, o backend cai em `vistoria_incompleta` porque a vistoria materializada ficou sem o vídeo

## Resultado esperado após a correção
- o caso DIOGO passa sem erro
- casos históricos iguais deixam de travar
- a tela não promete aprovação quando o backend ainda bloquearia
- o resumo do fluxo passa a refletir o estado real do caso

Se você aprovar, eu implemento a correção completa começando pelo caso do DIOGO e pelo saneamento do padrão quebrado.