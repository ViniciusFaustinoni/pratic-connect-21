

## Plano: Tutorial passo a passo em cada campo do formulario de planos

### Abordagem

Criar um componente `FieldHint` reutilizavel que exibe um icone de ajuda (?) ao lado do label. Ao clicar/hover, mostra um tooltip com explicacao do campo e seu impacto na cotacao/calculadora. Aplicar em todos os campos de todas as 5 abas do `PlanFormModal`.

### 1. Novo componente: `src/components/admin/planos/FieldHint.tsx`

Componente simples usando `Tooltip` do shadcn. Recebe `text` (string) e renderiza um icone `HelpCircle` com tooltip ao hover. Estilo discreto (texto muted, icone pequeno).

### 2. Mapa de hints: `src/components/admin/planos/planFieldHints.ts`

Objeto constante com chave = campo e valor = texto explicativo. Exemplos:

- **name**: "Nome exibido no card do plano na cotacao e calculadora."
- **slug**: "Identificador unico do plano. Gerado automaticamente. Nao pode ser alterado apos criacao."
- **product_line_id**: "Linha de produto (ex: Auto, Moto). Determina em qual categoria o plano aparece na cotacao e calculadora."
- **tipo_uso**: "Define se o plano e para veiculos particulares ou de aplicativo. Na cotacao, so aparecem planos compativeis com o tipo de uso do cliente."
- **badge_text/badge_color**: "Texto destacado no card (ex: 'Mais Vendido'). Puramente visual, nao afeta calculo."
- **coverage_type**: "Texto descritivo da cobertura (ex: '100% FIPE'). Exibido no card do plano na cotacao."
- **min_vehicle_year**: "Ano minimo aceito (ex: '2015+'). Veiculos abaixo desse ano NAO verao este plano na cotacao nem na calculadora."
- **linha_slug**: "Vincula o plano a uma tabela de precos mensais. Sem vinculo, o plano nao tera preco e sera ocultado na cotacao."
- **categorias_veiculo**: "Categorias aceitas (passeio, aplicativo, moto, etc). O plano so aparece na cotacao se a categoria do veiculo estiver selecionada aqui."
- **regioes**: "Regioes onde o plano esta disponivel. Se nenhuma regiao for selecionada, o plano pode nao aparecer para clientes de determinadas localidades."
- **is_active**: "Desativado = plano invisivel em toda a plataforma (cotacao, calculadora, gestao)."
- **additional_price**: "Valor fixo adicionado a mensalidade. Somado ao valor da tabela de precos na cotacao."
- **desconto_percentual**: "Desconto aplicado sobre o valor mensal final. Exibido como promocao no card da cotacao."
- **cotas por categoria**: "Percentual e valor minimo da cota de participacao para cada categoria. Usado no calculo de indenizacao. Se nao configurado, usa o fallback global."
- **restriction_alert**: "Mensagem de alerta exibida em destaque no card do plano. Usada para avisar sobre restricoes especiais."
- **footer_note**: "Texto pequeno no rodape do card. Informacao adicional como asteriscos e condicoes."
- **display_order**: "Ordem de exibicao dos planos na cotacao e calculadora. Menor numero = aparece primeiro."
- **elegibilidade**: "Regras de aceitacao por marca/modelo. Funciona como whitelist: se houver regras, somente modelos listados aparecem. Modelos nao listados sao automaticamente negados na cotacao E na calculadora."

### 3. Aplicar `FieldHint` em todos os `<Label>` do PlanFormModal

Em cada campo das abas Basico, Cotas e Outros, adicionar `<FieldHint>` ao lado do `<Label>`. Aproximadamente 15+ campos.

### 4. Adicionar hints na ElegibilidadeTab

Adicionar explicacao no topo da aba e nos campos do formulario de regras (marca, modelo, status, cobertura_fipe).

### 5. Adicionar hints no BenefitsSelector

Texto explicativo no topo sobre como beneficios afetam a exibicao na cotacao.

### Arquivos afetados

- `src/components/admin/planos/FieldHint.tsx` (novo)
- `src/components/admin/planos/planFieldHints.ts` (novo)
- `src/components/admin/planos/PlanFormModal.tsx` (adicionar hints em ~15 campos)
- `src/components/admin/planos/ElegibilidadeTab.tsx` (adicionar hints)
- `src/components/admin/planos/BenefitsSelector.tsx` (adicionar hint no topo)

