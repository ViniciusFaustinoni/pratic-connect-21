## Objetivo

Na entrada do fluxo de **Troca de Titularidade** (botão "Outras Entradas → Troca de Titularidade"), inverter a prioridade da busca por CPF:

1. **Buscar primeiro na base local** (`associados`) — fonte de verdade do nosso sistema.
2. **Usar o `codigo_hinova` do registro local** para consultar o SGA via endpoint `/listar/boleto-associado-veiculo`, listando boletos/faturas e fazendo as verificações financeiras.
3. SGA só é consultado por CPF como **fallback** se o associado não existir na base local (preserva o caminho atual de "importar associado do SGA").

Hoje o fluxo faz o oposto: bate primeiro no SGA por CPF (`sga-buscar-associado-completo`), depois tenta espelhar localmente. Isso causa loops e dependência da disponibilidade do Hinova.

## Onde vive a busca hoje

- **Entry-point:** `src/components/vendas/OutrasEntradasMenu.tsx` (linhas 90–280) usa `useAssociadoSearch(searchTerm)`.
- **Hook de busca:** `src/hooks/useAssociadoSearch.ts` — quando o termo é CPF (11 dígitos) chama SGA primeiro e só cai no local se SGA não achar.
- **Dialog seguinte:** `src/components/associados/TrocaTitularidadeDialog.tsx` — recebe `associadoId` (já local) e usa `useBuscaSGA({ cpf })` para listar veículos + boletos do SGA. Se o local não tem espelho, dispara `importar-associado-sga`.
- **Coluna disponível:** `public.associados.codigo_hinova` (integer) — já populada no espelho.
- **Endpoint SGA já implementado em shared:** `supabase/functions/_shared/hinova-client.ts` → `listarBoletosVeiculoJanela` e `listarBoletosVeiculo` chamam `POST /listar/boleto-associado-veiculo` com `codigo_associado` + `codigo_veiculo` + janela de datas (≤90d).

## Mudanças propostas

### 1. `useAssociadoSearch` — local-first para CPF (mantém fallback SGA)

Inverter a ordem em `src/hooks/useAssociadoSearch.ts`:

- Quando termo é CPF de 11 dígitos:
  1. Consulta `associados` por CPF (com e sem máscara) **primeiro**.
  2. Se achou, retorna o registro local com `codigo_hinova` incluído no payload (`AssociadoSearchResult`).
  3. Se NÃO achou local, então chama `sga-buscar-associado-completo` (caminho atual marcado `origem_sga`).
- Para nome/telefone parcial: comportamento atual (local).

Adicionar `codigo_hinova?: number | null` em `AssociadoSearchResult`.

### 2. Novo hook `useBoletosSgaPorAssociado(codigoHinova)`

Cria `src/hooks/useBoletosSgaPorAssociado.ts` que:

- Recebe `codigo_hinova` (number).
- Chama uma nova edge function `sga-listar-boletos-associado` (ver item 3) que internamente:
  - Lista veículos do associado no SGA (já existe `buscarAssociadoComVeiculosPorCpf` — adaptar para variante por código) e
  - Para cada veículo chama `listarBoletosVeiculo(codigoAssociado, codigoVeiculo, janela)`.
- Devolve mesmo shape do `SgaAssociadoCompleto` que a UI já consome (`veiculos[]`, `saldo_devedor_total`, `tem_debito`, `boletos_abertos`).
- Reaproveita `extractTransientPayload` para tratamento de erro transitório.

### 3. Nova edge function `sga-listar-boletos-associado`

`supabase/functions/sga-listar-boletos-associado/index.ts`

- Input: `{ codigo_associado: number, dias?: number }` (default 1095 = 3 anos, igual ao usado hoje).
- Usa `getHinovaSession`, busca veículos via novo helper `buscarVeiculosPorCodigoAssociado(s, codigo_associado)` no `_shared/hinova-client.ts` (POST `/listar/veiculo-associado` ou similar — verificar existência; senão usar payload já mapeado em `buscarAssociadoComVeiculosPorCpf` extraindo só por código).
- Para cada veículo, chama `listarBoletosVeiculo(s, codigo_associado, codigo_veiculo, dias)` (já implementado).
- Devolve estrutura igual à `sga-buscar-associado-completo` (mantém UI compatível).
- Tratamento idêntico de `HinovaTransientError` → HTTP 503 com `erro_transitorio: true`.

### 4. `TrocaTitularidadeDialog` — usar `codigo_hinova` em vez de CPF

Em `src/components/associados/TrocaTitularidadeDialog.tsx`:

- Substituir `useBuscaSGA({ cpf: cpfAntigo })` por `useBoletosSgaPorAssociado(codigoHinova)`, onde `codigoHinova` vem de:
  ```ts
  const { data: assoc } = useQuery(['troca-tit-associado', associadoId], …
    select id, cpf, codigo_hinova from associados where id = associadoId)
  ```
- Se `codigo_hinova` for null (associado local nunca sincronizado), exibir aviso curto "Associado ainda não sincronizado com SGA" + botão para disparar `sga-hinova-sync` (ou `importar-associado-sga` por CPF) e refetch.
- Remover o auto-import por CPF (loop atual) — agora o caminho é sempre via `codigo_hinova`. A guarda `tentativasImport` deixa de ser necessária.
- Mapeamento de placa SGA → veículo local continua igual (com `normPlaca`).

### 5. `OutrasEntradasMenu` — propagar `codigo_hinova`

No `handleSelectAssociado` (linha 255), quando o associado vier do local com `codigo_hinova`, salvar em estado e passar para o `TrocaTitularidadeDialog` como prop opcional `codigoHinova` (evita um round-trip extra ao Supabase).

### 6. Compatibilidade

- `useVerificarDebitosAssociado` continua usando `useBuscaSGA` por CPF (outros fluxos: substituição/inclusão/migração). Não muda agora — escopo é **só** a Troca de Titularidade. Pode ser migrado depois em um segundo passo se desejado.

## Critérios de aceite

- Digitar CPF de associado existente em "Outras Entradas → Troca de Titularidade":
  - Resultado vem da base local (não há chamada SGA na busca inicial).
  - Ao clicar no associado, o dialog abre e os veículos/boletos vêm via `sga-listar-boletos-associado` usando `codigo_hinova`.
- CPF de associado **inexistente** localmente: mantém o fluxo atual de "importar do SGA" (fallback).
- Associado local sem `codigo_hinova`: dialog mostra aviso e botão "Sincronizar com SGA".
- Sem loop de import (a guarda atual em `TrocaTitularidadeDialog` deixa de ser necessária).
- Erros transitórios do SGA continuam exibindo `SgaTransientAlert` com retry.

## Fora de escopo

- Mudar `useAssociadoSearch` para outros fluxos além da Troca de Titularidade (substituição/inclusão continuam SGA-first).
- Refatorar `useVerificarDebitosAssociado` (pode entrar em um próximo passo).
- Mudanças na aprovação de Cadastro/Monitoramento da troca.
