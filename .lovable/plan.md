

# Diagnóstico: SGA Hinova não sincroniza mais

## Problemas encontrados

### Problema 1 — IDs NULL no background (causa raiz principal)
Todos os logs recentes em `sga_sync_logs` têm `veiculo_id = NULL` e `associado_id = NULL`. Isso significa que dentro da closure `doBackgroundSync()` (linha 516), as variáveis `veiculo_id` e `associado_id` do escopo externo estão sendo perdidas quando o `EdgeRuntime.waitUntil()` executa o código em background.

**Impacto**: Com IDs NULL, todas as operações de tracking falham silenciosamente:
- `upsertSyncQueue()` grava na fila com veiculo_id/associado_id NULL → não encontra na próxima execução
- `markQueueCompleted()` não encontra o registro para marcar como concluído
- `logSync()` grava logs sem referência, impossibilitando diagnóstico
- As queries `.eq('veiculo_id', veiculo_id)` dentro do background não encontram os registros corretos

### Problema 2 — Loop CPF duplicado sem recovery
Os logs mostram um ciclo repetitivo para o associado "MARCUS VINICIUS" (CPF 124...737):
1. Busca por CPF → 406 "Associado não encontrado ou indisponível"
2. Cadastrar → "CPF já existe" 
3. Recovery encontra código 29361 dos logs antigos
4. Cadastrar veículo com código 29361 → "Associado de código 29361 não está cadastrado"
5. Invalida código → volta ao passo 1

O código 29361 foi criado em 10/Mar com `codigo_conta=2` mas o Hinova não o reconhece mais. A busca por CPF retorna 406, então não há como recuperar o código real. O guard de loop detectou isso e marcou como `falha_permanente`, mas com IDs NULL a marcação não funciona.

## Correção

### 1. Capturar IDs explicitamente no início da closure background
Na função `doBackgroundSync`, criar cópias locais das variáveis antes de qualquer uso:

```typescript
const doBackgroundSync = async () => {
  const _vid = veiculo_id;   // captura explícita
  const _aid = associado_id; // captura explícita
  try {
    // ... todo o código interno usa _vid e _aid
```

E substituir TODAS as ~50+ referências a `veiculo_id` e `associado_id` dentro da closure por `_vid` e `_aid`.

### 2. Melhorar o guard de loop para marcar falha corretamente
Como o guard de loop na linha 522-563 usa os mesmos IDs que estão NULL, ele também não funciona. Com a correção dos IDs, o guard passará a funcionar e impedirá ciclos infinitos.

### 3. Adicionar fallback no cadastro quando CPF existe mas busca retorna 406
Quando o cadastro retorna "CPF já existe" mas NENHUMA das estratégias de recovery encontra um código válido (todas retornam 406), ao invés de ficar em loop, marcar como `falha_permanente` com mensagem clara para intervenção manual.

## Arquivos alterados
- `supabase/functions/sga-hinova-sync/index.ts` — captura explícita de IDs + melhoria no tratamento de CPF duplicado sem recovery

## Estimativa
Alteração concentrada em um único arquivo, sem mudança de schema.

