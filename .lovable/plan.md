

## Plano: Reformular Agente Consultor IA com Linhas de Produto, Cotacao por Placa e Registro de Cotacoes

### Contexto
O agente consultor IA atualmente lista planos individuais com valores por cobertura. Precisa ser reformulado para:
1. Trabalhar com **linhas de produto** (Select, Especial, Advanced, etc.) em vez de planos individuais
2. Mostrar **valor do plano** (nao por cobertura)
3. Perguntar a **placa** do veiculo para obter dados automaticamente (marca, modelo, ano, FIPE)
4. Coletar dados adicionais (tipo uso, combustivel, regiao) para calcular o preco correto
5. Gerar cotacao e registrar em `cotacoes_publicas` (visivel no painel do diretor)
6. Enviar cotacao via WhatsApp

### Alteracoes

**1. Edge Function `agente-consultor-ia/index.ts` — Reformulacao completa**

- **Carregar linhas de produto** em vez de planos: buscar `product_lines` ativas com seus planos associados
- **Adicionar tool calling** para que a IA execute acoes estruturadas:
  - `consultar_placa`: chama `plate-lookup` internamente para obter marca, modelo, ano, FIPE
  - `calcular_cotacao`: com os dados coletados (placa/FIPE, regiao, combustivel, tipo_uso), buscar `tabelas_preco_mensalidade` + `plano_preco_map` para calcular precos reais por plano (reutilizando a logica de `useCalcularCotacao`)
  - `registrar_cotacao`: salvar em `cotacoes_publicas` e gerar link publico
  - `enviar_cotacao_whatsapp`: envia mensagem formatada com os planos e precos via WhatsApp
- **System prompt atualizado**: instruir a IA a perguntar placa primeiro, depois tipo de uso (particular/app), combustivel, regiao; nunca revelar valor por cobertura individual, apenas valor total do plano
- **Fluxo conversacional**:
  1. Saudacao + perguntar placa
  2. Consultar placa → obter dados do veiculo
  3. Perguntar: e app? combustivel? regiao?
  4. Calcular precos de todos os planos disponiveis
  5. Apresentar planos com valores mensais
  6. Se interessado → registrar cotacao + enviar link

**2. Pagina de configuracao `AgenteConsultorIA.tsx` — Aba Planos → Aba Linhas**

- Alterar aba "Planos" para "Linhas de Produto"
- Buscar `product_lines` em vez de `planos` individuais
- Toggle `disponivel_agente` movido para nivel de linha (novo campo na tabela ou config)
- Campo descricao para o agente por linha

**3. Migracao SQL**

- Adicionar campo `disponivel_agente` e `agente_descricao` na tabela `product_lines` (se nao existir)
- Ou criar tabela `agente_ia_linhas_config` com `product_line_id`, `ativo`, `descricao`

### Arquivos editados
- `supabase/functions/agente-consultor-ia/index.ts` — reformulacao com tool calling, consulta de placa, calculo de preco, registro de cotacao
- `src/pages/configuracoes/AgenteConsultorIA.tsx` — aba Linhas em vez de Planos
- Migracao SQL para campos de configuracao do agente nas linhas de produto

### Detalhes tecnicos

O calculo de preco no edge function replica a logica de `useCalcularCotacao.ts`:
- Busca `tabelas_preco_mensalidade` filtrada por `linha_slug`, `regiao`, `tipo_uso`, `combustivel_tipo`, e faixa FIPE
- Aplica `adicional_mensal` do plano e `adicional_app` quando aplicavel
- Calcula adesao como percentual da FIPE (config `taxa_adesao_percentual_fipe`)

A cotacao e salva em `cotacoes_publicas` com `origem = 'agente_ia'` para rastreabilidade no painel do diretor.

