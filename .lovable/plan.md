# Plano de correção

## Diagnóstico fechado
- A cotação `COT-20260516-101252395-551` está hoje em `status_contratacao = aguardando_aprovacao_cadastro`.
- Existe `vistorias` com `modalidade = autovistoria` e `status = aprovada`.
- O veículo está em `instalacao_pendente` com `cobertura_roubo_furto = true`.
- Já existe data na própria cotação (`vistoria_completa_data_agendada = 2026-05-18`, período `manha`), mas **não existe** linha em `instalacoes` nem em `agendamentos_base`.
- Ou seja: o problema do Leonardo não é mais “faltou data”; o problema é que o fluxo ficou **parcialmente salvo na cotação**, mas não foi **materializado nas tabelas operacionais**.

## O que está errado hoje
1. **Régua pública ainda trata estados pós-cadastro de forma ambígua**
   - `determinarEtapa()` joga `aguardando_aprovacao_cadastro`, `aguardando_aprovacao_monitoramento` e `vistoria_concluida` todos na etapa 4.
   - Depois `CotacaoContratacao.tsx` tenta decidir se mostra pagamento, análise ou instalação usando vários atalhos locais.
   - Isso permite cair em tela errada ou inconsistente quando o caso é “autovistoria R&F já aprovada + instalação ainda não materializada”.

2. **A etapa 5 usa snapshot da cotação como se fosse instalação real**
   - Em `CotacaoContratacao.tsx`, o bloco de autovistoria considera `cotacao.vistoria_completa_data_agendada` suficiente para exibir “Instalação agendada”.
   - No caso do Leonardo, isso mascara o bug real: existe a data no snapshot, mas não existe `instalacoes/agendamentos_base`.

3. **O backend só materializa instalação se `cadastroAprovado` já estiver true no momento da chamada**
   - `criar-instalacao-pos-pagamento` tem esta regra:
     - se há `dataAgendada` e `cadastroAprovado` => cria `instalacoes`
     - se há `dataAgendada` e `!cadastroAprovado` => apenas loga e não cria nada
   - Isso abre a janela de inconsistência: o cliente agenda, os dados ficam na cotação, mas a instalação não nasce.
   - Depois, se o cadastro aprovar sem uma nova chamada idempotente de materialização, o caso fica travado exatamente como o do Leonardo.

## Implementação proposta

### 1) Tornar o link público determinístico para autovistoria R&F
Ajustar `src/hooks/useCotacaoContratacao.ts` e `src/pages/public/CotacaoContratacao.tsx` para separar claramente três estados:
- **Autovistoria enviada / aguardando cadastro**
- **Cadastro aprovou e falta materialização operacional da instalação**
- **Instalação realmente criada/agendada nas tabelas operacionais**

Mudanças:
- `determinarEtapa()` deixa de tratar todos os pós-cadastro iguais.
- Criar uma regra explícita para `autovistoria + exige rastreador`:
  - se **não existe** `instalacoes` nem `agendamentos_base`, o link deve mostrar a etapa de **Instalação** como pendente/ação requerida;
  - se existe só snapshot em `cotacoes`, mas não existe registro operacional, **não** mostrar “instalação agendada com sucesso”; mostrar estado de recuperação/reenvio da materialização;
  - se existe registro operacional real, aí sim mostrar o resumo do agendamento.
- Remover a dependência de `cotacao.vistoria_completa_data_agendada` como prova suficiente de agendamento concluído nesse fluxo.

### 2) Corrigir o encadeamento backend para materializar instalação de forma idempotente
Ajustar `supabase/functions/criar-instalacao-pos-pagamento/index.ts` e revisar a chamada de `aprovar-proposta`.

Objetivo:
- Sempre que houver:
  - autovistoria R&F válida,
  - rastreador obrigatório,
  - data/endereço já salvos,
  - e cadastro aprovado,
- a instalação deve ser materializada nas tabelas operacionais, mesmo que a data tenha sido salva antes.

Mudanças:
- `criar-instalacao-pos-pagamento` passa a ser a função canônica de “materializar agendamento salvo”.
- `aprovar-proposta` deve, após aprovar cadastro nesse cenário, chamar a materialização idempotente se já houver dados de agendamento na cotação.
- Se não houver dados de agendamento reais, manter o bloqueio e devolver erro claro orientando que falta o cliente agendar pelo link público.

## Backfill do caso Leonardo
Aplicar um backfill controlado para `COT-20260516-101252395-551`:
- não mexer na autovistoria aprovada;
- não retirar `cobertura_roubo_furto`;
- materializar agora a `instalacoes` (ou `agendamentos_base`, conforme o modo salvo da cotação) a partir dos dados já presentes em `vistoria_completa_*`;
- garantir que o card apareça corretamente no Monitoramento e que o link público reflita o estado operacional real.

## Arquivos previstos
- `src/hooks/useCotacaoContratacao.ts`
- `src/pages/public/CotacaoContratacao.tsx`
- `supabase/functions/criar-instalacao-pos-pagamento/index.ts`
- `supabase/functions/aprovar-proposta/index.ts`
- uma migration/backfill específica para o caso Leonardo

## Resultado esperado
- O link público não volta mais para “aprovar proposta” nem fica preso em tela errada nesse cenário.
- Autovistoria de R&F continua válida acima da FIPE mínima.
- Quando houver agendamento salvo mas ainda sem materialização operacional, o sistema se recupera corretamente.
- O caso do Leonardo volta a aparecer de forma correta no fluxo operacional e deixa de ficar travado entre cadastro e monitoramento.

## Detalhes técnicos
```text
Estado correto para autovistoria R&F com rastreador obrigatório:

autovistoria aprovada
→ cadastro aprova
→ se já houver data/endereço salvos: materializa instalacoes/agendamentos_base
→ monitoramento recebe serviço real
→ atribuição / execução
→ aprovação final

Nunca considerar apenas cotacoes.vistoria_completa_* como fonte final de verdade.
A fonte final precisa ser operacional: instalacoes / agendamentos_base / servicos.
```