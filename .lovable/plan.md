# Substituição: 2 agendamentos quando locais diferentes

## Estado atual

Hoje a Substituição no link público já mostra a pergunta **"Os dois veículos estarão no mesmo local?"** (`AgendamentoSubstituicao.tsx`), mas a resposta vira só um flag de UI (`substituicaoMesmoLocal`) que **nunca chega no backend**. Independente da escolha, o fluxo cai em **uma única `EtapaVistoria`**, gera **1 `agendamento_base`** e o `criar-instalacao-pos-pagamento` materializa **2 serviços no mesmo agendamento** (`instalacao` do veículo novo + `vistoria_retirada` do veículo antigo, mesmo endereço, mesma data, mesmo período).

A mensagem na UI já promete "Dois agendamentos separados" para a opção "Não", mas isso não acontece de fato.

## O que muda

### Comportamento

- **Mesmo local** (sem mudança): continua como hoje — 1 `agendamento_base` com 2 serviços no mesmo endereço/data/período.
- **Locais diferentes** (novo comportamento): cliente preenche **dois formulários de agendamento**, em sequência, **instalação primeiro, depois retirada**, cada um com data/período/endereço próprios e totalmente independentes (sem trava de ordem cronológica entre eles).

### Fluxo na etapa "Vistoria" do link público (substituição)

```text
[AgendamentoSubstituicao "mesmo local?"]
        │
   ┌────┴─────┐
   │          │
  SIM        NÃO
   │          │
   │   [Form 1: INSTALAÇÃO (veículo novo)]
   │          │  (data + período + endereço novo)
   │          ▼
   │   [Form 2: RETIRADA (veículo antigo)]
   │          │  (data + período + endereço antigo)
   │          ▼
   │   confirma os dois → cria 2 agendamentos_base separados
   │
   └─→ [EtapaVistoria normal] → 1 agendamento_base + 2 serviços
```

UI:
- Cabeçalho mostra os dois veículos com badges "1 de 2 – Instalação (novo)" e "2 de 2 – Retirada (antigo)".
- Botão "Voltar para o veículo anterior" no Form 2 para corrigir o Form 1 antes de confirmar.
- Confirma só no final, em uma chamada única ao backend (atômica).

## Detalhes técnicos

### Frontend

1. `src/components/cotacao-publica/AgendamentoSubstituicao.tsx`
   - Mantém a pergunta inicial. Sem mudança visual relevante.

2. `src/pages/public/CotacaoContratacao.tsx` (etapa 4, ramo `isSubstituicao`)
   - Quando `substituicaoMesmoLocal === true` → renderiza `EtapaVistoria` como hoje.
   - Quando `substituicaoMesmoLocal === false` → renderiza um novo wrapper `AgendamentoSubstituicaoSeparado` (componente novo) que reusa internamente o mesmo formulário de agendamento da `EtapaVistoria` em dois passos.

3. Novo componente `src/components/cotacao-publica/AgendamentoSubstituicaoSeparado.tsx`
   - Encapsula 2 passos visuais (instalação → retirada) com estado local (`dadosInstalacao`, `dadosRetirada`).
   - Reaproveita o mesmo formulário de endereço/data/período que `AgendamentoVistoria` já usa (extraído para um subcomponente puro, se necessário).
   - No "Confirmar", chama uma nova edge function única que recebe os dois payloads.

### Backend

4. Nova edge function `supabase/functions/criar-substituicao-agendamentos-separados/index.ts`
   - Input: `{ cotacao_id, instalacao: {data, periodo, endereco}, retirada: {data, periodo, endereco} }`.
   - Reusa a mesma rotina interna de `criar-instalacao-pos-pagamento` para o serviço de instalação (com seu próprio `agendamento_base`), e cria um **segundo `agendamento_base`** + serviço `vistoria_retirada` para o veículo antigo, com data/endereço próprios.
   - Idempotência: chave `(cotacao_id, "separado")` para não duplicar em re-submit; também idempotente por `(veiculo_antigo_id)` para a retirada (já existe na lógica atual).
   - Marca `cotacoes.dados_extras.substituicao_agendamentos_separados = true` para auditoria.

5. `supabase/functions/criar-instalacao-pos-pagamento/index.ts`
   - Bloco 6.2 (retirada) ganha um guard: **pula** a criação da retirada quando `dados_extras.substituicao_agendamentos_separados === true` (porque a edge nova já fez).
   - Quando flag ausente / false → comportamento atual (1 agendamento, 2 serviços).

### Banco / regras canônicas

- A regra "1 agendamento ativo por origem" (trigger `trg_sync_agendamento_base_on_servico_terminal`) continua valendo: aqui são **duas origens diferentes** (veículo novo vs. veículo antigo), então 2 `agendamento_base` é legítimo.
- Memória `mem://logic/operations/substituicao-2-servicos-agendamento` será atualizada para descrever as duas variantes (mesmo local vs. separado).
- Nenhuma migração de schema necessária.

### Compatibilidade

- Não afeta substituições já materializadas (idempotência por flag em `dados_extras`).
- Não afeta Troca de Titularidade (que continua sem agendamento de retirada — veículo é só transferido).
- Não afeta Nova Adesão nem Sub-FIPE.

## Validação

- E2E manual com a credencial admin (cotação de substituição, optar por "locais diferentes"): conferir aparecem os 2 forms, depois confirmar e checar no banco que existem **2 linhas em `agendamentos_base`** ligadas à cotação, com 1 serviço cada (`instalacao` e `vistoria_retirada`).
- Caso "mesmo local": confere que permanece 1 `agendamento_base` com 2 serviços (regressão).
- Verifica filas: ambos serviços aparecem na fila de atribuição do Monitoramento, cada um na sua data.
