## Diagnóstico

Quando o **Coordenador de Monitoramento** clica em "Aprovar" na tela de Aprovação de Associado, o hook `useAprovarInstalacaoMonitoramento` (em `src/hooks/useAprovacaoMonitoramento.ts`) executa:

1. Ativa o veículo (`status='ativo'`, coberturas)
2. Ativa o associado (`status='ativo'`, `data_ativacao`)
3. Atualiza cotação (`status_contratacao='ativo'`)
4. Atualiza contrato (`status='ativo'`, `data_ativacao`)
5. Sincroniza SGA Hinova
6. Insere histórico
7. Notifica cliente

**Mas NUNCA atualiza o próprio registro de `servicos`** — `status` continua `em_analise`, `analisado_em`/`analisado_por` continuam `NULL`.

Resultado: na aba **Serviços de Campo**, o badge ciano "Em Análise" persiste para sempre, mesmo após a aprovação no monitoramento.

## Correção

### 1. Atualizar o serviço ao aprovar (causa raiz)
Em `src/hooks/useAprovacaoMonitoramento.ts → useAprovarInstalacaoMonitoramento`, adicionar como primeira operação:
```ts
await supabase
  .from('servicos')
  .update({
    status: 'aprovada',
    analisado_em: agora,
    analisado_por: profile?.id,
    observacoes_analise: data.observacoes ?? null,
    updated_at: agora,
  })
  .eq('id', data.servicoId);
```
Isso faz o serviço migrar imediatamente da fase **Aguardando Análise** → **Concluídas** em Serviços de Campo (já mapeado em `FASE_TO_STATUS.concluida = ['concluida', 'aprovada', 'aprovada_ressalvas']`).

### 2. Mesma lógica no fluxo "Aprovar com ressalvas"
Verificar e aplicar análogo em `useAprovarComRessalvasMonitoramento` (se existir): `status='aprovada_ressalvas'`.

### 3. Mesma lógica no "Reprovar"
Em `useReprovarInstalacaoMonitoramento`: setar `status='reprovada'` + `analisado_em`/`analisado_por`/`motivo_reprovacao`.

### 4. Refresh agressivo na lista (sintoma)
Em `src/hooks/useServicos.ts` (linhas 439-441), aplicar o mesmo padrão da correção anterior:
- `refetchInterval: 15000`
- `refetchIntervalInBackground: true`
- `refetchOnWindowFocus: true`
- `staleTime: 0`

Garante que a lista de Serviços de Campo se atualize sozinha quando voltar à aba.

## Arquivos afetados

- `src/hooks/useAprovacaoMonitoramento.ts` (3 mutations: aprovar, aprovar com ressalvas, reprovar)
- `src/hooks/useServicos.ts` (config de refetch)

## Resultado esperado

- Após o coordenador aprovar (ou aprovar com ressalvas / reprovar), o card de Serviços de Campo migra imediatamente para a fase correta.
- O campo "Em Análise" deixa de aparecer assim que houver decisão.
- A lista atualiza em até 15s ou imediatamente ao focar a aba.
