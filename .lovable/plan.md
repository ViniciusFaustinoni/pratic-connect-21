

## Diagnóstico

**Fluxo atual** (analisei `usePropostasPendentes.ts`, `aprovar-proposta`, `useAprovacaoMonitoramento.ts`, `AcompanhamentoProposta.tsx`):

1. Cliente assina contrato → `contratos.status = 'assinado'`.
2. `usePropostasPendentes` (fila do **analista de cadastro**) **só inclui** propostas que tenham:
   - **Instalação concluída** (`instalacaoInfo`), OU
   - **Autovistoria concluída com fotos**, OU
   - **Vistoria na base realizada** (`agendamentos_base.status='realizado'`).
   - Linhas 527-529: `if (!instalacaoInfo && !temAutovistoria && !temVistoriaBaseRealizada) return null;`
3. Quando o analista aprova → `aprovar-proposta` cria a instalação (se necessário) e ativa cobertura roubo/furto.
4. **Monitoramento** (`useInstalacoesAguardandoAprovacao`) só recebe a tarefa **após a instalação ter sido executada e concluída** (`servicos.tipo='instalacao' AND status='concluida' AND veiculo.cobertura_total != true`) → dá o "segundo check" ativando Proteção 360 e o app do associado.

**O gap relatado pelo usuário:**

> "Quando o novo associado **agendar** (parte-se do princípio que documentação já foi enviada), isso é suficiente para entrar na fila do analista de cadastro."

Hoje, **propostas com vistoria/instalação apenas agendada (não executada) NÃO aparecem na fila do analista**. O analista só vê após:
- Autovistoria já realizada (fotos enviadas), OU
- Vistoria base já realizada, OU
- Instalação já concluída.

E a tela pública do cliente, quando o status é `em_analise`, mostra "Proposta em Análise" — porém o associado pode estar com vistoria só agendada, sem aparecer ainda na fila.

## O que muda

### 1. Fila do analista de cadastro — incluir propostas com agendamento

**Arquivo:** `src/hooks/usePropostasPendentes.ts`

- Linhas 482-529: alterar a regra de filtragem. Hoje exige `instalacaoInfo || temAutovistoria || temVistoriaBaseRealizada`.
- **Nova regra:** também incluir quando houver **agendamento confirmado** de qualquer modalidade:
  - `instalacaoAgendada` (já buscado, linhas 250-257) — vistoria/instalação domiciliar agendada via `cotacoes.vistoria_data_agendada`.
  - `vistoria_base_info` com status `'agendado'` ou `'realizado'` (hoje só inclui `'realizado'` — linha 508).
  - Autovistoria iniciada (qualquer foto OU link gerado).
- Adicionar campo `tipo_etapa_analise` no payload retornado para o analista entender o estágio: `'agendamento_confirmado' | 'vistoria_em_execucao' | 'vistoria_concluida' | 'instalacao_concluida'`.

### 2. Coluna/badge na tabela do analista para diferenciar estágio

**Arquivo:** `src/pages/cadastro/PropostasPendentes.tsx`

- Acrescentar badge "Agendado" (`bg-blue/15 text-blue`) para propostas no novo estado `agendamento_confirmado` (sem fotos/instalação ainda).
- Permitir abrir a proposta para análise documental (documentos + contrato), mas **bloquear o botão "Aprovar"** até existir vistoria/autovistoria/instalação realizada — com tooltip: *"Aguardando execução da vistoria para aprovação."*

### 3. Bloqueio do "Aprovar" enquanto vistoria não foi executada

**Arquivo:** `src/pages/cadastro/PropostaAnalise.tsx`

- Linha 88: `podeAprovar = proposta?.status === 'assinado' && !proposta?.tem_documento_pendente && (temVistoriaExecutada || temInstalacaoConcluida)`.
- Banner explicativo no topo quando `tipo_etapa_analise === 'agendamento_confirmado'`: *"Análise documental pode ser feita agora. Aprovação final libera para execução da vistoria/instalação. O monitoramento dará o segundo check após conclusão."*

### 4. Tela pública — mostrar "Em análise cadastral" desde o agendamento

**Arquivo:** `src/pages/public/AcompanhamentoProposta.tsx`

- Função `getStatusInfo` (linhas 432-444): hoje `pendente_vistoria` mostra "Aguardando Vistoria".
- **Novo:** quando o associado tem agendamento confirmado E status do contrato é `assinado` (sem aprovação ainda) → mostrar **"Em Análise Cadastral"** com texto:
  > *"Recebemos seu agendamento e documentação. Nosso analista está revisando seu cadastro. Após aprovação, sua vistoria/instalação será executada conforme agendado."*
- Manter o estado `pendente_vistoria` como fallback para casos sem agendamento.

### 5. Garantir o "segundo check" do monitoramento

**Sem mudança técnica** — o fluxo atual já funciona:
- Após instalação concluída → vai para `useInstalacoesAguardandoAprovacao` (monitoramento).
- Monitoramento aprova → `useAprovarInstalacaoMonitoramento` ativa cobertura total + status `ativo` → tela pública entra em `criar_conta` (linhas 365-379) → cliente cria acesso ao app.

Apenas **documentar visualmente** isso na tela do analista (ao aprovar, mostrar toast: *"Aprovado! Após instalação, o monitoramento dará o segundo check para liberação total."*).

## Resumo do fluxo desejado (após mudanças)

```
1. Cliente assina contrato + agenda vistoria/instalação
   ↓
2. Aparece na fila do ANALISTA DE CADASTRO (badge "Agendado")
   • Tela pública mostra: "Em Análise Cadastral"
   ↓
3. Analista revisa documentação + contrato (não pode aprovar ainda)
   ↓
4. Vistoria/autovistoria/instalação é EXECUTADA
   ↓
5. Analista AGORA pode aprovar → ativa cobertura roubo/furto, status veículo = 'instalacao_pendente' ou 'ativo'
   ↓
6. Se rastreador necessário: instalação concluída entra na fila do MONITORAMENTO
   ↓
7. Monitoramento aprova ("segundo check") → cobertura total + status 'ativo'
   ↓
8. Tela pública mostra "Crie sua Conta!" → app do associado liberado
```

## Validação

1. Logar como diretor (`admin@teste.com` / `123456789`).
2. Criar/encontrar uma cotação com contrato assinado e vistoria **apenas agendada** (sem fotos enviadas).
3. Acessar `/cadastro/propostas-pendentes` → deve aparecer com badge "Agendado".
4. Abrir a proposta → análise documental disponível, botão "Aprovar" desabilitado com tooltip.
5. Acessar a tela pública (`/proposta/:token`) → mostrar "Em Análise Cadastral".
6. Simular conclusão da vistoria → botão "Aprovar" libera.
7. Aprovar → instalação criada/ativada → após instalação, aparecer em `/monitoramento/aprovacao-instalacoes`.
8. Monitoramento aprova → tela pública vai para "Crie sua Conta!".

## Arquivos a editar

- `src/hooks/usePropostasPendentes.ts` (regra de inclusão + campo `tipo_etapa_analise`)
- `src/pages/cadastro/PropostasPendentes.tsx` (badge "Agendado")
- `src/pages/cadastro/PropostaAnalise.tsx` (bloqueio do botão Aprovar + banner)
- `src/pages/public/AcompanhamentoProposta.tsx` (mensagem "Em Análise Cadastral" desde agendamento)

