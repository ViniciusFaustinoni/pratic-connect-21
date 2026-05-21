
## Contexto

O usuário quer sincronizar o associado **RAFAEL RODRIGUES DA SILVA – CPF 68446543249 – cód. 30157** puxando dados do SGA Hinova para que apareça em:
- `/associados` (lista de associados — tabela `associados`)
- `/cadastro/base-antiga` (tabela `associados` + `veiculos` filtrados por `origem_cadastro='api_externa'` / `codigo_hinova IS NOT NULL`)

Pede também uma funcionalidade reutilizável, análoga à "Sincronização de Rastreadores" (Softruck/Rede).

## Já existe e será reutilizado

- **Edge function `importar-associado-sga`** (`supabase/functions/importar-associado-sga/index.ts`):
  - Recebe `{ cpf }`, autentica, chama Hinova (`buscarAssociadoComVeiculosPorCpf` + `buscarVeiculoPorPlaca`)
  - Faz UPSERT em `associados` (por CPF) com `origem_cadastro='api_externa'`, `codigo_hinova`, `sincronizado_hinova=true`
  - Faz UPSERT em `veiculos` (por placa) com `codigo_hinova`, vinculados ao associado
  - **Já garante** aparecer em `/associados` e em `/cadastro/base-antiga` automaticamente
- Padrão visual: `StatusSincronizacaoRastreadores.tsx` (Cards/Buttons + mutation com toast)
- Página alvo: `/configuracoes/integracoes/sga-hinova` (`IntegracaoSGAHinova.tsx`)

## Mudanças

### 1. Novo componente `SincronizarAssociadoSGA.tsx`

`src/components/integracoes/SincronizarAssociadoSGA.tsx`

- Card com título "Sincronizar associado do SGA"
- Input CPF (máscara) + botão "Buscar e sincronizar"
- Ao clicar:
  - Chama `supabase.functions.invoke('importar-associado-sga', { body: { cpf } })`
  - Exibe spinner durante; toast de sucesso/erro
  - Em sucesso, mostra resumo: nome, código_associado, lista de veículos importados (placa, marca/modelo) + links rápidos para `/associados?cpf=...` e `/cadastro/base-antiga?search=...`
- Estados tratados: `not_found` (CPF não existe no SGA), `503` (SGA indisponível), `401`

### 2. Encaixar na página de SGA Hinova

`src/pages/configuracoes/IntegracaoSGAHinova.tsx`

- Adicionar nova `TabsTrigger` "Importar do SGA" entre "Health Check" e "Teste Boletos"
- `TabsContent` renderiza `<SincronizarAssociadoSGA />`
- Restrito a `isDiretor || isCoordenadorMonitoramento || isAdminMaster` via `usePermissions`

### 3. Execução imediata para o RAFAEL

Após implementação, executar a sincronização do CPF `68446543249` via essa nova UI (ou direto pela edge function) e confirmar:
- aparece em `/associados`
- aparece em `/cadastro/base-antiga` (aba Associados)
- `codigo_hinova=30157`, `sincronizado_hinova=true`

## Detalhes técnicos

- **Sem migrations** — schema já comporta tudo (`origem_cadastro`, `codigo_hinova`, `sincronizado_hinova`, `sincronizado_hinova_em`).
- **Sem alteração na edge function** — já é idempotente por CPF/placa.
- Permissões: a edge exige apenas usuário autenticado; o gate de UI é só para evitar uso indevido.
- Logs: a edge já loga em console; opcionalmente gravar em `sga_sync_logs` numa iteração futura (fora do escopo).

## Fora de escopo

- Sincronização em lote por código_associado ou range (pode ser próxima iteração)
- Atualização de campos PII em associados pré-existentes (a edge propositalmente preserva nome/email/telefone locais)
- Sincronizar boletos do associado (já existe em outra área)
