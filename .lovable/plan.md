## Mapa encontrado nas últimas semanas

Período revisado: últimos 21 dias, cruzando `associados`, `veiculos`, `contratos`, `sga_sync_logs` e `sga_sync_queue`.

Resumo:

```text
Associados sincronizados no SGA com veículo vinculado localmente: 20
Veículos corretamente vinculados no SGA:                         16
Veículos com associado no SGA, mas veículo sem código SGA:       4
  - em erro_sincronizacao:                                      3
  - preso como sincronizando/processando:                        1
```

Inconsistências identificadas:

```text
1) DANIEL FERREIRA DA SILVA - QPC3C40
   Associado SGA: 30060
   Veículo SGA local: ausente
   Status: erro_sincronizacao / falha_permanente
   Erro SGA: "Já existe um veículo com a placa QPC3C40 cadastrado no sistema"
   Diagnóstico: veículo existe no SGA, mas o código não foi recuperado/salvo localmente.

2) VENILTON AUGUSTO DA SILVA - HAT3D43
   Associado SGA: 30030
   Veículo SGA local: ausente
   Status: sincronizando / fila processando
   Erro principal: veículo já existe com a placa HAT3D43; houve também retorno HTML/502 da Hinova.
   Diagnóstico: lock/status ficou preso e precisa recuperação idempotente.

3) CLEBER LUIZ DE OLIVEIRA LIMA - LRA9681
   Associado SGA: 30002
   Veículo SGA local: ausente
   Status: erro_sincronizacao / falha_permanente
   Erro SGA: "O ano 2013 não foi encontrado para o codigo fipe 827088-0"
   Diagnóstico: payload enviado com FIPE/ano incompatível para a validação da Hinova; após tentativas virou falha permanente.

4) VITÓRIA ANTÔNIA DO NASCIMENTO RODRIGUES - KXD6881
   Associado SGA: 30000
   Veículo SGA local: ausente
   Status: erro_sincronizacao / falha_permanente
   Erro SGA: "O ano 2014 não foi encontrado para o codigo fipe 011145-7"
   Diagnóstico: payload enviado com FIPE/ano incompatível para a validação da Hinova; após tentativas virou falha permanente.
```

Padrão do problema:

```text
Cotação/Ativação aprovada
        ↓
Associado é criado/encontrado no SGA e salvo com codigo_hinova
        ↓
Cadastro do veículo falha por:
  A) placa já existente no SGA, mas função não recupera código em todos os formatos/endpoints
  B) FIPE/ano rejeitado pela Hinova
  C) erro transitório/HTML 502 da Hinova deixa fila/status preso
        ↓
Sistema preserva associado como sincronizado, mas veículo fica sem codigo_hinova
```

## Plano de correção

### 1) Corrigir a recuperação de veículo já existente por placa

Atualizar `sga-hinova-sync` para usar o cliente compartilhado `buscarVeiculoPorPlaca` também quando o cadastro retorna “placa já existe”. Hoje a função tenta alguns endpoints, mas não reaproveita a lógica mais robusta já existente em `_shared/hinova-client.ts`.

Comportamento esperado:

```text
Se /veiculo/cadastrar retornar "placa já cadastrada/existe":
  1. buscar veículo por placa no SGA
  2. extrair codigo_veiculo em múltiplos formatos de resposta
  3. salvar veiculos.codigo_hinova
  4. marcar veiculos.sincronizado_hinova = true
  5. marcar status_sga conforme destino: pendente_sga ou ativado_sga
  6. concluir fila sga_sync_queue
  7. continuar envio de fotos/documentos
```

Isso deve resolver casos como DANIEL/QPC3C40 e provavelmente VENILTON/HAT3D43 se a placa estiver consultável.

### 2) Corrigir payload de FIPE/ano antes do envio

Reforçar a resolução de FIPE no `sga-hinova-sync`:

- validar se `codigo_fipe` informado realmente possui o `ano_modelo`/`ano_fabricacao` exigido pela Hinova;
- se a Hinova rejeitar “ano não encontrado para o código FIPE”, tentar automaticamente resolver uma FIPE compatível por marca/modelo/ano antes de desistir;
- registrar no log `resolver_fipe_veiculo` a FIPE original, FIPE corrigida e ano usado;
- reenviar o cadastro do veículo uma vez com a FIPE corrigida.

