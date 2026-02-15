

# Pre-preencher Marca, Modelo e Ano no Orcamento

## Problema

Quando o regulador abre o modal de orcamento e adiciona um item do tipo "Peca", os campos Marca, Modelo e Ano aparecem vazios, embora o veiculo do sinistro ja tenha essas informacoes. O regulador precisa selecionar manualmente cada campo toda vez.

## Solucao

Passar os dados do veiculo (marca, modelo, ano) para o componente de orcamento e usá-los para pré-selecionar automaticamente os campos FIPE no `PecaSelectFields`.

## Alteracoes

### 1. `src/pages/regulador/ExecutarVistoriaEvento.tsx`
- Passar prop `veiculo` para `VistoriaEventoOrcamento` (ja disponivel no `data.veiculo`)

### 2. `src/components/regulador/VistoriaEventoOrcamento.tsx`
- Receber nova prop `veiculo` com `{ marca, modelo, ano_modelo }`
- Passar `veiculo` para `PecaSelectFields` via nova prop `initialVeiculo`
- Ao criar novos itens do tipo "peca", ja incluir os dados do veiculo nos `pecaValuesMap` defaults

### 3. `src/components/oficinas/PecaSelectFields.tsx`
- Adicionar prop opcional `initialVeiculo?: { marca: string; modelo: string; ano_modelo: string | number }`
- Quando as marcas carregarem da FIPE, buscar automaticamente a marca que corresponde ao nome do veiculo (match case-insensitive/parcial)
- Ao encontrar a marca, disparar o carregamento dos modelos e selecionar o modelo correspondente
- Ao encontrar o modelo, carregar os anos e selecionar o ano correspondente
- Usar um `useRef` para garantir que o auto-match so aconteca uma vez (na primeira carga)

### Fluxo do auto-preenchimento

```text
Marcas carregam via FIPE API
  -> Busca marca cujo nome inclui "Chevrolet" (do veiculo)
  -> Seleciona automaticamente (codigo + nome)
  -> Modelos carregam via FIPE API
    -> Busca modelo cujo nome inclui "Onix" (do veiculo)
    -> Seleciona automaticamente
    -> Anos carregam via FIPE API
      -> Busca ano que contem "2022" (do veiculo)
      -> Seleciona automaticamente
```

O regulador ainda podera alterar qualquer campo manualmente caso necessario, mas na maioria dos casos os campos ja estarao corretos ao abrir.

## Detalhes tecnicos

- O match de marca sera feito com `nome.toLowerCase().includes(veiculo.marca.toLowerCase())` para lidar com variantes (ex: "CHEVROLET" vs "Chevrolet")
- O match de modelo usara a mesma logica parcial
- O match de ano usara `nome.includes(String(ano_modelo))`
- Um `useRef(false)` chamado `autoMatchedRef` impedira que o auto-match se repita ao reabrir popovers ou ao trocar de item
