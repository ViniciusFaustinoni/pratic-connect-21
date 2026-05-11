# Análise prévia SGA do novo titular — antes da aprovação do Cadastro

## Contexto

Hoje o sistema só consulta o SGA para o novo titular **depois** que o Cadastro aprova a troca (a chamada roda em background dentro de `aprovar-troca-cadastro`). Ou seja, o Cadastro decide **às cegas**. A aba "Análise prévia" no `ModalDetalhesTroca` já existe mas mostra JSON cru.

Vamos inverter: rodar a consulta **assim que o modal abre** em `aguardando_cadastro` (e em `cotacao_em_andamento`, para já estar pronto), exibir um card formatado com dados pessoais + situação financeira (boletos em aberto), e tratar explicitamente o caso "não está na base SGA".

Bom: a edge function `sga-buscar-associado-completo` **já retorna tudo o que precisamos** numa única chamada — dados do associado, veículos, boletos em aberto por veículo, saldo devedor agregado e flag `encontrado`. Não há nova edge function a criar nem migração de banco.

## O que muda

### 1. Edge function `aprovar-troca-cadastro/index.ts`
- Mantém o snapshot pós-aprovação como fallback/idempotência.
- Sem mudança funcional obrigatória; apenas garantir que se já existir snapshot recente (< 5min) **não** sobrescreve.

### 2. Edge function nova: `analisar-novo-titular-troca`
Endpoint chamado pelo modal ao abrir. Responsabilidades:
- Receber `solicitacao_id`.
- Validar que o usuário tem permissão (Cadastro/Monitoramento/Diretor).
- Carregar `novo_titular_dados.cpf` da solicitação.
- Consultar `associados` local por CPF (encontrado/não encontrado + status básico).
- Invocar `sga-buscar-associado-completo` com `{ cpf }`.
- Gravar resultado em `solicitacoes_troca_titularidade.analise_previa_resultado` + `analise_previa_em` (mesma coluna já usada hoje).
- Cache: se `analise_previa_em` < 10 minutos atrás, retorna o snapshot existente sem nova chamada SGA (evita sobrecarga ao reabrir o modal).
- Retorna `{ base_local, sga, gerado_em, do_cache }`.

### 3. Hook novo: `useAnalisePreviaSGA(solicitacaoId, enabled)`
- React Query, `enabled` = modal aberto E status ∈ {`cotacao_em_andamento`, `aguardando_cadastro`, `aguardando_monitoramento`}.
- `staleTime: 5min`, sem refetch on focus.
- Chama a edge function nova via `supabase.functions.invoke`.

### 4. UI: `ModalDetalhesTroca.tsx` — aba "Análise prévia"
Substituir o `<pre>JSON</pre>` atual por um componente novo `AnalisePreviaNovoTitularCard` com 3 estados:

**Carregando** — Skeleton + texto "Consultando base SGA Hinova…".

**Não encontrado no SGA** (`sga.encontrado === false`):
- Alert neutro: ⚠️ *"CPF não encontrado na base SGA Hinova. O novo titular não é associado existente — o cadastro será criado do zero ao efetivar a troca."*
- Mostra apenas `base_local` (se houver associado local com mesmo CPF, exibir como "Cadastro Lovable existente").

**Encontrado no SGA**:
- Cabeçalho: nome, CPF, código_associado, badge com `descricao_situacao` (verde se ATIVO, âmbar/vermelho caso contrário).
- Seção **Dados pessoais**: email, telefone, endereço (se vierem), data nascimento, data cadastro.
- Seção **Situação financeira**:
  - Card destaque com `saldo_devedor_total` (verde se 0, vermelho se > 0).
  - Lista de boletos em aberto (placa do veículo, vencimento, valor, situação) — agrupados por veículo.
  - Se `tem_debito === true`: alerta âmbar "Associado possui pendências financeiras no SGA — avaliar antes de aprovar".
- Seção **Veículos vinculados**: lista enxuta (placa, modelo, situação).
- Rodapé: "Atualizado em {gerado_em} · [Atualizar agora]" (botão dispara refetch ignorando cache).

Botão **Aprovar** continua como hoje. Não há nova trava — a decisão é humana, baseada na visualização. (Se o usuário no futuro quiser bloquear aprovação quando `tem_debito === true`, fica para outro pedido.)

### 5. Sem alteração em
- Banco de dados (coluna `analise_previa_resultado` já existe).
- Fluxo Autentique (envio do termo ao novo titular continua disparado pelo fluxo público depois da aprovação Cadastro+Monitoramento).
- Fluxo de aprovação Monitoramento.

## Fora de escopo
- Bloquear aprovação automaticamente em caso de débito.
- Mexer no termo de cancelamento do antigo titular.
- Buscar histórico de sinistros do SGA.

## Detalhes técnicos

**Arquivos:**
- `supabase/functions/analisar-novo-titular-troca/index.ts` (novo)
- `src/hooks/useAnalisePreviaSGA.ts` (novo)
- `src/components/troca-titularidade/AnalisePreviaNovoTitularCard.tsx` (novo)
- `src/components/troca-titularidade/ModalDetalhesTroca.tsx` (substituir conteúdo da aba `analise`)

**Resposta da `sga-buscar-associado-completo` já contém:**
`encontrado`, `codigo_associado`, `associado{nome,cpf,email,telefone}`, `veiculos[{placa, marca, modelo, ano, saldo_devedor, boletos_abertos[]}]`, `saldo_devedor_total`, `tem_debito`. Suficiente — não precisamos chamar `sga-listar-boletos-associado`.

**Cache:** snapshot em `analise_previa_resultado` é fonte de verdade; reaberturas em < 10min usam cache. Botão "Atualizar agora" envia `{ force: true }`.

**Tratamento de erro transitório:** quando `sga-buscar-associado-completo` retorna 503 com `erro_transitorio: true`, o card mostra alerta âmbar "SGA indisponível no momento — tente novamente em alguns minutos" e mantém botão de retry.
