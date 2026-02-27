

# Exibir Local de Instalacao na Aba Informacoes do Rastreador

## Problema

A secao "Local de Instalacao" no drawer de detalhes do rastreador so aparece quando o status e `instalado` E quando existe algum dado preenchido. Isso significa que durante operacoes de **manutencao**, **retirada** ou **vistoria** (quando o status muda para outro valor), a informacao desaparece -- justamente quando o profissional mais precisa dela.

Alem disso, quando nenhum dado de local esta preenchido, nao ha nenhuma indicacao visual de que essa informacao esta faltando.

## Solucao

### 1. Remover condicao de status `instalado` para exibicao

A secao "Local de Instalacao" passara a ser exibida **sempre**, independente do status do rastreador. Se os dados existirem, mostra normalmente. Se nao existirem, mostra um aviso de "informacao pendente" com fundo amarelo claro.

### 2. Melhorar layout da secao

- Exibir badge com local padronizado
- Exibir descricao do ponto
- Exibir foto clicavel com visualizador (usando o `VisualizadorFoto` ja existente no projeto)
- Quando dados ausentes: card de alerta "Local de instalacao nao registrado"

## Arquivo modificado

**`src/components/rastreadores/RastreadorDetailDrawer.tsx`** -- Alterar a condicao da linha 261 para remover `isInstalled &&`, e adicionar fallback visual quando nao ha dados.

## Detalhes tecnicos

A condicao atual:
```
isInstalled && (rastreador.local_instalacao || rastreador.descricao_instalacao || rastreador.foto_local_instalacao_url)
```

Sera substituida por uma secao que sempre aparece:
- Se ha dados: mostra local, descricao e foto normalmente
- Se nao ha dados: mostra card informativo "Local de instalacao nao registrado" com icone de alerta

A foto usara o componente `VisualizadorFoto` ja existente em `src/components/analise/VisualizadorFoto.tsx` para abrir em modal com zoom, em vez de abrir em nova aba.

