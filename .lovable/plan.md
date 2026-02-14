

# Geracao Automatica de OS e Painel "Veiculos em Oficina" do Regulador

## Resumo

Duas entregas principais: (1) Edge function que gera a OS automaticamente quando uma cotacao e aprovada, incluindo todos os itens do orcamento e envio de WhatsApp ao associado; (2) Nova aba "Oficina" no app do regulador com dashboard completo de veiculos em oficina.

---

## PARTE 1 — Geracao Automatica da OS

### Problema Atual

A OS e criada no `AtribuirFornecedoresDialog.handleSubmit` (linha 140) com status `aguardando_orcamento`, MAS os itens do orcamento nao sao inseridos na tabela `ordens_servico_itens`. Alem disso, o status deveria ser `aguardando_entrada` para refletir que o veiculo ainda nao chegou na oficina.

O status `aguardando_entrada` nao existe no enum `status_ordem_servico`. Precisamos adiciona-lo.

### Etapa 1.1 — Migration: adicionar status `aguardando_entrada` ao enum

```text
ALTER TYPE status_ordem_servico ADD VALUE IF NOT EXISTS 'aguardando_entrada' BEFORE 'aguardando_orcamento';
```

Tambem adicionar colunas a `ordens_servico` para rastreabilidade:

```text
ALTER TABLE ordens_servico
  ADD COLUMN IF NOT EXISTS auto_center_id uuid REFERENCES auto_centers(id),
  ADD COLUMN IF NOT EXISTS cotacao_aprovada_id uuid REFERENCES evento_cotacoes_pecas(id),
  ADD COLUMN IF NOT EXISTS etapas_reparo jsonb DEFAULT '[]';
```

### Etapa 1.2 — Modificar `useCotacoesEvento.ts` (aprovarCotacao)

Apos aprovar a cotacao (update em `evento_cotacoes_pecas`), adicionar logica para:

1. Buscar dados do sinistro (veiculo_id, associado_id, oficina_id, protocolo)
2. Buscar vistoria concluida (itens_orcamento, etapas_reparo)
3. Buscar cotacao aprovada (resposta com valores atualizados)
4. Criar OS com:
   - `oficina_id` do sinistro
   - `auto_center_id` do auto center aprovado
   - `cotacao_aprovada_id`
   - `etapas_reparo` como JSONB (cada etapa com nome e status "pendente")
   - `status`: `aguardando_entrada`
5. Inserir itens na `ordens_servico_itens`:
   - Para pecas: usar valores da cotacao aprovada (resposta.itens)
   - Para mao de obra e servicos: usar valores do orcamento do regulador
6. Chamar `whatsapp-send-text` apos 15 min via agendamento (ou imediatamente com mensagem sobre pecas em cotacao)

Como o agendamento de 15 minutos e complexo, a alternativa pratica e enviar o WhatsApp imediatamente na aprovacao. A mensagem sera enviada via edge function existente `whatsapp-send-text`.

### Etapa 1.3 — Criar Edge Function `gerar-os-cotacao-aprovada`

Uma edge function dedicada que centraliza a logica de criacao de OS. Chamada pelo frontend apos aprovacao da cotacao.

Recebe: `sinistro_id`, `cotacao_id`

Acoes:
1. Busca sinistro com veiculo e associado
2. Busca vistoria concluida (itens + etapas)
3. Busca cotacao aprovada com resposta
4. Busca prestadores vinculados
5. Cria OS com status `aguardando_entrada`
6. Insere itens no `ordens_servico_itens` (pecas com valores da cotacao, MO/servicos do orcamento)
7. Registra historico da OS
8. Envia WhatsApp ao associado confirmando que tudo esta encaminhado
9. Retorna OS criada

---

## PARTE 2 — Painel "Veiculos em Oficina" do Regulador

### Etapa 2.1 — Criar hook `useVeiculosOficina.ts`

