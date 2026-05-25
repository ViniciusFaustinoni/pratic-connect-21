## Por que não aparece nada hoje

O modal de Troca de Titularidade usa os mesmos hooks de busca dos outros fluxos:

- `useAssociadoSearch` consulta direto a tabela `associados`.
- `useBuscaPlaca` consulta SGA, mas é complementada por dados locais em vários pontos.

As RLS atuais da tabela `associados` (e `veiculos`) só liberam, para vendedor **não-gestor** (CLT, externo, agência), os registros retornados por `get_vendedor_associado_ids(auth.uid())` — ou seja, **apenas os associados/veículos vinculados a ele mesmo**.

Na Troca de Titularidade, o vendedor está procurando o **antigo dono do veículo**, que via de regra **não é cliente dele** (foi vendido por outro vendedor/canal). Resultado:

- Busca por **nome** → SQL direto na tabela `associados` → RLS filtra tudo → "Nenhum associado encontrado".
- Busca por **CPF de 11 dígitos** → tenta local (vazio por RLS) → cai no fallback SGA, mas só se o CPF for exato.
- Busca por **placa** → vai no SGA, mas se o associado retornado não estiver no escopo do vendedor, qualquer enriquecimento local também fica vazio.

Isso é uma trava de privacidade boa para o resto do sistema (vendedor não pode varrer base alheia), mas **bloqueia o caso legítimo da Troca de Titularidade**, onde ele precisa achar o vendedor anterior para transferir.

## O que mudar

Criar um caminho de busca dedicado para a Troca de Titularidade, executado server-side com `service_role`, devolvendo só o mínimo necessário e auditando o acesso.

### 1. Edge function `buscar-associado-troca-titularidade`

- Body: `{ termo: string }` (nome, CPF parcial/completo, ou placa).
- Autenticação obrigatória via JWT do usuário.
- Aceita perfis: `funcionario_interno` (já enxergam tudo, mas mantém para uniformidade), `vendedor` (CLT, externo, agência) e Diretoria.
- Estratégia:
  - Detecta se o termo é CPF (11 dígitos), placa (regex Mercosul/antiga) ou texto.
  - Texto → busca em `associados` por `nome ilike` (limit 15), sem filtro de vendedor.
  - CPF → busca local; se vazio, chama `sga-buscar-associado-completo`.
  - Placa → chama `sga-buscar-associado-por-placa` (já existe) + fallback local.
- Retorna apenas: `id`, `nome`, `cpf` (mascarado: `***.***.***-XX`), `telefone` (últimos 4), `codigo_hinova`, `status`, e a lista de veículos com `placa`, `marca`, `modelo`.
- Insere `logs_auditoria` (`acao='consultar'`, descrição `[BUSCA_TROCA_TITULARIDADE] termo=...`).

### 2. Novo hook `useBuscaAssociadoTrocaTitularidade(termo)`

- Wrapper React Query que chama a edge function só quando `selectedTipo === 'troca_titularidade'` e termo ≥ 2 chars.
- Mesma interface dos resultados existentes (`AssociadoSearchResult` + `placaResults`) para reaproveitar a UI atual.

### 3. Ajuste em `OutrasEntradasMenu.tsx`

- Quando `selectedTipo === 'troca_titularidade'`:
  - **Não** chamar `useAssociadoSearch` nem `useBuscaPlaca` direto; usar o novo hook.
  - Mesclar associados + placas no mesmo painel já existente.
  - Manter o alerta amarelo, mas atualizar o texto para refletir que agora a busca aceita nome, CPF ou placa.
- Demais fluxos (Inclusão, Substituição, Migração) continuam exatamente como hoje — não afeta o escopo de privacidade deles.

### 4. Sem mudanças em RLS

Não vamos afrouxar as policies de `associados`/`veiculos`. Toda a exceção fica concentrada na edge function, com escopo "Troca de Titularidade" e auditoria.

## Arquivos a criar/editar

- `supabase/functions/buscar-associado-troca-titularidade/index.ts` (novo)
- `src/hooks/useBuscaAssociadoTrocaTitularidade.ts` (novo)
- `src/components/vendas/OutrasEntradasMenu.tsx` (editar bloco de troca de titularidade)

## Fora de escopo

- Não alterar RLS global.
- Não alterar fluxos de Inclusão, Substituição, Migração, Indicador.
- Não mudar a lógica do `efetivar-troca-titularidade` nem o bloqueio anti-sequestro.
