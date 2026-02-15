
# Criar Contas a Pagar Automaticamente a Partir de Eventos

## Contexto

Atualmente, as contas a pagar sao criadas apenas manualmente pelo financeiro (via `NovaContaPagarModal`). Tres pontos criticos do fluxo de eventos nao geram registros automaticos em `contas_pagar`:

1. **Cotacao de pecas aprovada** -- o auto center forneceu pecas, precisa receber
2. **Reparo concluido (veiculo liberado)** -- a oficina fez o trabalho, precisa receber
3. **Indenizacao aprovada** -- o associado tem direito ao valor, precisa receber

A tabela `contas_pagar` ja tem os campos `referencia_tipo` e `referencia_id` para vincular a origem.

## Plano de Implementacao

### 1. Cotacao Aprovada -- Conta para o Auto Center

**Arquivo:** `src/hooks/useCotacoesEvento.ts`

No `onSuccess` do `aprovarCotacao` (linha 115), apos gerar a OS via edge function, inserir automaticamente em `contas_pagar`:

- Buscar dados do auto center (nome, documento) da cotacao aprovada
- Inserir conta com:
  - `fornecedor_nome`: nome do auto center
  - `categoria`: `pecas`
  - `valor`: `cotacao.valor_total`
  - `data_vencimento`: 30 dias a partir de hoje (prazo padrao fornecedor)
  - `referencia_tipo`: `cotacao_pecas`
  - `referencia_id`: `cotacaoId`
  - `observacao`: protocolo do sinistro + numero OS
  - `status`: `pendente`

### 2. Reparo Concluido -- Conta para a Oficina

**Arquivo:** `src/components/oficinas/OSConclusaoModal.tsx`

Na funcao `handleLiberarVeiculo` (linha 208), apos o lancamento contabil (linha 236-251), inserir conta a pagar para a oficina:

- Separar valor de pecas (ja coberto na conta do auto center) do valor de mao de obra
- Inserir conta com:
  - `fornecedor_nome`: nome da oficina
  - `fornecedor_documento`: CNPJ da oficina
  - `categoria`: `mao_de_obra`
  - `valor`: valor da mao de obra da OS (itens tipo `servico` e `mao_de_obra`)
  - `data_vencimento`: 15 dias a partir de hoje
  - `referencia_tipo`: `ordem_servico`
  - `referencia_id`: `os.id`
  - `observacao`: numero da OS + protocolo sinistro
  - `status`: `pendente`

### 3. Indenizacao Aprovada -- Conta para o Associado

**Arquivo:** `src/components/sinistros/IniciarIndenizacaoModal.tsx`

Na `mutationFn` (linha 62), apos atualizar sinistro e criar documentos (passo 3, linha 88), inserir conta a pagar:

- Buscar dados do associado (nome, CPF)
- Inserir conta com:
  - `fornecedor_nome`: nome do associado
  - `fornecedor_documento`: CPF do associado
  - `categoria`: `indenizacao`
  - `valor`: `valorFinal` (FIPE - depreciacoes)
  - `data_vencimento`: 60 dias uteis a partir de hoje (prazo regulamento)
  - `referencia_tipo`: `sinistro`
  - `referencia_id`: `sinistroId`
  - `observacao`: protocolo + "Indenizacao integral - Perda total ou roubo nao recuperado"
  - `status`: `pendente`

## Detalhes Tecnicos

- Todas as insercoes usam `supabase.from('contas_pagar').insert(...)` seguindo o padrao ja existente em `NovaContaPagarModal.tsx`
- `referencia_tipo` + `referencia_id` vinculam a conta a origem (cotacao, OS ou sinistro)
- As insercoes sao feitas em `try/catch` separados para nao bloquear o fluxo principal se falharem (o fluxo de evento/OS e mais critico que o registro financeiro)
- Invalidacao de queries `['contas-pagar']` e `['contas-pagar-kpis']` apos cada insercao para atualizar a tela de Contas a Pagar
- Para o calculo de 60 dias uteis da indenizacao, usaremos uma aproximacao de 84 dias corridos (60 uteis x 1.4)
- Nenhuma migracao de banco necessaria -- todos os campos ja existem na tabela `contas_pagar`
- Nenhuma edge function nova necessaria

## Arquivos Modificados

1. `src/hooks/useCotacoesEvento.ts` -- adicionar insercao em `contas_pagar` no `onSuccess` de `aprovarCotacao`
2. `src/components/oficinas/OSConclusaoModal.tsx` -- adicionar insercao em `contas_pagar` no `handleLiberarVeiculo`
3. `src/components/sinistros/IniciarIndenizacaoModal.tsx` -- adicionar insercao em `contas_pagar` na `mutationFn`
