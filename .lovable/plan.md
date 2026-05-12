## Causa raiz

No fluxo "Vistoria na Base", o cliente é registrado em `agendamentos_base` (que já é a tarefa "Vistoria Base" da fila do Monitoramento). Porém, ao aprovar o cadastro, a edge function `criar-instalacao-pos-pagamento` está criando paralelamente uma linha em `instalacoes` com `local_vistoria='base'`. Essa instalação dispara o trigger `sync_instalacao_to_servicos`, gerando um `servicos` `tipo='instalacao'`. O hook `useServicosParaAtribuir` mescla `servicos` + `agendamentos_base` na fila de Atribuição Manual — daí o card duplicado (1 "Instalação" de rota + 1 "Vistoria Base").

O guard anti-duplicação em `criar-instalacao-pos-pagamento` (linhas 223-248) só dispara quando já existe linha em `vistorias` com `local_vistoria='base'`. Mas no fluxo Base essa vistoria só é materializada *depois* que o técnico assume o agendamento_base (trigger `sync_agendamento_base_to_vistoria`). Como aprovar-proposta roda antes disso, o guard falha e a `instalacoes` fantasma é criada.

Confirmado em produção: 3 cotações com a duplicata exata (RJH6G17, LLV7A09, SIO3C68).

## Correção (raiz)

### 1. Edge function `criar-instalacao-pos-pagamento` (única alteração de código)

No branch `tipoVistoria === 'agendada_base'`, expandir o guard anti-duplicação para verificar **também `agendamentos_base` ATIVO**:

```text
Se existir agendamento_base com status IN ('agendado','confirmado','pendente') 
para a cotação → retornar { skipped: 'agendamento_base_exists' } SEM criar instalação.
```

A `instalacoes` será materializada naturalmente quando o técnico assumir a vistoria base (já existe trigger `sync_agendamento_base_to_vistoria` que vincula tudo via `agendamentos_base.instalacao_id` → `vistoria_id`). Nada mais precisa mudar no caminho feliz.

### 2. Migração de backfill (limpa as duplicatas já criadas)

```sql
-- Cancela instalações fantasma que ainda estão na fila com agendamento_base ativo paralelo
UPDATE instalacoes i
   SET status = 'cancelada',
       observacoes = COALESCE(observacoes,'') || ' [Auto-cancelada: duplicata de Vistoria Base]',
       updated_at = now()
 WHERE i.local_vistoria = 'base'
   AND i.status IN ('agendada','em_analise')
   AND EXISTS (
     SELECT 1 FROM agendamentos_base ab
      WHERE ab.cotacao_id = i.cotacao_id
        AND ab.status IN ('agendado','confirmado','pendente')
        AND ab.atendido_por IS NULL
   );

-- Remove os servicos órfãos correspondentes (não atribuídos)
DELETE FROM servicos s
 WHERE s.tipo = 'instalacao'
   AND s.profissional_id IS NULL
   AND s.status IN ('pendente','agendada')
   AND EXISTS (
     SELECT 1 FROM instalacoes i
      WHERE i.id = s.instalacao_origem_id
        AND i.status = 'cancelada'
        AND i.observacoes LIKE '%Auto-cancelada: duplicata de Vistoria Base%'
   );
```

### 3. (Opcional, defesa em profundidade — recomendo aplicar)

Atualizar o trigger `sync_instalacao_to_servicos` para *não* criar `servicos` tipo `instalacao` quando a `instalacoes.local_vistoria='base'` E houver `agendamentos_base` ativo na mesma cotação. Garante que mesmo regressões futuras não voltem a duplicar a fila.

## Validação pós-deploy

1. Após o backfill, abrir Monitoramento › Atribuição Manual: os 3 casos atuais (RJH6G17, LLV7A09, SIO3C68) devem mostrar **apenas** o card "Vistoria Base".
2. Subir nova cotação Base de teste → aprovar cadastro → confirmar que apenas 1 card "Vistoria Base" aparece (sem "Instalação" paralela).
3. Concluir a vistoria base no técnico → confirmar que a instalação é materializada normalmente e o fluxo segue até cobertura ativa.

## Arquivos afetados

- `supabase/functions/criar-instalacao-pos-pagamento/index.ts` — expansão do guard agendada_base.
- Nova migração SQL — backfill + (opcional) hardening do trigger `sync_instalacao_to_servicos`.

Nenhuma alteração de UI necessária — o hook `useServicosParaAtribuir` continua mesclando as duas fontes; a duplicata desaparece porque a fonte espúria deixa de ser populada.