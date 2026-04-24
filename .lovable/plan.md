Plano para implementar a rotina de reprocessamento automático SGA

Objetivo
Garantir, de forma recorrente e auditável, que todo associado que entrou no SGA também tenha seu veículo, fotos e documentos vinculados corretamente, respeitando as duas regras de negócio:

1. Se o veículo foi ativado para Roubo/Furto ou Proteção 360, ele deve estar no SGA.
2. Se for apenas instalação/assistência sem Roubo/Furto, a sincronização completa deve acontecer logo após a instalação concluída.

Mapa encontrado agora

- A função principal `sga-hinova-sync` já cadastra associado, veículo e envia fotos/documentos, inclusive buscando documentos de `documentos` e `contratos_documentos`.
- Existem gaps operacionais:
  - veículos com associado já vinculado ao SGA, mas sem `veiculos.codigo_hinova`;
  - itens parados em `sga_sync_queue` como `processando` por erro transitório/HTML/502;
  - itens em `falha_permanente` por placa duplicada sem recuperação completa;
  - ativações feitas por alguns fluxos frontend/client-side podem não garantir reprocessamento se a chamada falhar silenciosamente;
  - quando o veículo já está sincronizado, o guard de idempotência pode pular o reenviar de fotos/documentos, então a reconciliação precisa diferenciar “veículo existe” de “documentos/fotos foram enviados”.

Correções propostas

1. Criar uma Edge Function de reconciliação automática

Nova função: `sga-reprocessar-cotacoes-ativacoes`

Ela fará varredura em janela configurável, por padrão últimas 4 semanas, e processará em lotes pequenos:

- associados com `associados.codigo_hinova` preenchido;
- veículos sem `codigo_hinova` ou com `sincronizado_hinova != true`;
- veículos com `status_sga` em `erro_sincronizacao` ou `sincronizando` antigo;
- veículos com Roubo/Furto/Proteção 360 ativos que não estejam no SGA;
- veículos de instalação concluída, mesmo sem Roubo/Furto, que ainda não estejam sincronizados completamente;
- veículos já cadastrados no SGA, mas sem log recente/sucesso de envio de fotos/documentos.

A função não duplicará associado/veículo: ela chamará `sga-hinova-sync`, que já tem recuperação por CPF e placa, e registrará tudo em logs.

2. Melhorar `sga-hinova-sync` para reenvio completo de fotos/documentos

Adicionar suporte a um parâmetro seguro, por exemplo:

```text
force_resync_media: true
```

Quando esse parâmetro for enviado:

- se o veículo já tiver `codigo_hinova`, a função não deve parar no guard de idempotência;
- deve pular recadastro desnecessário e executar a etapa de fotos/documentos;
- deve registrar `enviar_fotos` e `sync_completo` novamente;
- deve manter `codigo_hinova` e status local intactos, apenas corrigindo vínculo/documentação.

Também vou revisar o tratamento de erro de `errorMessages.some is not a function`, normalizando `error` da Hinova para array/string seguro.

3. Corrigir recuperação de placa duplicada

No caso “placa já cadastrada”, reforçar a busca por placa usando o helper compartilhado `buscarVeiculoPorPlaca` de `_shared/hinova-client.ts`, que já possui endpoint primário e fallback.

Se encontrar o código:

- salvar `veiculos.codigo_hinova`;
- salvar `associados.codigo_hinova` quando vier no retorno;
- continuar para envio de fotos/documentos;
- concluir a fila.

4. Fortalecer `cron-sga-retry`

Ajustar o cron atual para:

- destravar registros `processando` antigos;
- reabrir falhas permanentes recuperáveis, principalmente:
  - placa duplicada;
  - HTML/502/rate limit;
  - auth temporário/janela horária;
- preservar falhas realmente manuais como permanentes;
- chamar `sga-hinova-sync` com o status correto: `ativo` para veículos com `cobertura_total = true`, e `pendente` nos demais.

5. Disparar SGA após instalação concluída

Atualizar o fluxo `concluir-instalacao-prestador` para chamar a sincronização SGA após a instalação:

- se veículo já tiver Roubo/Furto/Proteção 360, enviar como `ativo` quando aplicável;
- se for apenas instalação/assistência sem Roubo/Furto, enviar como `pendente`, porém com veículo/fotos/documentos completos;
- em caso de falha, não bloquear conclusão da instalação, mas enfileirar/reprocessar automaticamente.

Também vou revisar os hooks de aprovação/ativação existentes para garantir que a rotina cubra os fluxos em que a chamada SGA é feita no cliente.

6. Agendar rotina automática

Adicionar configuração em `supabase/config.toml` para a nova função, sem JWT obrigatório, seguindo o padrão atual das funções cron.

Depois da implementação, a rotina pode ser chamada por cron Supabase/pg_cron nos horários seguros da Hinova, por exemplo dentro da janela comercial, e também poderá ser executada manualmente via Edge Function para auditoria.

7. Executar backfill/reprocessamento inicial

Após implementar e publicar as funções, executar uma rodada controlada:

- `dry_run: true` para retornar o mapa dos casos;
- depois `dry_run: false` em batches pequenos;
- priorizar os casos críticos já conhecidos/observados:
  - DANIEL / QPC3C40;
  - VENILTON / HAT3D43;
  - VITÓRIA / KXD6881;
  - demais veículos recentes com `associado.codigo_hinova` mas `veiculo.codigo_hinova` ausente.

Validações finais

- Rodar validação de Deno/TypeScript das Edge Functions alteradas.
- Testar a nova função com `dry_run`.
- Testar lote real pequeno.
- Consultar banco após execução para confirmar:
  - associados no SGA com veículo no SGA;
  - veículos de Roubo/Furto/Proteção 360 com `status_sga` coerente;
  - instalações concluídas sem Roubo/Furto com veículo/documentos sincronizados;
  - filas antigas destravadas ou encerradas corretamente;
  - logs `enviar_fotos`/`sync_completo` gravados.

Arquivos a alterar

- `supabase/functions/sga-hinova-sync/index.ts`
- `supabase/functions/cron-sga-retry/index.ts`
- `supabase/functions/concluir-instalacao-prestador/index.ts`
- `supabase/functions/sga-reprocessar-cotacoes-ativacoes/index.ts` novo
- `supabase/config.toml`

Possível ajuste de banco

A princípio, não é obrigatório criar tabela nova. Usarei `sga_sync_logs` e `sga_sync_queue` já existentes. Só adicionarei migração se, durante a implementação, for necessário persistir um controle formal de execuções de reconciliação; caso contrário, manterei sem mudança estrutural.