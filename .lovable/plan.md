
# Tela de Emissao de Cobrancas em Lote

## Resumo

Criar uma nova pagina dedicada "Emissao de Cobrancas" (`/financeiro/emissao`) que serve como painel de controle pos-fechamento para emitir boletos/PIX no ASAAS em lote, com progresso em tempo real, tratamento de erros, reemissao individual e exportacao.

## Arquitetura

A edge function `gerar-faturas-mensais` ja cria boletos no ASAAS. O problema e que ela processa TUDO de uma vez sem feedback granular. A nova tela precisara de uma abordagem diferente: processar fatura por fatura no frontend, chamando uma edge function para cada uma, permitindo atualizar a UI em tempo real.

## Arquivos a criar/modificar

### 1. `src/pages/financeiro/EmissaoCobrancas.tsx` (novo)

Pagina completa com as seguintes secoes:

**Painel de Status do Fechamento (topo)**
- Busca o fechamento mais recente com status `aprovado` ou `processado`
- Exibe: mes de referencia, total de faturas, quantas ja emitidas (tem `asaas_id` real), quantas pendentes, quantas com erro
- Status geral: "Aguardando emissao" / "Em processamento" / "Concluido"

**Lista de Faturas (tabela principal)**
- Busca de `asaas_cobrancas` filtradas pelo `fechamento_id`
- Colunas: Nome do associado, Placa, Cotas (do `composicao_resumo`), Valor rateio, Taxa admin, Adicionais, Total, Status do boleto (Pendente/Emitido/Erro), Acoes
- Status do boleto: "Pendente" se `asaas_id` comeca com `LOCAL-`, "Emitido" se tem `asaas_id` real e `boleto_url`, "Erro" se marcado
- Filtro por nome/placa e por status (pendente/emitido/erro)

**Emissao em Lote**
- Botao "Emitir Todos os Boletos" que:
  1. Filtra apenas faturas com `asaas_id` comecando por `LOCAL-` (pendentes)
  2. Para cada uma, chama uma nova edge function `emitir-boleto-individual` que:
     - Busca o cliente ASAAS do associado
     - Cria o payment no ASAAS (billingType UNDEFINED = boleto + PIX)
     - Busca o QR Code PIX
     - Atualiza a linha em `asaas_cobrancas` com o `asaas_id` real, `boleto_url`, `pix_copia_cola`, `pix_qrcode`
  3. Atualiza a UI apos cada emissao (progresso X de Y)
  4. Marca erros em vermelho com mensagem

**Barra de Progresso**
- Visivel durante o processamento
- Mostra "Emitindo boleto X de Y..." com Progress component
- Ao finalizar: "Emissao concluida! X emitidos, Y erros"

**Tratamento de Erros**
- Faturas com erro ficam com badge vermelho e mensagem do erro
- Botao "Reemitir" individual em cada linha com erro
- Botao "Reemitir todos com erro" no topo

**Emissao Individual/Avulsa**
- Botao "Nova Cobranca Avulsa" que abre modal (reutilizar `NovaCobrancaModal` existente)

**Exportacao**
- Botao "Exportar Relatorio" que gera CSV com: nome, placa, valor, vencimento, status, link do boleto

### 2. `supabase/functions/emitir-boleto-individual/index.ts` (novo)

Edge function que processa UMA cobranca por vez:

```text
Input: { cobranca_id: string }

Processo:
1. Busca a cobranca em asaas_cobrancas (com associado e asaas_clientes)
2. Verifica se ja tem asaas_id real (nao LOCAL-) -> retorna ja_emitido
3. Busca o asaas_id do cliente
4. Se cliente nao existe no ASAAS, sincroniza via asaas-clientes
5. Cria payment no ASAAS (billingType UNDEFINED)
6. Busca QR Code PIX
7. Atualiza asaas_cobrancas com dados reais
8. Retorna sucesso com dados do boleto

Output: { success, asaas_id, boleto_url, pix_copia_cola }
```

Configuracao no `supabase/config.toml`: verify_jwt = false

### 3. `src/App.tsx` (editar)

Adicionar rota: `/financeiro/emissao` -> `EmissaoCobrancas`

### 4. `src/components/layout/AppSidebar.tsx` (editar)

Adicionar item no menu Financeiro: "Emissao de Cobrancas" com icone `Send`, entre "Faturamento" e "Extrato"

## Fluxo de emissao em lote

```text
1. Pagina carrega -> busca fechamento aprovado/processado mais recente
2. Lista todas as cobrancas do fechamento
3. Operador clica "Emitir Todos os Boletos"
4. Sistema filtra cobrancas pendentes (asaas_id = LOCAL-*)
5. Loop sequencial (com delay de 500ms entre cada):
   - Chama emitir-boleto-individual para cada cobranca
   - Atualiza estado local: pendente -> emitido ou erro
   - Atualiza barra de progresso
6. Ao finalizar, invalida queries e mostra resumo
7. Se houver erros, botao "Reemitir com Erro" disponivel
```

## Prevencao de duplicidade

A edge function `emitir-boleto-individual` verifica se o `asaas_id` ja e real (nao comeca com `LOCAL-`). Se ja foi emitido, retorna `ja_emitido: true` sem criar novo boleto. Isso previne duplicatas mesmo se o operador clicar duas vezes.

## Controle de acesso

Mesma restricao do modulo financeiro existente -- perfis Financeiro e Diretoria ja tem acesso as rotas `/financeiro/*`.
