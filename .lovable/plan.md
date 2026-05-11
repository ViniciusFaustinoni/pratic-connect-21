# Edição da cotação de Troca de Titularidade pelo consultor

## Objetivo
Permitir ao criador da solicitação de troca **editar a cotação** (tipo de uso, região, cenário de adesão, planos elegíveis etc.) a qualquer momento **antes do novo associado receber o termo de filiação** (geração do contrato Autentique). Os dados do veículo permanecem **fixos** (não editáveis), pois já vêm da base / SGA.

Ajustes adicionais na linha de "Outros Processos":
- Substituir o ícone de **olho** (ações) por **lápis** (editar).
- Detalhes/timeline passam a abrir ao **clicar na linha** da solicitação.
- Ícone do **Autentique** (termo de cancelamento) **some após a assinatura** do termo.

## Escopo

### 1. `src/components/cotacoes/OutrosProcessosPanel.tsx`
- Trocar o botão `Eye` por `Pencil` na coluna **Ações** (somente para `tipo === 'troca_titularidade'`; nos demais tipos manter o comportamento atual).
- Pencil → `navigate('/vendas/cotador?tipo_entrada=troca_titularidade&cotacao_id=<id>&solicitacao_id=<id>')`.
- Tornar a linha inteira clicável (com `cursor-pointer`) para abrir o `TrocaTimelineDrawer` (já existente). Garantir `e.stopPropagation()` nos botões da coluna Ações para não disparar o drawer.
- Esconder o botão Pencil quando a edição não for mais permitida — usar nova flag `pode_editar` (ver passo 3) que vira `false` assim que o contrato é gerado / `termo_filiacao` é enviado ao novo titular. Quando bloqueado, exibir apenas o ícone do Autentique e ExternalLink.
- Esconder o botão do **Autentique** (`item.termo_url`) quando `item.termo_status === 'assinado'`.

### 2. `src/hooks/useOutrosProcessos.ts`
- Adicionar campo `pode_editar: boolean` em `OutroProcessoItem`.
- Calcular `pode_editar = tipo === 'troca_titularidade' && !contrato_gerado_em` consultando `contratos` por `origem_troca_titularidade_id IN (solicitacoes.id)` (campo `id` ou `assinatura_url IS NOT NULL`/`status != rascunho`). Reaproveitar a query já existente que busca trocas; um único `select id, origem_troca_titularidade_id, assinatura_url` em `contratos` cobre o lote.
- Critério canônico: `pode_editar = false` se existir contrato com `origem_troca_titularidade_id` da solicitação **e** (`assinatura_url IS NOT NULL` OR status diferente de `rascunho`/`cancelado`). Caso contrário `true`.

### 3. `src/pages/vendas/Cotador.tsx` — modo "edição de troca"
Adicionar um modo análogo aos já existentes (`isInclusaoVeiculo`, `isSubstituicao`):
- Ler `searchParams`: `tipo_entrada=troca_titularidade`, `cotacao_id`, `solicitacao_id`.
- `isEdicaoTroca = tipo_entrada === 'troca_titularidade' && !!cotacao_id`.
- Carregar a cotação existente via `supabase.from('cotacoes').select('*').eq('id', cotacao_id)` e a `solicitacao` para validar que ela está em status editável e pertence ao vendedor logado (mesma checagem de permissão usada em `OutrasEntradasMenu`).
- **Pre-fill** dos campos do veículo (placa, marca, modelo, ano, combustível, cor, FIPE, código FIPE, categoria) e marcá-los como **somente leitura** (`disabled`/`readOnly` nos inputs do bloco "Veículo"). Pular a etapa de busca por placa quando `isEdicaoTroca`.
- Manter editáveis: `regiao`, `usoApp` (tipo de uso), `cenarioExterno` (cenário de adesão), `valorAdesaoCustom`, `valorExtra`, escolha do plano, indicação, etc.
- Reaproveitar `usePlanosCotacao` com os mesmos parâmetros já calculados — funciona de forma idêntica a uma cotação nova.
- No `handleSalvarEEnviarWhatsApp`:
  - Em vez de criar nova cotação, **fazer UPDATE** em `cotacoes` (`id = cotacao_id`) preservando `dados_extras.tipo_entrada='troca_titularidade'`, `token_publico` e demais flags da troca (não regerar token).
  - Atualizar `plano_id`, `regiao`, `uso_aplicativo`, `cenario_adesao`, `valor_adesao`, `valor_total_mensal`, `tipo_instalacao`, `valor_extra`.
  - Após o update, navegar de volta para `/vendas/cotacoes` (aba Outros Processos) com `toast.success`.
- Bloquear acesso direto à URL se a solicitação não puder mais ser editada (mostra mensagem e redireciona).

### 4. Hook auxiliar `useTrocaCotacaoEditavel(cotacao_id)` (opcional, recomendado)
Pequeno hook que retorna `{ cotacao, solicitacao, pode_editar, motivo_bloqueio }` para isolar a lógica de carregamento e gating, usado tanto no Cotador quanto no Panel.

## Fora de escopo
- Não alterar o termo de cancelamento, fluxo Autentique ou edge functions de troca.
- Não alterar o fluxo público (`CotacaoContratacao.tsx`); ele continua lendo a cotação atualizada.
- Múltiplos planos por cotação não estão na cotação atual; mantemos 1 plano por cotação como hoje (o "incluir mais planos" do pedido se traduz em "trocar/recalcular o plano selecionado", igual ao Cotador padrão).

## Detalhes técnicos
- Critério "antes de receber o termo de filiação" = não existe `contratos.assinatura_url` para `origem_troca_titularidade_id = solicitacao.id`. Após o novo titular gerar o contrato (rota pública), `pode_editar` vira `false`.
- Permissão: somente o `criado_por` da solicitação ou usuários com `cotacao.viewScope !== 'own'` (gestores) podem editar.
- Dados do veículo travados na UI via `disabled` nos inputs e ocultando o bloco "Buscar placa" quando `isEdicaoTroca`.
- Não criar migrations — não há mudança de schema.
