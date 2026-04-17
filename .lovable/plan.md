

## Diagnóstico

Em `/monitoramento/rastreadores` existem **duas abas com tabelas independentes** e busca diferente:

| Aba | Componente | Busca aceita |
|---|---|---|
| **Visão Geral** | `RastreadorFiltersV2` + `useRastreadores` | código, IMEI, série, placa, nome/CPF do associado |
| **Estoque** | `ListaRastreadores` (estado próprio) | **só código, IMEI e série** |

O usuário muito provavelmente está na aba **Estoque** (onde fica a tabela completa de itens em estoque). O placeholder lá diz "Buscar por código, IMEI ou série" e a query SQL filtra apenas esses três campos (linha 139 de `ListaRastreadores.tsx`):

```ts
query.or(`codigo.ilike.%${busca}%,imei.ilike.%${busca}%,numero_serie.ilike.%${busca}%`);
```

Não há nenhum filtro por placa nem por associado, e o relacionamento com `veiculos`/`associados` é só para exibir a coluna, não para filtrar.

## Correção proposta

Estender a busca de `ListaRastreadores` para incluir placa e nome/CPF do associado, espelhando a lógica que já existe em `useRastreadores` (sub-queries em `veiculos` e `associados` para coletar `veiculo_id`s e combinar com filtro direto em `codigo/imei/numero_serie`).

### Mudanças

**`src/components/monitoramento/estoque/ListaRastreadores.tsx`**
1. Atualizar o placeholder do input para: *"Buscar por código, IMEI, série, placa ou associado..."*
2. Substituir o trecho da query (linha 138-140) por uma busca composta:
   ```ts
   if (busca) {
     const termo = busca.trim();
     // IDs de veículos cuja placa bate
     const { data: vPlaca } = await supabase
       .from('veiculos').select('id').ilike('placa', `%${termo}%`);
     // IDs de veículos cujo associado bate (nome ou CPF)
     const { data: vAssoc } = await supabase
       .from('veiculos')
       .select('id, associados!inner(nome, cpf)')
       .or(`nome.ilike.%${termo}%,cpf.ilike.%${termo.replace(/\D/g,'')}%`,
           { referencedTable: 'associados' });
     const ids = Array.from(new Set([
       ...(vPlaca?.map(v=>v.id) ?? []),
       ...(vAssoc?.map(v=>v.id) ?? []),
     ]));
     const direto = `codigo.ilike.%${termo}%,imei.ilike.%${termo}%,numero_serie.ilike.%${termo}%`;
     query = ids.length
       ? query.or(`${direto},veiculo_id.in.(${ids.join(',')})`)
       : query.or(direto);
   }
   ```
3. Adicionar debounce simples (300ms) no input para não disparar uma query a cada tecla — novo estado `buscaInput` controla o `<Input>` e `useEffect` empurra para `busca` (a key do React Query).

### Validação

1. Logar como diretor (`admin@teste.com`/`123456789`).
2. Ir em **Monitoramento → Rastreadores → aba Estoque**.
3. Digitar uma placa existente (ex.: `LUQ0573`) → deve listar o rastreador instalado nesse veículo.
4. Digitar parte do nome de um associado conhecido → deve listar rastreadores dos veículos dele.
5. Digitar IMEI/código → continua funcionando como antes.
6. Mesma validação na aba "Visão Geral" (já funcionava) — não pode regredir.

### Arquivos a editar
- `src/components/monitoramento/estoque/ListaRastreadores.tsx` (único)

### Próximo passo (sugerido, fora deste plano)

Você mencionou que "outros filtros também não estão afiados". Se quiser, depois desta correção liste 1–2 telas específicas (ex.: "Vendas → Cotações", "Associados") com o sintoma exato e eu faço uma varredura focada — assim evitamos varrer todas as 50+ telas às cegas.

