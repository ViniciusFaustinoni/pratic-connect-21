

# Plano: 3 Correções Cirúrgicas no Fluxo de Cancelamento

## Estado Atual

- `CancelarAssociadoDialog.tsx` (500 linhas): modal completo com motivos, checklist, financeiro e processamento em steps
- Débitos são exibidos informativamente mas **não bloqueiam** o botão confirmar
- Pro-rata calculado com lógica fixa: `diasRestantes = ultimoDia - hoje.getDate()` (base = dias restantes do mês)
- Nenhuma configuração `prazo_devolucao_rastreador_cancelamento` ou `base_calculo_prorata_cancelamento` existe
- `RegrasVendaContent.tsx` tem 6 abas internas (Pontuação, Repasse, Migração, Taxas, Autorizações, Indicação) — sem aba de Cancelamento
- Hooks `useConfiguracaoNumero` e `useSaveConfigJson` já existem em `useConteudosSistema.ts`
- `pendencia_rastreador` é boolean no associado; não há campo de data limite de devolução

---

## CORREÇÃO 1 — Bloquear cancelamento com débitos em aberto

### Em `CancelarAssociadoDialog.tsx`:

- Adicionar ao `canSubmit`: `&& cobrancasAbertas.length === 0`
- Abaixo do card "Situação Financeira", quando `cobrancasAbertas.length > 0`:
  - Alert vermelho: "Não é possível cancelar enquanto houver débitos em aberto. Boletos pendentes: R$ [total]. Quite os boletos para liberar o cancelamento."
  - Lista de boletos com número (`nosso_numero` ou `asaas_id`), valor e vencimento
- Manter a exibição informativa existente intacta

---

## CORREÇÃO 2 — Prazo configurável para devolução do rastreador

### Passo A — Nova aba "Cancelamento" em `RegrasVendaContent.tsx`:

- Adicionar 7ª TabsTrigger "Cancelamento" com ícone `Ban`
- TabsContent com card contendo:
  - Campo numérico "Prazo para devolução do rastreador após cancelamento (dias)", default 7
  - Botão Salvar → upsert na tabela `configuracoes` com chave `prazo_devolucao_rastreador_cancelamento`

### Passo B — Migration SQL:

- Adicionar coluna `data_limite_devolucao_rastreador` (timestamptz, nullable) na tabela `associados`
- Inserir registro default na tabela `configuracoes` com chave `prazo_devolucao_rastreador_cancelamento`, valor `7`
- Inserir registro default com chave `base_calculo_prorata_cancelamento`, valor `pos_vencimento`

### Passo C — Em `CancelarAssociadoDialog.tsx`:

- Ao confirmar cancelamento (step "processar"), após o processamento, calcular `data_cancelamento + prazo_dias` e salvar em `associados.data_limite_devolucao_rastreador`
- Usar `useConfiguracaoNumero('prazo_devolucao_rastreador_cancelamento', 7)` para ler o prazo

### Passo D — Ficha do associado cancelado:

- Identificar onde a ficha exibe `pendencia_rastreador` e adicionar: "Prazo: DD/MM/AAAA" lendo `data_limite_devolucao_rastreador`

### Passo E — Em `RetiradasContent.tsx`:

- Para serviços com `motivo_retirada = 'cancelamento_voluntario'`, buscar `data_limite_devolucao_rastreador` do associado
- Se data limite ≤ 48h → badge vermelho "Prazo próximo"
- Se data limite já passou → badge vermelho "Prazo vencido"

---

## CORREÇÃO 3 — Base de cálculo do pró-rata configurável

### Passo A — Na nova aba "Cancelamento" de `RegrasVendaContent.tsx`:

- Adicionar seção com RadioGroup:
  - `pos_vencimento`: "Do dia seguinte ao último vencimento até a data do cancelamento"
  - `inicio_mes`: "Do dia 1 do mês corrente até a data do cancelamento"
- Salvar em `configuracoes` chave `base_calculo_prorata_cancelamento`

### Passo B — Em `CancelarAssociadoDialog.tsx`:

- Substituir o cálculo fixo do pro-rata por lógica que lê a configuração:
  - `pos_vencimento`: busca `data_vencimento` da última cobrança de mensalidade paga, calcula dias entre (vencimento + 1) e hoje
  - `inicio_mes`: calcula dias entre dia 1 do mês e hoje
- Ambos usam `valorDiario = mensalidade / diasNoMes`

### Passo C — Resumo do cálculo no modal:

- Antes dos checkboxes, exibir card informativo:
  - "Base: [descrição da opção configurada]"
  - "Período: De DD/MM/AAAA até DD/MM/AAAA (X dias)"
  - "Valor pró-rata: R$ XXX,XX"

---

## Arquivos

- **Migration SQL**: coluna `data_limite_devolucao_rastreador` + 2 registros em `configuracoes`
- **Modificado**: `src/components/cadastro/CancelarAssociadoDialog.tsx` (correções 1, 2C, 3B, 3C)
- **Modificado**: `src/components/gestao-comercial/RegrasVendaContent.tsx` (nova aba Cancelamento — correções 2A, 3A)
- **Modificado**: `src/pages/monitoramento/RetiradasContent.tsx` (badges prazo — correção 2E)
- **Identificar e modificar**: componente da ficha do associado para exibir prazo (correção 2D)

