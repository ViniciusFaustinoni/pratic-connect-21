<final-text>Revisei os logs mais recentes da conversa do Vinícius Faustinoni e o problema ficou claro.

Diagnóstico
- Às 15:25:46 o agente chamou `registrar_cotacao` para o telefone `5521992593830`, com a placa `LTB4J74`.
- Mesmo assim, não foi criada nenhuma linha nova em `leads` nem em `cotacoes`.
- Depois disso, o contato ficou preso entre `dados_cliente_coletados` e `aguardando_vencimento_resposta`, então o agente voltou a perguntar o vencimento e entrou no loop.

Causas encontradas
1. `supabase/functions/agente-consultor-ia/index.ts` está usando um schema antigo no momento de gerar a cotação:
   - tenta inserir em `leads` com a coluna `status`, mas essa coluna não existe;
   - tenta inserir em `cotacoes_publicas` com colunas que não existem nesse banco (`dia_vencimento`, `tipo_instalacao`, `valor_adicional`, `valor_adesao`, `email_solicitante`, `dados_cotacao`);
   - o fluxo público atual do app usa `cotacoes` com `token_publico`, não `cotacoes_publicas` com `token`.

2. O estado local `dadosCotacao` não é atualizado após todas as tool calls.
   - após `consultar_placa` e `calcular_cotacao`, o banco é atualizado, mas a variável em memória não;
   - isso facilita perda de `regiao`, `uso_app` e `planos_calculados`, deixando o agente sem contexto suficiente para concluir.

Plano de correção
1. Corrigir `registrar_cotacao` em `supabase/functions/agente-consultor-ia/index.ts`
   - parar de usar `cotacoes_publicas`;
   - criar a cotação na tabela `cotacoes`;
   - gerar `token_publico` e `numero` no padrão já usado pelo app;
   - salvar os campos corretos da cotação: veículo, FIPE, região, uso, `dia_vencimento`, `nome_solicitante`, `telefone1_solicitante`, `email_solicitante`, `valor_adesao`, `valor_adicional`, `tipo_instalacao`;
   - gerar o link com `/cotacao/${token_publico}`.

2. Corrigir criação/atualização do lead
   - usar as colunas reais da tabela `leads`, com `etapa`/`ativo` em vez de `status`;
   - aproveitar para salvar placa, marca, modelo, ano e valor FIPE no lead.

3. Blindar o estado da conversa
   - criar um helper para persistir `dados_cotacao` sempre com merge;
   - atualizar também a variável `dadosCotacao` em memória após cada etapa;
   - aplicar isso em `consultar_placa`, `calcular_cotacao`, `salvar_dados_cliente`, `obter_opcoes_vencimento` e `registrar_cotacao`.

4. Evitar novo loop
   - antes de registrar a cotação, combinar os argumentos da IA com o `dadosCotacao` persistido;
   - se faltar algum dado crítico, retornar erro estruturado sem reiniciar a conversa;
   - ao concluir com sucesso, salvar `etapa: "cotacao_enviada"` no contato.

Validação após a implementação
- reproduzir o fluxo do Vinícius;
- escolher o vencimento;
- verificar criação do lead;
- verificar criação da cotação em `cotacoes`;
- verificar envio do link no WhatsApp;
- confirmar que o estado final fica como `cotacao_enviada`;
- confirmar que o agente não volta a perguntar vencimento.

Detalhe técnico importante
- O estado atual salvo do contato contém `placa`, `marca`, `modelo`, `valor_fipe`, `email`, `nome` e `opcoes_vencimento`, mas está sem `regiao`, `uso_app` e `planos_calculados`, o que confirma perda de contexto além do erro de persistência da cotação.</final-text>