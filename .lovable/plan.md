

## Erro genérico "Erro ao criar cotação" — expor causa real e blindar pontos frágeis

### Diagnóstico

O toast "Erro ao criar cotação" aparece de forma recorrente sem indicar a causa porque o `catch` em `CotacaoFormDialog.tsx` (linhas 1471-1473) faz apenas `toast.error('Erro ao criar cotação')` + `console.error(error)`. O erro real do Supabase (mensagem, code, hint, details) só fica no console — usuário e suporte ficam às cegas, e o problema se repete.

Dos pontos onde o INSERT pode falhar silenciosamente:

1. **RLS de INSERT em `cotacoes`** exige `is_vendedor(auth.uid()) OR is_gerencia(auth.uid())`. Usuários com outros papéis (coordenador, atendente, agência sem vendas) recebem `403`/`new row violates row-level security` e o front mostra só o toast genérico.
2. **Campos NOT NULL** (`valor_cota`, `valor_total_mensal`, `valor_adesao`, `valor_fipe`) vêm direto de `pendingFormData`. Se o cálculo do plano ainda não populou (ex.: usuário clica "Criar Cotação" antes do `useEffect` de cálculo terminar em mobile lento), o INSERT cai com `null value in column ... violates not-null constraint`.
3. **Número da cotação gerado no client** (`gerarNumeroCotacao()` baseado em timestamp/random) pode colidir se houver índice único; o erro `23505` (duplicate key) também cai no toast genérico hoje.

A correção é (a) deixar o erro real visível e logado; (b) blindar os 3 pontos frágeis com pré-validação clara antes do submit; (c) traduzir os códigos de erro mais comuns (RLS, not-null, unique) em mensagens de ação para o usuário.

### O que vai mudar

**1. Expor o erro real do Supabase no toast** (`src/components/cotacoes/CotacaoFormDialog.tsx`, linhas 1471-1476)

Substituir o catch genérico por um helper `descreverErroCotacao(error)` que:
- Para `error.code === '42501'` ou mensagem com `row-level security` → `"Seu usuário não tem permissão para criar cotações. Peça ao administrador para liberar o papel de Vendedor."`
- Para `error.code === '23502'` (not-null) → `"Faltam dados do plano selecionado. Recarregue a página, escolha o plano novamente e tente outra vez. (campo: {column})"`
- Para `error.code === '23505'` (unique) → `"Conflito ao gerar número da cotação. Tente novamente em alguns segundos."` (e dispara um retry automático único, regenerando o número).
- Para timeout / network → `"Sem resposta do servidor. Verifique sua conexão e tente novamente."`
- Fallback: `"Erro ao criar cotação: {error.message}"` (mostra a mensagem real, nunca mais um toast cego).

Sempre logar `console.error('[criarCotacao]', { code, message, details, hint, payloadKeys })` com as chaves do payload (sem valores sensíveis) para diagnóstico futuro.

**2. Pré-validar campos NOT NULL antes do INSERT** (mesmo arquivo, antes da chamada `createCotacao.mutateAsync`, linha ~1371)

Bloquear envio com toast específico se algum dos seguintes estiver faltando/zero:
- `valor_fipe`, `valor_cota`, `valor_total_mensal` → `"Aguarde o cálculo do plano terminar antes de criar a cotação."`
- `vendedor_id` → mensagem já existente (manter).

Isso impede o INSERT que sempre falha e deixa claro ao consultor o que ainda está pendente.

**3. Retry automático no conflito de número** (`src/hooks/useCotacoes.ts`, função `useCreateCotacao`)

Envolver o INSERT em uma função que, se o erro for `23505` na coluna `numero`, regenera `gerarNumeroCotacao()` e tenta UMA vez mais antes de propagar o erro. Sem loop infinito.

**4. Sinalizar usuário sem permissão antes de abrir o modal**

Em `CotacaoFormDialog`, no `useEffect` de inicialização, conferir se `canCreateCotacoes` (já calculado por `usePermissions`/`useUserRole` em outros lugares — verificar se existe; se não, criar um `useCanCreateCotacao` hook que faz `select 1 from public... where is_vendedor or is_gerencia`). Se o usuário não puder, mostrar banner amarelo no topo do dialog: *"Seu papel atual não permite criar cotações. Contate o administrador."* e desabilitar o botão de submit. Isso evita o erro acontecer.

### O que NÃO muda

- Esquema de `cotacoes`, RLS, enums — já estão corretos.
- Lógica de cálculo de plano, FIPE menor, FIPE limite, vendedor externo, cenários.
- Geração de `token_publico`.
- Tabela `cotacoes` continua com NOT NULL nos mesmos campos.

### Arquivos editados

- `src/components/cotacoes/CotacaoFormDialog.tsx`:
  - Adicionar helper `descreverErroCotacao(err)` no topo (ou importar de `lib/errors.ts`).
  - Linhas 1369-1376: pré-validar `valor_fipe > 0`, `valor_cota > 0`, `valor_total_mensal > 0` antes do `createCotacao.mutateAsync`, com toast específico.
  - Linhas 1471-1476: substituir toast genérico pelo helper, mostrando mensagem real e logando contexto estruturado.
  - Render: banner amarelo no topo do dialog quando o usuário não tem papel de vendedor/gerência.

- `src/hooks/useCotacoes.ts`:
  - `useCreateCotacao`: envolver INSERT em loop de até 2 tentativas se o erro for `23505` (regenerar `numero`).

- `src/lib/errors.ts` (novo, pequeno): função `descreverErroSupabase(err, contexto)` reutilizável (pode ser usada em outros mutations futuros).

### Riscos

- O usuário passa a ver mensagens técnicas ocasionais (ex.: nome de coluna), mas preferível ao toast cego que esconde a causa.
- Banner de "sem permissão" pode aparecer indevidamente se o hook de papel ainda não carregou — mitigado mostrando o banner só após `isLoading=false` da query de papéis.

