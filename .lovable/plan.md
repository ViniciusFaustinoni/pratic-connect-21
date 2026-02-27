
# Substituir valores hardcoded por valores dinamicos da tabela configuracoes

## Problema

Dois arquivos exibem textos informativos com thresholds de rastreador fixos no codigo. Se o threshold for alterado na tabela `configuracoes`, esses textos ficam desatualizados.

## Abordagem

**Abordagem B** (hooks diretos) para ambos os casos, pois nenhum componente pai ja possui os valores disponíveis para passar como props.

## Alteracoes

### 1. `src/components/planos/GlossarioSection.tsx`

O componente `RegrasImportantes` atualmente renderiza `REGRAS_IMPORTANTES` que vem do arquivo de dados estaticos. A estrategia:

- Importar `useConfigFipeRastreador` e `useConfigFipeRastreadorMoto`
- Dentro do componente `RegrasImportantes`, buscar os valores dinamicos
- Substituir o array estatico `REGRAS_IMPORTANTES` por uma versao computada onde os itens de "Rastreador Obrigatorio" usam os valores do banco
- Manter os itens que nao sao de threshold (Plano Especial, diesel) inalterados

Exemplo do resultado:
```
'Carros >R$30.000' -> `Carros >R$ ${fipeCarro.toLocaleString('pt-BR')}`
'Motos >R$9.000'   -> `Motos >R$ ${fipeMoto.toLocaleString('pt-BR')}`
```

### 2. `src/components/planos/VeiculosAceitos.tsx`

O componente `VeiculosAceitosMotos` tem dois textos hardcoded nas linhas 89-90. A estrategia:

- Importar `useConfigFipeRastreador` e `useConfigFipeRastreadorMoto`
- Usar os valores retornados para gerar os textos dinamicamente
- Linha 89: `FIPE acima de R$9.000` -> usar valor de moto do hook
- Linha 90: `Acima de R$30.000` -> usar valor de carro do hook

### 3. `src/data/planosPrecos.ts` (sem alteracao direta)

Os textos hardcoded nas linhas 193-194 continuam existindo como fallback no array estatico, mas nao serao mais exibidos diretamente -- o componente `RegrasImportantes` os substituira em tempo de renderizacao.

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/components/planos/GlossarioSection.tsx` | Importar hooks e substituir valores de rastreador por dinamicos |
| `src/components/planos/VeiculosAceitos.tsx` | Importar hooks e substituir textos hardcoded por dinamicos |

## Arquivos NAO alterados

- `src/data/planosPrecos.ts` (os dados estaticos servem como fallback)
- `src/hooks/useConfigRastreador.ts`
- Nenhum outro arquivo
