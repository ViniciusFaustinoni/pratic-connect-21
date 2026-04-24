Plano para incluir o histórico completo de alterações de hierarquia na área da Diretoria > Logs de Auditoria.

1. Ajustar a consulta dos logs
- Manter a tela atual de Logs de Auditoria como fonte principal.
- Garantir que alterações com `tabela = 'hierarquia_vendas'` apareçam claramente nos filtros e na listagem.
- Caso existam registros históricos em `hierarquia_vendas` sem log correspondente, criar uma consulta complementar para exibi-los como histórico de hierarquia, sem depender apenas de `logs_auditoria`.

2. Criar um bloco/aba específica para “Histórico de Hierarquia”
- Dentro da página de Logs de Auditoria da Diretoria, adicionar uma seção visual dedicada às alterações de hierarquia.
- Mostrar para cada alteração:
  - usuário executor;
  - data/hora;
  - vendedor afetado;
  - campos alterados;
  - valores anteriores e novos para supervisor, gerente, agência e observações.

3. Melhorar o resumo dos campos alterados
- Reaproveitar e ampliar o formatter existente de auditoria para `hierarquia_vendas`.
- Exibir somente campos que realmente mudaram, por exemplo:
  - Supervisor: João → Maria
  - Gerente: — → Carlos
  - Agência: Agência A → Agência B
  - Observações: texto antigo → texto novo
- Manter os dados brutos em JSON no detalhe expandido para auditoria completa.

4. Garantir registros futuros completos
- Revisar a função de banco `fn_upsert_hierarquia_vendedor`, que já registra mudanças em `logs_auditoria`, para garantir que ela salve snapshots completos do antes/depois com usuário executor e data.
- Se necessário, criar uma migração para reforçar esse log de auditoria sem alterar a tabela `profiles` nem armazenar papéis nela.

5. Filtros e exportação
- Adicionar filtro rápido/tabela “hierarquia_vendas” já destacado como “Hierarquia de vendas”.
- Incluir o resumo das alterações de hierarquia no CSV exportado, preservando usuário, data e campos alterados.

Arquivos previstos:
- `src/pages/diretoria/LogsAuditoria.tsx`
- `src/lib/auditoria-formatters.ts`
- Possível migração Supabase para reforçar `fn_upsert_hierarquia_vendedor`, se necessário.

Observação: no banco atual não encontrei registros em `logs_auditoria` nem em `hierarquia_vendas` para demonstrar dados existentes, então a implementação também deve preparar a tela para mostrar corretamente os próximos registros gerados.