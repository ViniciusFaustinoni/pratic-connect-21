

# Wizard de Substituicao de Veiculo — Pagina + Steps 1 a 4

## Resumo

Criar a pagina principal de substituicao com stepper visual de 6 passos, e os componentes dos 4 primeiros steps: Elegibilidade, Evento Ativo, Novo Veiculo, e Beneficios. Os steps 5 e 6 (Financeiro e Aprovacao) ficam para o proximo PR.

---

## Arquivos a criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/cadastro/SubstituicaoVeiculoPage.tsx` | Pagina principal com stepper e orquestracao dos steps |
| `src/components/substituicao/SubstituicaoStepper.tsx` | Stepper visual de 6 passos (baseado no CotacaoStepper) |
| `src/components/substituicao/StepElegibilidade.tsx` | Step 1: checklist de elegibilidade |
| `src/components/substituicao/StepEventoAtivo.tsx` | Step 2: tratamento de evento (3 opcoes) |
| `src/components/substituicao/StepNovoVeiculo.tsx` | Step 3: formulario do novo veiculo com FIPE |
| `src/components/substituicao/StepBeneficios.tsx` | Step 4: selecao de beneficios adicionais |

## Arquivo a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/App.tsx` | Adicionar rota `/cadastro/associados/:associadoId/substituicao` |

---

## Detalhes por arquivo

### 1. SubstituicaoStepper.tsx

Componente visual baseado no `CotacaoStepper` existente, adaptado para 6 steps:
1. Elegibilidade
2. Eventos
3. Novo Veiculo
4. Beneficios
5. Financeiro (placeholder, nao implementado ainda)
6. Aprovacao (placeholder, nao implementado ainda)

Mesma estrutura visual: circulos com check/numero, linhas conectoras, responsivo desktop/mobile.

### 2. SubstituicaoVeiculoPage.tsx

Pagina principal que:
- Recebe `associadoId` via `useParams()`
- Busca dados do associado com `useAssociados` ou query direta
- Busca veiculo ativo do associado (ativo = true, principal = true)
- Gerencia estado do stepper (step atual, steps completos)
- Gerencia estado compartilhado entre steps (dados do novo veiculo, beneficios selecionados, dados de elegibilidade)
- Breadcrumb: Home > Cadastro > Associados > Nome > Substituicao
- Renderiza o step correto conforme o estado atual

### 3. StepElegibilidade.tsx

Props: `associadoId`, `onNext`, `onEventoDetectado(evento)`

- Chama `useVerificarElegibilidade(associadoId)` ao montar
- Exibe checklist visual com 3 itens (adimplencia, rastreador, eventos)
- Cada item mostra icone verde/vermelho/amarelo + texto descritivo
- Se `pendencia_rastreador = true`: Alert destructive + botao "Agendar retirada" (link para servicos)
- Se `evento_ativo.tem && tipo === 'proprio'`: seta flag para mostrar Step 2
- Botao "Proximo" habilitado apenas se `adimplente AND rastreador_devolvido AND (sem evento proprio)`
- Se tem evento proprio: botao "Proximo" leva ao Step 2
- Se nao tem evento ou so terceiros: botao "Proximo" pula Step 2 e vai ao Step 3

### 4. StepEventoAtivo.tsx

Props: `evento`, `substituicaoId`, `onNext`, `onBack`

So renderiza se o veiculo tem evento do proprio em andamento.

Exibe card com dados do evento (tipo, status, data, numero).

3 opcoes via RadioGroup com cards expandidos:

**A) Aguardar finalizacao**
- Cria/atualiza registro em `substituicoes_veiculo` com `resolucao_evento = 'aguardar_finalizacao'`
- Toast informativo, nao avanca (substituicao fica em espera)

**B) Cancelar com termo**
- Alerta que o associado perde direito ao reparo
- Cria registro com `resolucao_evento = 'cancelar_com_termo'`
- Chama `autentique-create` para gerar termo de desistencia
- Apos gerar, avanca ao Step 3

**C) Inclusao temporaria**
- Info: pagara 2 mensalidades temporariamente
- Cria registro com `resolucao_evento = 'inclusao_temporaria'`
- Redireciona para fluxo de inclusao (ou avanca com flag)

### 5. StepNovoVeiculo.tsx

Props: `veiculoAntigo`, `dadosNovoVeiculo`, `setDadosNovoVeiculo`, `onNext`, `onBack`

Formulario com:
- Placa (mascara ABC-1D23/ABC-1234) — ao digitar placa completa, verifica se ja existe com `buscarVeiculoPorPlaca`
- Consulta FIPE: usa `useFipe().getByPlaca` para busca automatica, e `useFipeLookup` para busca manual (marca > modelo > ano)
- Dados adicionais: cor (Select), combustivel (Select), chassi, renavam
- Uso aplicativo: Switch + Select plataforma
- Card comparativo: tabela antigo vs novo (modelo, placa, FIPE, diferenca)
- Alert se FIPE > R$ 120.000
- Botao "Proximo" habilitado quando campos obrigatorios preenchidos e FIPE consultada

### 6. StepBeneficios.tsx

Props: `veiculoAntigo`, `dadosNovoVeiculo`, `beneficiosSelecionados`, `setBeneficiosSelecionados`, `onNext`, `onBack`

- Card "Beneficios do veiculo antigo" (somente visualizacao)
- Card "Beneficios do novo veiculo" (editavel):
  - Checkboxes para cada beneficio com preco mensal
  - Select para faixa de Danos a Terceiros
  - Opcao "100% FIPE para APP" so aparece se `uso_aplicativo = true`
- Resumo financeiro:
  - Mensalidade base (calculada pelo FIPE do novo veiculo — simplificada como percentual ou tabela fixa)
  - Adicionais selecionados
  - Total mensal estimado
  - Diferenca da mensalidade anterior
- Botao "Proximo" sempre habilitado (beneficios sao opcionais)

---

## Rota no App.tsx

Adicionar na secao de cadastro (apos a rota `:id`):

```text
<Route path="/cadastro/associados/:associadoId/substituicao" element={<SubstituicaoVeiculoPage />} />
```

Importar `SubstituicaoVeiculoPage` com lazy loading (mesmo padrao de outras paginas).

---

## O que NAO sera alterado

- EtapaConsultaFipe — intacto (usado apenas como referencia visual)
- CotacaoStepper — intacto (usado apenas como referencia visual)
- useSubstituicaoVeiculo — intacto (ja esta pronto)
- useFipe / useFipeLookup — intactos (serao consumidos, nao modificados)
- useVeiculos — intacto
- Nenhuma pagina existente
- Nenhuma edge function

## Dependencias ja existentes no projeto

- `useVerificarElegibilidade` do hook `useSubstituicaoVeiculo`
- `useIniciarSubstituicao` e `useAtualizarSubstituicao` do mesmo hook
- `useFipe` (getByPlaca) e `useFipeLookup` (busca manual marca/modelo/ano)
- `buscarVeiculoPorPlaca` de `useVeiculos`
- Componentes UI: Card, Alert, Button, Select, Input, Switch, RadioGroup, Checkbox, Label, Badge
- `PlacaInput` de `MaskedInputs`
- Roteamento com `react-router-dom` (useParams, useNavigate)

