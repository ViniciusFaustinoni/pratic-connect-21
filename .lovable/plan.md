

## Substituição: termo de cancelamento + dois agendamentos no fluxo público

### Confirmação prévia

**O termo de cancelamento já existe no sistema.** Ele é gerado pela edge function `autentique-cancelamento-create`, lê o template `termo_cancelamento` da tabela `documento_templates` (com fallback hardcoded), envia ao Autentique com biometria por CPF e grava `autentique_cancelamento_id` / `autentique_cancelamento_url` no contrato antigo. Hoje é usado em dois fluxos: (1) `concluir-retirada` quando origem é `cancelamento_ia` e (2) `enviar-termo-cancelamento-troca` para troca de titularidade. Vamos reutilizá-lo para substituição.

### O que já está pronto (não vamos refazer)

- Detecção `isSubstituicao` em `CotacaoContratacao.tsx` (via `dados_extras.tipo_entrada === 'substituicao'`).
- Componente `AgendamentoSubstituicao` que pergunta "mesmo local?" e gera dois agendamentos quando `não`.
- Função `autentique-cancelamento-create` (gera termo + envia Autentique + biometria CPF).
- Webhook `autentique-webhook` já reconhece assinatura de termo de cancelamento via `autentique_cancelamento_id` em contratos.
- Tabela `substituicoes_veiculo` com `servico_retirada_id`, `servico_instalacao_id`, `contrato_novo_id`.

### O que falta (escopo desta entrega)

#### 1. Etapa de assinatura: dois sub-passos quando for substituição

Substituir, **só para substituição**, o `EtapaAssinaturaContrato` por um novo wrapper `EtapaAssinaturaSubstituicao` que renderiza um stepper interno de 2 etapas:

```text
[ 1. Termo de Cancelamento (veículo antigo) ]  →  [ 2. Termo de Filiação (veículo novo) ]
       aguardando assinatura                              bloqueado até #1 assinar
```

Comportamento:
- **Sub-etapa 1 — Cancelamento**: ao entrar na etapa 2 do stepper externo, dispara `autentique-cancelamento-create` apontando para o `associado_id` + `contrato_antigo_id` (descobertos via `substituicoes_veiculo` da cotação). Mostra status (enviado/aguardando/assinado), link de assinatura por e-mail e polling do status do Autentique no contrato antigo.
- **Sub-etapa 2 — Filiação**: só desbloqueia quando o contrato antigo tiver `autentique_cancelamento_id` com status assinado (campo `autentique_cancelamento_assinado_em`, ver migração abaixo). Aí renderiza o `EtapaAssinaturaContrato` atual (que já gera o contrato novo via `autentique-create-by-token`).
- Layout: dois cards verticais com badges "Etapa 1 de 2" / "Etapa 2 de 2", ícone `FileSignature`, e mensagem clara explicando que a filiação do novo só é liberada após o cancelamento do antigo.

#### 2. Persistência do estado de assinatura do cancelamento

Adicionar coluna `autentique_cancelamento_assinado_em timestamptz` em `contratos` (já existem `autentique_cancelamento_id` e `autentique_cancelamento_url`).

Atualizar `autentique-webhook/index.ts` no bloco de FALLBACK 4 ("Buscar em contratos (cancelamento)") para também gravar `autentique_cancelamento_assinado_em = NOW()` quando o evento for `signature.accepted`. Hoje ele só loga; precisa persistir.

#### 3. Hook `useTermoCancelamentoSubstituicao`

Novo hook em `src/hooks/useTermoCancelamentoSubstituicao.ts` que:
- Recebe `cotacaoId`.
- Busca `substituicoes_veiculo` pela cotação → pega `associado_id` e o `contrato_id` ativo do veículo antigo.
- Expõe: `enviar()` (invoca `autentique-cancelamento-create`), `status` (`nao_enviado | enviado | assinado`), `linkAssinatura`, `assinadoEm`.
- Faz polling leve (a cada 8s) do contrato antigo enquanto status for `enviado`.

#### 4. Etapa de vistoria/agendamento (já existe, só ajuste cosmético)

A pergunta "mesmo local?" e a criação dos dois serviços já está implementada via `AgendamentoSubstituicao` + lógica downstream em `concluir-retirada` / `efetivar-substituicao`. **Não vamos mexer aqui** — apenas confirmar que continua funcionando após o split da etapa de assinatura.

#### 5. Bloqueio de avanço

No `CotacaoContratacao.tsx`, ajustar `handleAvancar` e `isEtapaConcluida(2)` para considerar a etapa de assinatura concluída **apenas quando ambos** os termos (cancelamento + filiação) estiverem assinados em substituição.

### Detalhes técnicos

**Arquivos novos**
- `src/components/cotacao-publica/EtapaAssinaturaSubstituicao.tsx` — wrapper com stepper interno e os dois sub-passos.
- `src/hooks/useTermoCancelamentoSubstituicao.ts` — orquestra envio e polling do termo de cancelamento.

**Arquivos editados**
- `src/pages/public/CotacaoContratacao.tsx` — quando `isSubstituicao`, renderizar `EtapaAssinaturaSubstituicao` em vez de `EtapaAssinaturaContrato` direto; ajustar `isEtapaConcluida(2)`.
- `supabase/functions/autentique-webhook/index.ts` — gravar `autentique_cancelamento_assinado_em` no fallback 4.

**Migration**
```sql
ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS autentique_cancelamento_assinado_em timestamptz;
```

**Sem alterações em** `autentique-cancelamento-create` (já está pronta), `AgendamentoSubstituicao`, `efetivar-substituicao`, `concluir-retirada`.

### Validação

1. Iniciar substituição via `Outras Entradas › Substituição de Placa`, gerar link público.
2. Avançar até etapa de contrato → ver dois cards, "Filiação" desabilitado.
3. Disparar envio do termo de cancelamento → e-mail chega no associado, status passa a "Aguardando assinatura".
4. Assinar cancelamento (Autentique) → webhook grava `autentique_cancelamento_assinado_em` → card 2 desbloqueia automaticamente via polling.
5. Concluir filiação → segue para vistoria com a pergunta "mesmo local?" (fluxo atual intacto).
6. Conferir que dois serviços (`tipo: instalacao` e `tipo: retirada`) foram criados quando "locais diferentes".

