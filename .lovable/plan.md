
# Preenchimento de Valor de Pecas e Solicitacao de Orcamentos pelo Analista de Eventos

## Resumo

Na tela de analise do sinistro (`SinistroAnalise.tsx`), a tabela de "Itens do Orcamento" atualmente mostra apenas descricao, tipo e quantidade. O plano adiciona:

1. **Campo de valor editavel** nas pecas (somente pecas) com botao de salvar
2. **Botao "Solicitar Orcamento"** que abre um modal com Auto Centers/Ferro Velhos/Montadoras compativeis
3. **Fluxo de cotacao via WhatsApp com IA** (reutilizando a infra existente)
4. **Card "Orcamentos Recebidos"** mostrando valores por estabelecimento (ja existe como `CotacoesRecebidasTab`)

---

## Alteracoes

### 1. Tabela de Itens do Orcamento — Valor editavel para pecas

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx` (secao ~linhas 892-929)

- Adicionar coluna "Valor Unit." na tabela de itens do orcamento
- Para itens do tipo `peca`: renderizar um `<Input type="number">` editavel
- Para itens de mao de obra/servico: exibir o valor ja preenchido pelo regulador (somente leitura)
- Usar estado local (`useState`) para armazenar valores editados das pecas
- Botao "Salvar Valores" abaixo da tabela (visivel apenas quando ha alteracoes pendentes)
- Ao salvar: atualizar o campo `dados_vistoria.itens_orcamento` na tabela `vistorias_evento` com os novos valores das pecas

### 2. Botao "Solicitar Orcamento"

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`

- Adicionar botao "Solicitar Orcamento" logo abaixo da tabela de itens (ao lado do botao Salvar)
- Ao clicar, abre o novo modal `SolicitarOrcamentoDialog`

### 3. Novo componente: `SolicitarOrcamentoDialog`

**Arquivo:** `src/components/sinistros/SolicitarOrcamentoDialog.tsx` (NOVO)

Modal contendo:
- Cabecalho com dados do veiculo (marca, modelo, ano, placa)
- Lista de pecas do orcamento (somente leitura, para referencia)
- Lista de Auto Centers compativeis com checkboxes (multiselecao):
  - Filtrados por `marcas_atendidas` contendo a marca do veiculo OU "GLOBAL"
  - Filtrados por status "ativo" e com whatsapp cadastrado
  - Agrupados por tipo (Auto Center, Ferro Velho, Montadora — campo `tipo` da tabela `auto_centers`)
  - Mostra nome, cidade, tipos de peca que trabalha
- Botao "Solicitar Orcamentos" no footer
- Ao confirmar:
  1. Para cada Auto Center selecionado, cria registro em `evento_cotacoes_pecas` (status: "enviado")
  2. Invoca a edge function `enviar-cotacao-pecas` para enviar WhatsApp (ja existente)
  3. Toast de sucesso
  4. Ativa a aba "Cotacoes Recebidas" (que ja existe em `CotacoesRecebidasTab`)

### 4. Garantir visibilidade da aba "Cotacoes Recebidas"

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`

- A variavel `showCotacoesTab` ja existe e controla a exibicao das tabs. Verificar que ela se torna `true` apos o envio de cotacoes (ela verifica se existem cotacoes na tabela `evento_cotacoes_pecas`).
- O componente `CotacoesRecebidasTab` ja implementa todo o fluxo de: exibir cotacoes enviadas, registrar respostas, comparar valores, aprovar cotacao. Nao precisa de alteracao.

---

## Fluxo completo do ponto de vista do Analista

```text
1. Analista abre sinistro aprovado
2. Ve tabela de itens com pecas sem valor
3. (Opcional) Preenche valores manualmente e salva
4. Clica "Solicitar Orcamento"
5. Seleciona Auto Centers/Ferro Velhos
6. Clica "Solicitar Orcamentos"
7. WhatsApp e enviado para cada estabelecimento
8. IA processa respostas (fluxo ja existente)
9. Aba "Cotacoes Recebidas" mostra respostas e comparativo
10. Analista aprova a melhor cotacao
```

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/pages/eventos/SinistroAnalise.tsx` | Adicionar inputs de valor nas pecas, botao salvar, botao solicitar orcamento |
| `src/components/sinistros/SolicitarOrcamentoDialog.tsx` | NOVO — modal de selecao de Auto Centers |

## Detalhes tecnicos

### Salvamento dos valores de pecas

Os itens do orcamento ficam em `vistorias_evento.dados_vistoria.itens_orcamento` (JSONB). Para salvar:

```text
UPDATE vistorias_evento
SET dados_vistoria = jsonb_set(
  dados_vistoria,
  '{itens_orcamento}',
  <novo_array_json>
)
WHERE id = <vistoria_id>
```

No frontend, via Supabase client:
- Ler o `dados_vistoria` atual
- Atualizar apenas `valor_unitario` e `valor_total` dos itens do tipo `peca`
- Salvar o objeto inteiro de volta

### Filtro de Auto Centers

Reutilizar o hook `useAutoCenters({ marca: marcaVeiculo })` que ja faz o filtro `marcas_atendidas.cs.{marca}` OR `marcas_atendidas.cs.{GLOBAL}`. Adicionar filtro local por `status === 'ativo'` e `whatsapp` preenchido.

### Criacao de cotacoes e envio

Reutilizar exatamente a mesma logica de `AtribuirFornecedoresDialog.tsx` (linhas 227-265) para criar registros em `evento_cotacoes_pecas` e invocar `enviar-cotacao-pecas`.
