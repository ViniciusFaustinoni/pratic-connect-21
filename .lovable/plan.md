
# Modal de Atribuicao de Fornecedores e Cotacao de Pecas

## Resumo

Construir o modal completo de atribuicao de fornecedores que aparece quando um sinistro esta com status `pronto_para_oficina`. O modal permite selecionar oficina, prestadores e auto centers, e dispara cotacoes automaticas de pecas via WhatsApp para os auto centers selecionados.

---

## Etapa 1 — Criar tabela `evento_cotacoes_pecas`

Nova tabela para registrar pedidos de cotacao enviados a auto centers:

```text
CREATE TABLE evento_cotacoes_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid REFERENCES sinistros(id) NOT NULL,
  auto_center_id uuid REFERENCES auto_centers(id) NOT NULL,
  itens jsonb NOT NULL DEFAULT '[]',
  mensagem_enviada text,
  status varchar DEFAULT 'enviado',  -- enviado, respondido, expirado
  whatsapp_mensagem_id uuid REFERENCES whatsapp_mensagens(id),
  prazo_resposta timestamp with time zone,
  resposta jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

Tambem adicionar coluna na tabela `sinistros` para prestadores vinculados (JSONB array de IDs) ou criar tabela de relacionamento `sinistro_prestadores`:

```text
CREATE TABLE sinistro_prestadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid REFERENCES sinistros(id) NOT NULL,
  prestador_id uuid REFERENCES prestadores_evento(id) NOT NULL,
  observacoes text,
  created_at timestamptz DEFAULT now()
);
```

RLS policies para ambas tabelas com acesso autenticado.

---

## Etapa 2 — Criar componente `AtribuirFornecedoresDialog.tsx`

Arquivo: `src/components/sinistros/AtribuirFornecedoresDialog.tsx`

Modal dividido em 3 secoes:

**Cabecalho:** Dados do veiculo (marca, modelo, placa) + resumo do orcamento (itens de pecas extraidos de `dados_vistoria`).

**Secao 1 — Oficina (radio, selecao unica):**
- Busca oficinas filtradas automaticamente por `marcas_atendidas` (marca do veiculo OU "GLOBAL") e status ativo
- Cards com: nome, endereco, especialidades (badges), marcas (badges), nota_media
- Contagem de veiculos em oficina (query count de `ordens_servico` com status aberto para aquela oficina)
- Radio button para selecao unica

**Secao 2 — Prestadores (checkboxes, selecao multipla, opcional):**
- Busca prestadores por marca compativel e status ativo
- Sugere prestadores com especialidades complementares (especialidades do orcamento que a oficina selecionada nao cobre)
- Checkboxes para selecao multipla

**Secao 3 — Auto Centers (checkboxes, selecao multipla):**
- Busca auto centers por marca compativel e status ativo
- Filtra por especialidades compatíveis com os tipos de pecas do orcamento
- Mostra WhatsApp obrigatorio
- Preview da mensagem de cotacao
- Recomendacao: minimo 3 para comparacao de precos

**Botao "Confirmar Atribuicao":**
1. Cria OS vinculada a oficina selecionada (reutiliza logica de `EnviarParaOficinaDialog`)
2. Insere registros em `sinistro_prestadores`
3. Para cada auto center: cria registro em `evento_cotacoes_pecas` e invoca edge function para enviar WhatsApp

---

## Etapa 3 — Criar Edge Function `enviar-cotacao-pecas`

Arquivo: `supabase/functions/enviar-cotacao-pecas/index.ts`

Recebe: `sinistro_id`, `auto_center_id`, `itens` (array de pecas), `cotacao_id`

Acoes:
1. Busca dados do auto center (nome, whatsapp)
2. Busca dados do veiculo (marca, modelo, ano, placa)
3. Busca protocolo do sinistro
4. Monta mensagem formatada com a lista de pecas
5. Envia via `whatsapp-send-text` (ja existente)
6. Atualiza `evento_cotacoes_pecas` com `whatsapp_mensagem_id`

Mensagem modelo:
```text
Ola [Nome]! Aqui e a Pratic Car.
Precisamos de uma cotacao de pecas para:

Veiculo: [Marca] [Modelo] [Ano] - Placa: [Placa]

Itens para cotacao:
1. [Descricao] - Qtd: [X]
2. [Descricao] - Qtd: [X]

Prazo para resposta: 24 horas
Referencia: Evento #[Protocolo]

Responda com valor de cada item e prazo de entrega. Obrigado!
```

---

## Etapa 4 — Atualizar `SinistroAnalise.tsx`

No bloco de acoes (linhas 523-548), adicionar condicao para status `pronto_para_oficina`:

- Mostrar banner "Pagamento e termo confirmados — pronto para atribuir fornecedores"
- Botao "Atribuir Fornecedores" que abre o novo modal
- Substituir o atual `EnviarParaOficinaDialog` simples pelo novo `AtribuirFornecedoresDialog` para este status

Manter o `EnviarParaOficinaDialog` existente para status `aprovado` (fluxo legado/simplificado).

---

## Etapa 5 — Hook `useVistoriaEvento`

Criar hook para buscar dados da vistoria vinculada ao sinistro (para extrair `dados_vistoria.itens_orcamento` e `dados_vistoria.etapas_reparo`):

```text
useQuery(['vistoria-evento', sinistroId], ...)
  -> vistorias_evento WHERE sinistro_id = X AND status = 'concluida'
  -> retorna dados_vistoria parseado
```

---

## Arquivos afetados

| Acao | Arquivo |
|---|---|
| Migration SQL | Criar `evento_cotacoes_pecas` e `sinistro_prestadores` |
| Criar | `src/components/sinistros/AtribuirFornecedoresDialog.tsx` |
| Criar | `supabase/functions/enviar-cotacao-pecas/index.ts` |
| Criar | `src/hooks/useVistoriaEvento.ts` |
| Modificar | `src/pages/eventos/SinistroAnalise.tsx` — adicionar botao e condicao para `pronto_para_oficina` |
| Modificar | `src/hooks/useSinistroAnalise.ts` — incluir query de vistoria no retorno |

---

## Fluxo resumido

```text
Sinistro com status "pronto_para_oficina"
  |
  v
Analista/Regulador clica "Atribuir Fornecedores"
  |
  v
Modal abre com 3 secoes (filtradas por marca do veiculo):
  1. Seleciona 1 oficina (obrigatorio)
  2. Seleciona prestadores (opcional)
  3. Seleciona auto centers (recomendado min 3)
  |
  v
Confirmar Atribuicao:
  - Cria OS vinculada a oficina
  - Registra prestadores
  - Para cada auto center: registra cotacao + envia WhatsApp
  - Status sinistro -> "em_reparo"
```
