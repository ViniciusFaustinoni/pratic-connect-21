

## Diagnóstico Definitivo: Loop Infinito na Sincronização SGA

### O que está acontecendo (logs reais)

Os logs mostram um ciclo que se repete indefinidamente:

```text
1. Busca CPF no Hinova → TODOS os endpoints retornam 404 (endpoints inexistentes na API)
2. Tenta cadastrar associado → 406 "CPF já existe" 
3. Recovery: busca código nos logs históricos → encontra 29403 (log antigo com codigo_conta=2)
4. Tenta cadastrar veículo com codigo_associado=29403 → 406 "associado de código 29403 não está cadastrado"
5. Invalida 29403 → limpa associados.codigo_hinova
6. Fila reprocessa → volta ao passo 1 → encontra 29403 nos mesmos logs → LOOP
```

### Causa raiz

Quando o código 29403 é invalidado (passo 5), ele é removido da tabela `associados`, mas **os logs de sucesso antigos (`sga_sync_logs`) que contêm esse código não são marcados como invalidados**. Na próxima tentativa, a Estratégia 2 (linhas 929-989) encontra o mesmo código 29403 nos logs e o reutiliza, criando um loop infinito.

### Solução: 2 correções

**Correção 1 — Não reutilizar códigos já invalidados**

Na Estratégia 2 de recovery (logs de identidade, linha ~946), antes de aceitar um código dos logs, verificar se ele já foi invalidado anteriormente consultando os logs de `invalidar_codigo_associado`.

```typescript
// Antes do loop de recovery, buscar códigos já invalidados
const { data: logsInvalidados } = await supabase
  .from('sga_sync_logs')
  .select('request_payload')
  .eq('associado_id', associado_id)
  .eq('action', 'invalidar_codigo_associado')
  .order('created_at', { ascending: false })
  .limit(50);

const codigosInvalidados = new Set(
  (logsInvalidados || [])
    .map(l => Number((l.request_payload as any)?.codigo_invalidado))
    .filter(n => Number.isFinite(n) && n > 0)
);

// Dentro do loop, rejeitar códigos invalidados:
if (codigo && !codigosInvalidados.has(codigo)) { ... }
```

Aplicar a mesma verificação na Estratégia 1 (logs do próprio associado, linha ~901) e Estratégia 4 (banco local, linha ~1071).

**Correção 2 — Limpar código no banco local ao invalidar**

Na seção de invalidação (linha ~1357), além de limpar `associados.codigo_hinova`, também limpar qualquer outro registro no banco local que tenha o mesmo `codigo_hinova` para o mesmo CPF, evitando que a Estratégia 4 o recupere.

### Arquivos alterados

- `supabase/functions/sga-hinova-sync/index.ts` — adicionar filtro de códigos invalidados em todas as estratégias de recovery + redeploy

### Resultado esperado

Após invalidar o código 29403, a próxima tentativa NÃO vai recuperá-lo. Como todos os endpoints de busca por CPF retornam 404 (API Hinova não tem esses endpoints), e o cadastro retorna "CPF já existe" sem fornecer o código correto, o sistema vai corretamente retornar o erro `preencher_codigo_hinova_manual`, indicando que o código precisa ser preenchido manualmente no banco. Isso quebra o loop e dá visibilidade ao operador.

