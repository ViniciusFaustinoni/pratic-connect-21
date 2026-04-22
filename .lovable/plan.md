

## Diferenciar análise do Cadastro por tipo de plano (com vs sem Roubo e Furto)

### Situação atual (já implementada)

O fluxo **sempre passa pelo Cadastro** em `/cadastro/propostas/:id`. O `PropostaApprovalStepper` já tem dois modos, mas a decisão hoje é pela **modalidade de vistoria**, não pelas **coberturas do plano**:

- **Autovistoria** (associado envia fotos pelo celular) → 3 etapas: Documentos + Fotos & Vistoria + Aprovação. Botão: "Liberar Cobertura Roubo e Furto".
- **Vistoria agendada base/cliente** sem fotos ainda → 2 etapas: Documentos + Aprovação. Botão: "Aprovar Proposta".

### O problema

Hoje o sistema decide "tem fotos a analisar?" pela **modalidade da vistoria** (autovistoria sim, agendada não). Mas a regra de negócio que você descreveu é diferente: deve depender se **o plano contratado tem cobertura de Roubo e Furto** — independente de ser autovistoria ou agendada.

A regra correta é:
- **Plano COM Roubo e Furto** → cadastro avalia **fotos + documentos** (precisa validar o estado físico do veículo para ativar a cobertura).
- **Plano SEM Roubo e Furto** (ex.: assistência 24h, vidros, benefícios soltos) → cadastro avalia **somente documentação**.

### O que vai mudar

**1. Detecção da cobertura no hook `usePropostasPendentes`**
- Adicionar campo derivado `plano_tem_roubo_furto: boolean` no tipo `PropostaPendente`.
- Lógica: inspecionar `plano.coberturas` (já carregado) e marcar `true` se qualquer item incluir as palavras "roubo" ou "furto" (mesmo padrão usado em `useAcionamentoRoubo` e `AppSinistroDetalhe.tsx`).

**2. Reescrever a regra de exibição da etapa "Fotos & Vistoria" em `PropostaAnalise.tsx`**
- Substituir a variável `isVistoriaBaseSemFotos` (baseada em modalidade) por uma nova `cadastroAvaliaFotos`:
  - `true` quando o plano tem Roubo e Furto **E** existem fotos/vídeo a revisar (autovistoria já entregue).
  - `false` quando o plano não tem Roubo e Furto **OU** quando ainda não há fotos (vistoria agendada não realizada).
- Quando `cadastroAvaliaFotos = false`, esconde a etapa 2 e o stepper fica apenas com **Documentos + Aprovação Final**.

**3. Ajustar `PropostaApprovalStepper`**
- Trocar a prop `isVistoriaBaseSemFotos` por `cadastroAvaliaFotos` (semântica clara).
- Atualizar o texto do banner na aprovação final:
  - Plano sem Roubo/Furto → mostrar banner: "Plano sem cobertura de Roubo e Furto. Análise documental é suficiente para liberar."
  - Plano com Roubo/Furto + autovistoria → manter botão "Liberar Cobertura Roubo e Furto".
  - Plano com Roubo/Furto + vistoria agendada → manter banner azul atual ("As fotos serão registradas pelo técnico no atendimento").

**4. Ajustar a edge function `aprovar-proposta/index.ts`**
- Hoje sempre seta `cobertura_roubo_furto: true` ao aprovar (linha 200). Precisa respeitar o plano:
  - Buscar o plano do contrato e verificar se tem cobertura de Roubo/Furto.
  - Se **não tem**, manter `cobertura_roubo_furto: false` e ativar apenas as coberturas pertinentes do plano.
  - Manter `cobertura_total` controlada pela conclusão da instalação como já é hoje.
- Ajustar a mensagem do histórico para refletir o caso "plano sem roubo/furto".

**5. Comunicação ao associado**
- Atualizar `notificar-cliente` (ou o template usado no `aprovar-proposta`): quando o plano não tem roubo/furto, enviar mensagem específica ("Seu plano de assistência foi ativado") em vez de mencionar cobertura de roubo/furto.

### O que NÃO vai mudar

- O fluxo continua **sempre passando pelo Cadastro** primeiro — sem atalhos.
- A lógica de instalação obrigatória de rastreador (Diesel, FIPE ≥ 30k carros / 9k motos) continua intacta.
- O segundo check pelo Monitoramento (após instalação) para liberar Proteção 360 segue igual.
- Vistoria agendada na base/cliente continua sem exigir fotos no cadastro (técnico registra depois).

### Riscos

- Falsos positivos na detecção de "tem roubo/furto": o nome da cobertura no banco pode variar ("Roubo", "Furto", "Roubo e Furto", "Roubo/Furto"). A regex `/roubo|furto/i` cobre todos os casos observados no código atual.
- Propostas antigas já aprovadas com `cobertura_roubo_furto = true` indevidamente: não serão alteradas (apenas novas aprovações respeitam a regra). Se quiser corrigir o histórico, posso incluir uma migração de backfill.

### Arquivos editados

- `src/hooks/usePropostasPendentes.ts` (adicionar campo derivado)
- `src/pages/cadastro/PropostaAnalise.tsx` (nova variável de decisão)
- `src/components/cadastro/proposta/PropostaApprovalStepper.tsx` (renomear prop + textos)
- `supabase/functions/aprovar-proposta/index.ts` (respeitar coberturas do plano)
- `supabase/functions/notificar-cliente/index.ts` (mensagem condicional — se aplicável)

