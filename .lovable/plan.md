## Diagnóstico

O wizard "Reativar Associado" assume **sempre** que a suspensão é por inadimplência:
- `caminho` é decidido só por `dias` de atraso de pagamento (`useAssociadoSituacao.diasAtraso`).
- Os 3 caminhos (Pagamento Simples / Pagamento + Revistoria / Nova Adesão) só falam de **boleto**, **revistoria** e **adesão**.

No caso do CASSIO o veículo **não está inadimplente** — está com `cobertura_suspensa=true` por causa do cron que corrigimos antes (instalação não realizada no prazo). Como `diasAtraso=0`, o wizard cai no caminho 1 e mostra "Confirmar Pagamento" — completamente errado para esse cenário.

Já existe a infraestrutura correta para esse fluxo: edge function `liberar-reagendamento-autovistoria` + página `/monitoramento/liberacoes-autovistoria` + hook `useLiberacoesAutoVistoria`. O wizard só precisa **detectar** o motivo da suspensão e oferecer o caminho certo.

Bug adicional descoberto: o hook `useLiberacoesAutoVistoria` filtra pelo motivo legado `'Auto-vistoria sem instalação no prazo'`, mas o cron corrigido grava `'Instalação não realizada no prazo de Xh após assinatura'`. Resultado: novos casos (como o CASSIO) **não aparecem** na tela de liberações do monitoramento.

## O que será corrigido

### 1. Adicionar caminho "Liberação de Reagendamento" no wizard
Em `src/components/associados/reativacao/ReativacaoWizard.tsx`:

- Detectar suspensão por instalação lendo `veiculos.cobertura_suspensa_motivo` do(s) veículo(s) do associado (motivo começa com "Instalação não realizada" ou contém "auto-vistoria").
- Quando esse motivo for detectado, ignorar a lógica de inadimplência e usar um **novo caminho 4** ("Liberar Reagendamento de Vistoria/Instalação"):
  - Banner azul informativo: "Suspensão por instalação não realizada no prazo. Não há débito em aberto."
  - 1 etapa única: **"Liberar para Reagendamento"** com campo opcional de motivo, que chama a edge function `liberar-reagendamento-autovistoria` (já existe) com o `contrato_id`.
  - Após sucesso: cobertura volta, contrato fica `liberado_reagendamento_em=now()`, WhatsApp é disparado pro associado com o link público pra reagendar.
- Se houver inadimplência **E** suspensão por instalação simultaneamente, mostrar os dois caminhos em sequência (primeiro liberar, depois confirmar pagamento) — caso raro, mas tratado.

### 2. Corrigir filtro do hook `useLiberacoesAutoVistoria`
Em `src/hooks/useLiberacoesAutoVistoria.ts`:
- Trocar `.eq('cobertura_suspensa_motivo', 'Auto-vistoria sem instalação no prazo')` por `.or('cobertura_suspensa_motivo.eq.Auto-vistoria sem instalação no prazo,cobertura_suspensa_motivo.ilike.Instalação não realizada%')` para cobrir o motivo novo + o legado.
- Ampliar filtro de status do contrato de `eq('status','ativo')` para `in('status', ['ativo','assinado'])` (alinhado com o cron corrigido).

### 3. Atualizar memória `suspensao-cobertura-48h`
Adicionar nota: a reativação após suspensão por instalação se faz pela liberação de reagendamento (não por wizard de inadimplência).

## Fora do escopo
- Não mexer no cron de suspensão (já corrigido).
- Não mexer na lógica de inadimplência ou nos caminhos 1/2/3.
- Não criar nova migration — só código frontend + ajuste de hook.

## Resultado esperado
Ao abrir "Reativar" para o CASSIO (ou qualquer associado suspenso por instalação fora do prazo, sem dívida), o wizard mostra:
- Banner azul: "Suspenso por instalação não realizada no prazo (X dias)"
- 1 botão único: **"Liberar Reagendamento"** (com motivo opcional)
- Ao confirmar: cobertura reativada, contrato liberado, WhatsApp enviado com link público.

A página `/monitoramento/liberacoes-autovistoria` também passa a listar os casos novos.