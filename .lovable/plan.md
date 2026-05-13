## Objetivo

Eliminar a etapa manual "Aprovação do Cadastro" na Troca de Titularidade. Quando o termo de cancelamento já está assinado e a cotação é vinculada, a solicitação avança automaticamente para `liberada_para_assinatura` — o novo titular segue direto pelo link público sem ficar travado em "Em análise pelo Cadastro".

A aprovação do **Monitoramento** continua existindo (ela é disparada após a vistoria do novo titular, fluxo já ativo).

## Mudanças

### 1. Auto-aprovação do Cadastro ao vincular a cotação

`supabase/functions/vincular-cotacao-troca/index.ts`:
- Hoje seta `status = 'cotacao_em_andamento'`. Passa a setar **direto**:
  - `status = 'liberada_para_assinatura'`
  - `aprovado_cadastro_em = now()`
  - `aprovado_cadastro_por = null` (auto)
  - `observacao_cadastro = 'Auto-aprovado: termo de cancelamento assinado'`
- A validação de termo assinado já existe (linhas 62–67). Se faltar termo, mantém o erro `TERMO_NAO_ASSINADO`.

### 2. Reaproveitar o background work do `aprovar-troca-cadastro`

A função atual de aprovação manual roda, em background, três tarefas importantes:
- snapshot SGA do novo titular (análise prévia),
- atribuição automática ao vendedor,
- disparo de WhatsApp para o novo titular.

Plano:
- Extrair esse bloco para `supabase/functions/_shared/troca-pos-cadastro-bg.ts` (`runPosCadastroBackground(admin, sol)`).
- `aprovar-troca-cadastro` passa a importar e chamar esse helper.
- `vincular-cotacao-troca` passa a chamar o mesmo helper via `EdgeRuntime.waitUntil`, garantindo paridade total entre o fluxo manual (legado) e o automático.

### 3. Manter a porta legada de aprovação manual

Não removemos `aprovar-troca-cadastro` — em casos de exceção (ex.: solicitação criada antes desta mudança e ainda em `aguardando_cadastro`) o operador ainda consegue aprovar pelo painel. O CAS (`.eq('status', 'aguardando_cadastro')`) garante idempotência.

### 4. Esconder a fila "Aprovação do Cadastro" da Troca

`src/pages/cadastro/ProcessosOperacionais.tsx`:
- A aba/fila "Pendentes" da Troca lista hoje `['aguardando_cadastro', 'cotacao_em_andamento']`. Com o novo fluxo, o estado normal é nunca cair aí.
- Mantemos a aba para casos legados/órfãos, mas o botão "Aprovar Cadastro" no `ModalDetalhesTroca` ganha um aviso: *"Esta etapa agora é automática quando o termo é assinado. Use só para itens legados."*

### 5. Atualizar a tela pública e a timeline

`src/components/troca-titularidade/TelaAnaliseTrocaTitularidade.tsx` e `TimelineAprovacao.tsx`:
- Ajustar o passo "Análise do Cadastro" para mostrar **"Aprovação automática (termo assinado)"** marcado como concluído já em `liberada_para_assinatura`.
- A tela "Em análise pelo Cadastro" só aparece em itens legados. No fluxo novo, o público pula direto para Documentos/Vistoria/Pagamento.

### 6. Reset da troca da KOU6D37 (Marcus Vinicius)

Migration única para voltar a solicitação `52cc74c1-...` ao estágio "termo assinado, sem cotação":

```sql
DELETE FROM public.agendamentos_base WHERE cotacao_id IN (
  -- qualquer cotação vinculada/órfã da troca
  SELECT id FROM public.cotacoes
   WHERE veiculo_placa = 'KOU6D37' AND tipo_entrada = 'troca_titularidade'
);
DELETE FROM public.cotacoes
 WHERE veiculo_placa = 'KOU6D37' AND tipo_entrada = 'troca_titularidade';

UPDATE public.solicitacoes_troca_titularidade
   SET status                     = 'aguardando_cadastro',
       cotacao_id                 = NULL,
       aprovado_cadastro_em       = NULL,
       aprovado_cadastro_por      = NULL,
       observacao_cadastro        = NULL,
       aprovado_monitoramento_em  = NULL,
       aprovado_monitoramento_por = NULL,
       observacao_monitoramento   = NULL,
       servico_vistoria_id        = NULL,
       analise_previa_resultado   = NULL,
       analise_previa_em          = NULL,
       efetivada_em               = NULL,
       motivo_reprovacao          = NULL,
       reprovado_por              = NULL,
       reprovado_em               = NULL,
       updated_at                 = now()
 WHERE id = '52cc74c1-910d-4ac7-b854-84cd28db7a0d';
```

Mantém: `termo_cancelamento_assinado_em`, `novo_titular_dados`, `veiculo_id`, `associado_antigo_id`, `veiculos.em_troca_titularidade=true`.

A partir desse ponto, abrir a solicitação → "Realizar Cotação" → ao salvar o plano, a edge `vincular-cotacao-troca` já vai aplicar a auto-aprovação do cadastro, e o link público abrirá direto na etapa do novo titular.

### 7. Memória do projeto

Atualizar `mem://logic/operations/troca-titularidade-monitoramento-pos-vistoria` (ou criar nova memory `troca-titularidade-cadastro-auto`) descrevendo o novo comportamento: "Cadastro é auto-aprovado em `vincular-cotacao-troca` quando termo assinado; aprovar-troca-cadastro vira fallback legado."

## Fora de escopo

- Mexer no fluxo do Monitoramento (continua igual: vistoria → `aguardando_monitoramento` → aprovação manual).
- Mudar o gating do termo (continua sendo pré-requisito para vincular cotação).
- Remover a edge legada `criar-cotacao-troca-titularidade` (já está em 410).