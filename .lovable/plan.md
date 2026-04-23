

## Padronizar filtros de "rastreadores instalados" para usar `status='instalado'`

### Diagnóstico

A maior parte do código já usa `.eq('status', 'instalado')` corretamente (métricas, lista, `useRastreadoresInstalados`, `useSinistroAnalise`, mapa). Mas existem pontos onde a "presença de rastreador instalado" é inferida pelo vínculo `veiculo_id IS NOT NULL` em vez do `status` — herança da época em que `veiculo_id` era zerado em qualquer mudança. Com a regra atual de **preservação de vínculo** (`mem://logic/operations/rastreador-vinculo-preservacao.md`), `veiculo_id` permanece preenchido em `manutencao`, `retirada_pendente`, `reagendar_manutencao`, etc. — então usar só `veiculo_id` faz veículos em manutenção contarem como "tendo rastreador ativo", o que está errado.

### Pontos a corrigir

**1. `src/hooks/useRastreadores.ts` — `useVeiculosSemRastreador` (linhas ~506–536)**

Hoje:
```ts
.from('rastreadores').select('veiculo_id').eq('status','instalado').not('veiculo_id','is', null)
```
O `.not('veiculo_id','is',null)` é redundante quando `status='instalado'` (instalado sempre tem veículo). **Remover** o `.not(...)` para deixar o `status` como única regra. Comportamento idêntico para "instalado", mas explicita a intenção.

**2. `src/hooks/useAppAssociado.ts` (linha 78)**

```ts
tem_rastreador: Array.isArray(v.rastreadores) && v.rastreadores.length > 0,
```
Hoje conta qualquer rastreador vinculado (inclui `manutencao`, `retirada_pendente`). Mudar para:
```ts
tem_rastreador: Array.isArray(v.rastreadores) && v.rastreadores.some(r => r.status === 'instalado'),
```
Alinhando com a linha 79 (`rastreador_ativo`). Os dois passam a refletir a mesma verdade: "veículo tem rastreador efetivamente instalado". Fica obsoleta a distinção `tem_rastreador` vs `rastreador_ativo`, mas mantemos os dois campos na interface por compatibilidade.

**3. `src/hooks/useChamadoPosicaoTempoReal.ts` (~linha 50)**

Verificar como decide "veículo sem rastreador instalado" — se faz `select rastreadores` sem filtro de status, adicionar `.eq('status','instalado')`. (Vou conferir o trecho exato no momento da edição.)

**4. `src/components/monitoramento/estoque/ListaRastreadores.tsx` (linhas 205–208)**

```ts
.update({ status: novoStatus, veiculo_id: novoStatus !== 'instalado' ? null : undefined })
```
Esse update **sempre zera `veiculo_id` se novoStatus ≠ 'instalado'** — viola diretamente a regra de preservação. Substituir pela whitelist canônica (`STATUS_DESVINCULA_VEICULO`):

```ts
const desvincula = ['estoque','baixado'].includes(novoStatus);
.update({ status: novoStatus, ...(desvincula ? { veiculo_id: null } : {}) })
```

(Isso é fix de bug colateral encontrado durante a varredura — está na mesma linha do que o usuário pediu: parar de usar `veiculo_id` como proxy de status.)

**5. Edge functions de backfill (`softruck-backfill-veiculos`, `rede-veiculos-backfill-veiculos`)**

Já filtram por `.eq('status','instalado')` E `.not('veiculo_id','is', null)`. O `.not(...)` agora é redundante mas **inofensivo** (defesa em profundidade contra registros inconsistentes). **Sem mudança.**

**6. `src/hooks/useVistoriaManutencao.ts` linha 1106–1109**

`useRastreadoresInstalados` usa `.eq('status','instalado').not('veiculo_id','is',null)`. Mesma situação do item 5 — mantém defesa, sem mudança.

### O que NÃO muda

- `useInadimplenciaPorVeiculo`, `useMinhasCoberturasApp` (filtram cobranças por veículo, não rastreador — `veiculo_id` ali é correto).
- `rede-veiculos-sincronizar-status` (filtra `rede_veiculos_veiculo_id`, outro contexto).
- Fluxo de importação (`ImportarRastreadoresDialog`) — já decide `status` baseado em `veiculo_id` na criação, lógica correta.
- Métricas (`useRastreadoresMetricas`) — já corretas.

### Memória

Atualizar `mem://logic/operations/rastreador-vinculo-preservacao.md` com nota de aplicação: "Filtros de UI/queries para 'rastreadores instalados' devem usar `status='instalado'` como verdade primária. `veiculo_id IS NOT NULL` sozinho inclui falsamente rastreadores em `manutencao`/`retirada_pendente`."

### Arquivos editados

- `src/hooks/useRastreadores.ts` — `useVeiculosSemRastreador` (remover `.not(...)` redundante).
- `src/hooks/useAppAssociado.ts` — `tem_rastreador` passa a checar `status === 'instalado'`.
- `src/hooks/useChamadoPosicaoTempoReal.ts` — adicionar `.eq('status','instalado')` se faltar.
- `src/components/monitoramento/estoque/ListaRastreadores.tsx` — usar whitelist `['estoque','baixado']` em vez de `novoStatus !== 'instalado'`.
- `mem://logic/operations/rastreador-vinculo-preservacao.md` — nota sobre filtros.

### Riscos

- Item 2 (`tem_rastreador` no app do associado) muda comportamento perceptível: veículos com rastreador em `manutencao` deixam de mostrar UI de "tem rastreador". Isso **é o comportamento correto** (não pode rastrear o que está em manutenção), mas vale alertar usuários do app durante a janela de manutenção. Não há mudança de UI/copy adicional necessária.
- Item 4 corrige bug latente: hoje, mover rastreador no painel da estoque para `manutencao` zerava `veiculo_id`. Após o fix, vínculo é preservado. Se houver registros já corrompidos por esse bug, eles precisam de backfill manual (não incluso neste plano — abrir tarefa separada se relevante).

