## Levantamento: funil de cadastros do link público (últimos 30 dias)

### Escopo
- Universo: `cotacoes` criadas nos últimos 30 dias que entraram no link público (i.e. `status_contratacao IS NOT NULL` — significa que o associado clicou e iniciou alguma etapa).
- Sem alterações no sistema. Apenas leitura + geração de planilha.

### Classificação de etapa (onde cada cadastro parou)
Reaproveitar a fonte única canônica do projeto:
- `getEtapaVenda(cotacao)` → `etapaVendaParaPendente` (de `src/lib/etapaPendentePublica.ts`)
- Complementada pelo estado real do contrato/associado para distinguir "chegou no Cadastro", "chegou no Monitoramento", "finalizado (SGA)".

Buckets finais (mutuamente exclusivos):
1. **Link público — escolhendo plano** (`aguardando_escolha_plano`)
2. **Link público — enviando documentos**
3. **Link público — assinando contrato**
4. **Link público — pagando adesão**
5. **Link público — escolhendo vistoria**
6. **Link público — fazendo autovistoria** (relevante p/ sub-FIPE)
7. **Link público — agendando instalação**
8. **Aguardando execução do agendamento** (bola com a operação)
9. **Cadastro — aguardando aprovação** (`status_contratacao='aguardando_aprovacao_cadastro'`)
10. **Monitoramento — aguardando aprovação** (`aguardando_aprovacao_monitoramento`)
11. **Finalizado (SGA)** — `contratos.cadastro_aprovado=true` + `aprovado_em IS NOT NULL` + `associados.status='ativo'` + `veiculos.status='ativo'` (caminho canônico do `ativar-associado`)
12. **Terminal sem sucesso** — cancelado/recusado

### Classificação sub-FIPE
Regra canônica do projeto:
- **Carro**: `valor_fipe < 30.000`
- **Moto**: `valor_fipe < 9.000`
- Tipo do veículo derivado de `marcas_modelos.tipo_veiculo` (com override por nome quando catálogo divergir — Honda/BMW podem aparecer como 'carro' indevidamente). Para o levantamento, basta `marcas_modelos` + heurística de keyword (CG, Biz, NMAX, etc.) como fallback.
- Diesel é tratado à parte (rastreador sempre obrigatório, nunca é sub-FIPE).

### Entregáveis (planilha XLSX em `/mnt/documents/`)
`/mnt/documents/funil-cadastros-link-publico-30d.xlsx` com 4 abas:

1. **Resumo**
   - Total iniciados
   - Quantos finalizaram (SGA)
   - Quantos pararam antes
   - % conversão geral
   - % conversão sub-FIPE vs não-sub-FIPE
   - % conversão por tipo (carro/moto/diesel)

2. **Funil por etapa**
   - Cada etapa × contagem × % do total × % do "parados antes"

3. **Funil cruzado sub-FIPE × etapa**
   - Matriz: linhas = etapa, colunas = [sub-FIPE carro, sub-FIPE moto, acima FIPE carro, acima FIPE moto, diesel]
   - Permite ver se a sangria está concentrada em sub-FIPE (hipótese do usuário: autovistoria completa 31/15 + vídeo trava o associado)

4. **Detalhe**
   - 1 linha por cotação: número, data criação, telefone, placa, marca/modelo, valor FIPE, tipo veículo, sub-FIPE (sim/não), etapa em que parou, dias parada, vendedor, link público

### Como o levantamento é feito
1. Query única em `cotacoes` + joins (`contrato`, `planos`, `instalacoes`, `vistorias`, `marcas_modelos`, `associados`, `veiculos`) — `created_at >= now() - interval '30 days'` e `status_contratacao IS NOT NULL`.
2. Script Node/TS local em `/tmp` aplica `getEtapaVenda` + `etapaVendaParaPendente` (reaproveita a lib do projeto via cópia ad-hoc) e classifica sub-FIPE.
3. Gera o XLSX via `xlsx` (já presente em `node_modules`).
4. Anexa o arquivo com `presentation-artifact`.

### Observação importante
Não vou alterar nada no banco nem em código. O resultado é só a planilha — o usuário usa para decidir onde atuar depois.

### Dúvida antes de executar
Você quer que eu inclua **cotações de troca de titularidade e substituição** no levantamento, ou só **novas adesões puras** (excluindo `origem_troca_titularidade=true` e `tipo_entrada='substituicao_placa'`)? A hipótese de sangria sub-FIPE é mais limpa olhando só novas adesões — sugiro essa, mas confirma.
