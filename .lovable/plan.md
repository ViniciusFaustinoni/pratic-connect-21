## Objetivo

Eliminar o falso negativo "Nenhum veículo encontrado no SGA" no fluxo de Troca de Titularidade (e em todo o restante do fluxo de cotação que consome o SGA), distinguindo claramente entre **resposta vazia legítima** e **erro transitório do Hinova**, com retry automático e ação manual de "Tentar novamente" para o usuário.

## Parte A — UX imediata no `TrocaTitularidadeDialog`

**Arquivo:** `src/components/associados/TrocaTitularidadeDialog.tsx`

1. Ler `sga.data?.erro_transitorio` e `sga.data?.motivo` da resposta do hook.
2. Substituir o booleano único `semVeiculosSGA` por três estados:
   - `transitorio` — mostra Alert âmbar: "A consulta ao SGA falhou temporariamente (motivo). Tente novamente."  + botão **Tentar novamente** que chama `sga.refetch()` + `refetchLocais()`.
   - `semVeiculos` — mostra o Alert vermelho atual ("Nenhum veículo encontrado no SGA para este CPF").
   - `semEspelhoLocal` — mantém o comportamento atual (auto-import).
3. Bloquear o auto-import do `useEffect` quando `erro_transitorio === true` (evita chamar `importar-associado-sga` com base em resposta inválida).
4. Desabilitar o botão "Criar Solicitação" também quando `transitorio === true`.
5. Adicionar `aria-describedby` aos `DialogContent` (corrige warning recorrente do console).

## Parte B — Robustez sistêmica no consumo do SGA

### B1. Hook central `useBuscaSGA`
**Arquivo:** `src/hooks/useBuscaSGA.ts`

- Detectar `data.erro_transitorio === true` e tratar como retry: usar `retry: 3` com `retryDelay` exponencial (2s, 4s, 8s, max 10s) **apenas quando** a resposta vier com `erro_transitorio`. Para isso, lançar um erro controlado dentro do `queryFn` quando o payload for transitório, em vez de retornar o objeto vazio.
- Manter o objeto vazio (`empty(...)`) somente quando a falha persistir após os retries — anexar `erro_transitorio: true` ao retorno final para a UI poder reagir.
- Reduzir `staleTime` para `10_000` em respostas transitórias (sem cachear erro por 30s).

### B2. Wrappers derivados
**Arquivos:** `src/hooks/useBuscaPlaca.ts`, `src/hooks/useVerificarVeiculoAtivoCpf.ts`, `src/hooks/useVerificarVeiculoSGA.ts`

- Propagar `erro_transitorio` e `motivo` no objeto retornado, além do `data` mapeado, para que qualquer consumidor possa exibir banner de retry.

### B3. Consumidores do fluxo de cotação
**Arquivos:** `src/components/cotacao/EtapaDadosAssociado.tsx`, `src/components/cotacao/DebitosCard.tsx`, `src/components/vendas/OutrasEntradasMenu.tsx`

- Quando o hook devolver `erro_transitorio`, **não** afirmar "sem veículos" / "sem débitos". Mostrar Alert âmbar curto: "SGA temporariamente indisponível. Reconsultando…" + botão manual de retry.
- No `OutrasEntradasMenu` (busca de associado para troca), exibir o mesmo banner inline na lista de resultados quando a busca SGA por placa/CPF retornar transitório.

### B4. Componente reutilizável
Criar `src/components/cotacao/SgaTransientAlert.tsx`:
- Props: `motivo?: string`, `onRetry: () => void`, `loading?: boolean`.
- Encapsula o Alert âmbar com botão **Tentar novamente** para reuso em todos os pontos acima.

### B5. Telemetria mínima
Adicionar `console.warn` estruturado (`[sga-transient]`) nos hooks B1/B2 quando o retry final falhar, para facilitar o diagnóstico no painel de logs do navegador (sem nova tabela).

## Fora de escopo (registrado, mas não nesta entrega)

- Correção do health-check `sga_health_checks` que reporta "Credenciais Hinova não configuradas" (cron usa caminho de credenciais distinto do edge `sga-buscar-associado-completo`). Será tratado em ticket separado de infraestrutura.

## Critérios de aceite

1. Repetir o cenário do relato (CPF `141.948.967-42`) com o Hinova em janela válida → o dialog lista os 3 veículos (Voyage `QOO5C17`, Toro `RKO4F90`, Fiesta `KOU6D37`).
2. Simular erro transitório (forçando `erro_transitorio: true` via DevTools/network throttling do edge) → dialog mostra banner âmbar com botão "Tentar novamente", **nunca** o vermelho de "Nenhum veículo encontrado".
3. Após 3 retries automáticos sem sucesso, banner permanece com retry manual disponível; "Criar Solicitação" continua bloqueado.
4. Mesmo banner aparece em `EtapaDadosAssociado` e `DebitosCard` quando o SGA estiver instável durante a cotação.
5. Nenhuma regressão no caminho feliz (3 carros aparecem em <2s no fluxo normal).

## Observação técnica

Apenas frontend + 1 hook compartilhado. Sem migração de banco, sem alteração no edge `sga-buscar-associado-completo` (o contrato `erro_transitorio` já existe e está correto). Mudança 100% reversível.