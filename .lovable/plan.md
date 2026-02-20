
# Corrigir: Status Não Atualiza e Botões de Aprovação/Rejeição Ausentes para Analista

## Diagnóstico

### Problema 1: Status não avança automaticamente após vistoria concluída

A tabela `vistorias_evento` mostra que o sinistro `d089ab74` tem uma vistoria com `status = 'concluida'`. Porém, o sinistro em si ainda está com `status = 'comunicado'`. 

O que deveria acontecer: quando o regulador conclui a vistoria, o sinistro deveria automaticamente avançar para `aguardando_analise`. Provavelmente esse trigger/lógica falhou ou não existe de forma robusta na edge function de conclusão da vistoria.

### Problema 2: Analista é bloqueado e não vê botões

Em `SinistroAnalise.tsx`, linha 331:
```typescript
const statusPreVistoria = ['comunicado', 'documentacao_pendente', 'aguardando_vistoria', 'pendente_vistoria_regulador'];
const bloqueadoParaAnalista = isAnalistaEventos && !isDiretor && !!sinistro && statusPreVistoria.includes(sinistro?.status);
```

Como o status ainda é `comunicado`, o analista é redirecionado de volta para a lista sem poder fazer nada.

E mesmo que o analista acesse, os botões Aprovar/Recusar só aparecem na condição:
```typescript
const analistaPodeDecidir = isAnalistaEventos && sinistro.status === 'aguardando_analise';
```

Ou seja, **o problema raiz é que o status do sinistro não foi atualizado para `aguardando_analise`** quando a vistoria foi concluída.

### Problema 3: Fluxo de vistoria concluída sem atualização de status

Analisando os dados reais da rede:
- Vistoria `06584384`: `status = 'concluida'`, `concluida_em = '2026-02-20T16:29:01'`
- Sinistro: ainda `status = 'comunicado'`

Isso indica que a edge function ou trigger que deveria atualizar o sinistro ao concluir a vistoria não está funcionando corretamente, **ou** a atualização foi feita mas foi sobrescrita.

## Solução

### Parte 1: Corrigir o status atual do sinistro (correção imediata via migration)

Atualizar o sinistro `d089ab74-a18a-462d-93ec-fad83f305f2a` para `aguardando_analise` via migration SQL, já que a vistoria foi concluída.

Também registrar no histórico essa transição que faltou.

### Parte 2: Corrigir a edge function/lógica que conclui vistórias

Verificar a edge function responsável por marcar a vistoria como concluída e garantir que ela também atualiza o status do sinistro para `aguardando_analise`.

### Parte 3: Adicionar fallback robusto no frontend

Se o sinistro estiver com status `comunicado` mas tiver vistoria concluída, mostrar um alerta visível com botão para avançar o status manualmente — em vez de redirecionar o analista.

### Parte 4: Permitir que analista veja sinistro com vistoria concluída mesmo em status `comunicado`

Remover `comunicado` do `statusPreVistoria` quando a vistoria já foi concluída — ou criar uma verificação adicional antes de redirecionar.

## Arquivos a Alterar

| Arquivo | Alteração |
|---|---|
| Migration SQL | Atualizar status do sinistro `d089ab74` para `aguardando_analise` + registrar histórico |
| `src/pages/eventos/SinistroAnalise.tsx` | Remover bloqueio quando vistoria já está concluída; mostrar botões de aprovação/rejeição nesses casos |
| Edge function `concluir-vistoria` (ou similar) | Garantir que ao concluir vistoria, status do sinistro é avançado para `aguardando_analise` |

## Fluxo Correto Esperado

```text
Vistoria do Regulador Concluída
          ↓
Sinistro atualizado para 'aguardando_analise' (automático)
          ↓
Analista acessa a tela e vê os botões "Aprovar Evento" e "Recusar Evento"
          ↓
Analista toma a decisão → status avança para 'aprovado' ou 'reprovado'
```

## Detalhes Técnicos

### Migration SQL
```sql
-- Corrigir status do sinistro que tem vistoria concluída mas status não avançou
UPDATE sinistros 
SET status = 'aguardando_analise', updated_at = NOW()
WHERE id = 'd089ab74-a18a-462d-93ec-fad83f305f2a'
  AND status = 'comunicado';

-- Registrar a transição no histórico
INSERT INTO sinistro_historico (sinistro_id, status_anterior, status_novo, observacao)
VALUES (
  'd089ab74-a18a-462d-93ec-fad83f305f2a',
  'comunicado',
  'aguardando_analise',
  'Status corrigido automaticamente: vistoria do regulador foi concluída sem atualização do status do sinistro.'
);
```

### Lógica Frontend (SinistroAnalise.tsx)
Modificar a condição de bloqueio para verificar se existe vistoria concluída:

```typescript
// Atual (problemático):
const statusPreVistoria = ['comunicado', 'documentacao_pendente', 'aguardando_vistoria', 'pendente_vistoria_regulador'];
const bloqueadoParaAnalista = isAnalistaEventos && !isDiretor && !!sinistro && statusPreVistoria.includes(sinistro?.status);

// Corrigido:
const temVistoriaConcluida = !!vistoriaEvento; // hook já busca vistoria concluída
const bloqueadoParaAnalista = isAnalistaEventos && !isDiretor && !!sinistro 
  && statusPreVistoria.includes(sinistro?.status)
  && !temVistoriaConcluida; // Não bloquear se vistoria já foi concluída
```

E na lógica de botões de decisão:
```typescript
// Analista pode decidir se status é aguardando_analise OU se vistoria está concluída
const analistaPodeDecidir = isAnalistaEventos && 
  (sinistro.status === 'aguardando_analise' || (temVistoriaConcluida && sinistro.status === 'comunicado'));
```

### Edge Function
Buscar a edge function que conclui a vistoria do regulador e verificar se ela atualiza o `sinistro.status`. Se não estiver fazendo isso, adicionar a atualização:
```typescript
// Após marcar vistoria como concluída:
await supabase
  .from('sinistros')
  .update({ status: 'aguardando_analise', updated_at: new Date().toISOString() })
  .eq('id', sinistro_id)
  .in('status', ['comunicado', 'em_analise', 'aguardando_vistoria']);
```
