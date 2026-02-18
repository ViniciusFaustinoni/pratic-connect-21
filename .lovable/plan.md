

# Card de Controle de Fluxo de Reparo + Menu de Acoes Contextual

## Contexto

Quando um sinistro esta com status `aprovado`, cota paga (`cota_paga = true`) e termo assinado (`termo_anuencia_assinado = true`), o menu de acoes atual exibe opcoes irrelevantes (Agendar Vistoria, Emitir Parecer, Criar OS, etc). O fluxo correto exige que o analista de eventos passe por etapas sequenciais de reparo antes de enviar o veiculo a oficina.

## Resumo das Mudancas

### 1. Menu de Acoes Contextual (SinistroDetalhe.tsx)

Quando o sinistro estiver `aprovado` + `cota_paga` + `termo_anuencia_assinado`:
- Remover todas as opcoes atuais do dropdown
- Exibir apenas **"Fazer Pedidos das Pecas"**
- Ao clicar, abre o dialog `AtribuirFornecedoresDialog` (ja existente) que atribui oficina e envia cotacoes aos auto centers
- Apos atribuicao, status muda para `pecas_em_cotacao` (fluxo ja implementado)

Quando em `pecas_em_cotacao`: o menu ja fica oculto (comportamento existente na linha 1700).

### 2. Novo Card "Controle do Reparo" (novo componente)

**Arquivo: `src/components/sinistros/CardControleReparo.tsx`**

Card exibido na coluna direita do SinistroDetalhe quando status e `aprovado` (com cota paga) ou `pecas_em_cotacao` ou `em_reparo`.

**Fases visuais do card:**

```text
Fase 1 - Pedido de Pecas (status: aprovado, cota_paga=true)
  [Botao] "Fazer Pedidos das Pecas"
  -> Abre AtribuirFornecedoresDialog

Fase 2 - Pecas em Cotacao (status: pecas_em_cotacao)
  Lista de pecas do orcamento com:
    - Nome da peca
    - Fornecedor atribuido (se houver cotacao aprovada)
    - Botao de contato (telefone fixo = icone ligacao, whatsapp = abre conversa)
    - [Checkbox] "Pedido realizado" (marcacao manual pelo analista, salvo em dados_vistoria ou campo auxiliar)
  Quando pedidos realizados:
    - Checkboxes individuais por peca: "Peca chegou"
    - Salvamento automatico ao marcar cada checkbox

Fase 3 - Todas as Pecas Chegaram
  -> Notifica associado via WhatsApp ("Todas as pecas chegaram!")
  -> Exibe novo botao "Enviar para Oficina"

Fase 4 - Enviar para Oficina
  [Botao] "Enviar para Oficina"
  -> Cria chamado de assistencia 24h tipo "guincho" para remocao do veiculo ate a oficina ja atribuida
  -> Status do sinistro: "em_reparo"
  -> Card mostra: Veiculo + Badge "Pendente de Remocao para Oficina"

Fase 5 - Chamado Finalizado (chamado assistencia = finalizado)
  -> Badge muda para "Veiculo na Oficina"
  -> Notifica associado: "Seu veiculo ja se encontra na oficina e o reparo sera iniciado"
  -> A partir daqui, atualizacoes vem do regulador (checklist diario)
```

### 3. Persistencia do estado das pecas

Utilizar a tabela `sinistros` com novos campos ou reutilizar `dados_vistoria` na `vistorias_evento`:
- Adicionar coluna `pecas_pedido_realizado` (boolean) na tabela `sinistros`
- Usar array JSON `pecas_status` no sinistro ou na vistoria para rastrear chegada individual das pecas

**Migration SQL:**
```text
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS pecas_pedido_realizado boolean DEFAULT false;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS pecas_status jsonb DEFAULT '[]';
```

O `pecas_status` tera formato:
```text
[
  { "descricao": "Para-choque dianteiro", "chegou": false, "chegou_em": null },
  { "descricao": "Farol esquerdo", "chegou": true, "chegou_em": "2026-02-18T..." }
]
```

### 4. Criacao automatica de chamado de assistencia (guincho)

Quando o analista clica "Enviar para Oficina":
1. Buscar oficina atribuida no sinistro (`oficina_id`)
2. Criar registro em `chamados_assistencia` com tipo `guincho`, vinculando `sinistro_id`
3. Atualizar sinistro para `em_reparo`
4. Registrar historico

Quando o chamado de assistencia for finalizado (via realtime ou polling):
- Atualizar card automaticamente para "Veiculo na Oficina"
- Notificar associado via WhatsApp

### 5. Modal de Pecas com Contato do Fornecedor

Dentro do card, a lista de pecas mostrara:
- Dados do auto center que ganhou a cotacao (da tabela `evento_cotacoes_pecas` com status `aprovado`)
- Botoes de contato:
  - Se tem `whatsapp`: botao abre wa.me
  - Se tem `telefone`: botao tel:

### 6. Notificacoes WhatsApp

- **Ao clicar "Fazer Pedidos"**: IA informa ao associado que as pecas estao em fase de cotacao (ja implementado no `AtribuirFornecedoresDialog`)
- **Todas as pecas chegaram**: Notificar associado via `whatsapp-send-text`
- **Veiculo na oficina**: Notificar associado via `whatsapp-send-text`

## Arquivos a criar/modificar

1. **`src/components/sinistros/CardControleReparo.tsx`** -- novo componente do card
2. **`src/pages/eventos/SinistroDetalhe.tsx`** -- integrar card + filtrar menu de acoes
3. **Migration SQL** -- adicionar colunas `pecas_pedido_realizado` e `pecas_status`
4. **`src/integrations/supabase/types.ts`** -- atualizar tipos

## Detalhes tecnicos

- O card usa queries reativas (`useQuery`) para buscar estado das pecas e do chamado de assistencia
- Checkboxes fazem `update` direto no sinistro via `useMutation`
- O estado do chamado de assistencia e monitorado via `useQuery` com refetch interval ou via `useChamadosRealtime`
- A lista de pecas vem da `vistorias_evento.dados_vistoria.itens_orcamento` filtrada por `tipo === 'peca'`
- O fornecedor aprovado vem de `evento_cotacoes_pecas` com `status === 'aprovado'`