Isso mira diretamente CLEBER/LRA9681 e VITÓRIA/KXD6881.

### 3) Destravar fila e statuses presos

Ajustar `cron-sga-retry` e a função principal para não deixar itens indefinidamente em `processando`/`sincronizando` quando a Hinova retorna HTML/502 ou quando a execução cai no meio.

Regras propostas:

```text
- status_sga='sincronizando' com log antigo sem sucesso → volta para erro_sincronizacao ou pendente de retry
- sga_sync_queue.status='processando' antigo → volta para pendente com próxima tentativa
- falha_permanente por placa duplicada/ano FIPE → pode ser reaberta após a correção de lógica
- erros 5xx/HTML/rate limit → tratados como transitórios, nunca como falha definitiva imediata
```

### 4) Criar uma reconciliação segura para o legado recente

Adicionar uma Edge Function de reconciliação, ou ampliar `sga-mapear-codigos-veiculos`, para processar somente o recorte crítico:

```text
associado.sincronizado_hinova = true
AND associado.codigo_hinova is not null
AND veículo.codigo_hinova is null
AND veículo criado/sincronizado nas últimas semanas
```

Fluxo da reconciliação:

```text
Para cada veículo inconsistente:
  1. consultar veículo por placa no SGA
  2. se encontrado, salvar codigo_hinova e marcar sincronizado
  3. se não encontrado, chamar sga-hinova-sync com retry controlado
  4. se erro for FIPE/ano, resolver FIPE e reenviar
  5. enviar/reenviar fotos aprovadas de documentos e contratos_documentos
  6. registrar auditoria em sga_sync_logs
```

### 5) Rodar correção nos 4 casos encontrados

Após implementar, executar a reconciliação inicialmente para estes IDs:

```text
QPC3C40 - aa9989a2-2fd7-4db3-ab06-e16e27913f8b
HAT3D43 - 0357a7f9-bcaf-434c-a89b-e90528269b63
LRA9681 - a474e4d6-b6fb-4bbd-bbc0-7e58402b1ab2
KXD6881 - 2f162355-b89d-462b-92ce-a76f7e979049
```

Depois rodar para todo o recorte dos últimos 21 dias e confirmar que o contador final fique:

```text
Associado SGA com veículo sem SGA: 0
```

### 6) Garantia preventiva daqui para frente

Adicionar uma checagem de consistência no fim da sincronização:

```text
Se associado.codigo_hinova existe e veículo.codigo_hinova não existe:
  - não tratar como sucesso completo
  - registrar log explícito de inconsistência
  - manter/reabrir fila de correção
```

Também ajustar o retorno da função para diferenciar:

```text
success: true, sync_completo: true       → associado + veículo + fotos processados
success: true, parcial: true             → associado criado, veículo pendente de retry
success: false                           → falha bloqueante antes de salvar associado/veículo
```

## Validação pós-correção

Após a implementação, validar com consultas no banco e logs:

```text
1. Nenhum associado sincronizado no SGA nas últimas semanas com veículo sem codigo_hinova.
2. Os 4 casos listados passam a ter veiculos.codigo_hinova preenchido ou erro final claro e acionável.
3. Fotos/documentos aprovados são enviados após recuperação do código do veículo.
4. Fila sga_sync_queue não mantém itens antigos em processando.
5. Novas ativações não ficam em estado parcial silencioso.
```

## Arquivos que devem ser alterados

```text
supabase/functions/sga-hinova-sync/index.ts
supabase/functions/cron-sga-retry/index.ts
supabase/functions/sga-mapear-codigos-veiculos/index.ts ou nova função dedicada de reconciliação
supabase/functions/_shared/hinova-client.ts, se precisar ampliar parser de respostas da Hinova
```

Nenhuma mudança de estrutura de tabelas parece obrigatória para corrigir estes casos. A correção pode ser feita com lógica de Edge Functions e atualização controlada dos registros já existentes.