Query que busca todas as `ordens_servico` com status ativo (nao cancelado, nao finalizado), com joins em:
- `oficinas` (nome, endereco)
- `veiculos` (placa, marca, modelo, ano, cor)
- `associados` (nome, telefone)
- `sinistros` (protocolo)
- `auto_centers` via `auto_center_id` (nome)

Inclui contadores agregados por status e filtros (oficina, status, tempo, busca por placa/nome).

### Etapa 2.2 — Criar pagina `ReguladorOficina.tsx`

Nova pagina em `src/pages/regulador/ReguladorOficina.tsx` com:

**Dashboard de contadores** (grid 2x2 ou 3 colunas):
- Total em oficina
- Aguardando entrada
- Aguardando peca
- Em finalizacao / Concluidos

**Filtros**: oficina (dropdown), status (select), tempo em oficina (select), busca por placa/nome (input)

**Lista de cards** — cada card mostra:
- Placa (destaque), marca/modelo/ano/cor
- Nome e telefone do associado (com botao WhatsApp)
- Numero da OS, oficina, auto center fornecedor
- Status (badge colorido)
- Data de entrada, tempo em oficina ("Ha X dias")
- Barra de progresso das etapas: lida de `etapas_reparo` JSONB, mostra cada etapa com icone de status
- Alerta de tempo: >24h sem updated_at = amarelo, >48h = vermelho

**Acoes por card**:
- "Registrar Entrada": update status para `em_execucao`, registra data_entrada
- "Registrar Atualizacao": placeholder para proximo prompt
- "Ver Detalhes": navega para `/oficinas/ordens/:id`

**Metricas de oficinas**: secao inferior com ranking de oficinas (nome, qtd veiculos, tempo medio)

### Etapa 2.3 — Atualizar `ReguladorLayout.tsx`

Adicionar item de navegacao "Oficina" com icone `Wrench`:

```text
NAV_ITEMS = [
  { icon: Home, label: 'Inicio', path: '/regulador' },
  { icon: ClipboardList, label: 'Vistorias', path: '/regulador/vistorias' },
  { icon: Wrench, label: 'Oficina', path: '/regulador/oficina' },
  { icon: User, label: 'Perfil', path: '/regulador/perfil' },
]
```

### Etapa 2.4 — Atualizar `App.tsx`

Adicionar rota:

```text
<Route path="/regulador/oficina" element={<ReguladorOficina />} />
```

---

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Migration SQL | Adicionar `aguardando_entrada` ao enum + colunas `auto_center_id`, `cotacao_aprovada_id`, `etapas_reparo` em `ordens_servico` |
| Criar | `supabase/functions/gerar-os-cotacao-aprovada/index.ts` |
| Modificar | `src/hooks/useCotacoesEvento.ts` — apos aprovar cotacao, chamar edge function para gerar OS |
| Criar | `src/hooks/useVeiculosOficina.ts` |
| Criar | `src/pages/regulador/ReguladorOficina.tsx` |
| Modificar | `src/components/regulador/ReguladorLayout.tsx` — adicionar nav item "Oficina" |
| Modificar | `src/App.tsx` — adicionar rota `/regulador/oficina` |
| Modificar | `supabase/config.toml` — registrar nova edge function |

---

## Fluxo Completo

```text
Cotacao aprovada no CotacoesRecebidasTab
  |
  v
useCotacoesEvento.aprovarCotacao
  -> Marca cotacao como aprovada
  -> Chama edge function "gerar-os-cotacao-aprovada"
  |
  v
Edge function:
  -> Cria OS com status "aguardando_entrada"
  -> Insere itens (pecas com valores da cotacao, MO/servicos do orcamento)
  -> Salva etapas_reparo como checkpoints
  -> Envia WhatsApp ao associado
  |
  v
Regulador acessa aba "Oficina"
  -> Ve dashboard de contadores
  -> Ve lista de veiculos com progresso
  -> Registra entrada do veiculo
  -> Acompanha etapas de reparo
```
