

# Mostrar Fotos do Instalador + Autovistoria na Aba Documentos

## Problema
A aba Documentos usa `useFotosAutovistoriaCotacao` que busca apenas fotos da tabela `cotacoes_vistoria_fotos` (autovistoria do associado). Fotos do instalador ficam na tabela `vistoria_fotos` (via `vistorias`) e não são exibidas.

## Solução
Substituir `useFotosAutovistoriaCotacao` por `useFotosVistoriaUnificada` **e** manter fallback para autovistoria, mostrando **ambas** as galerias quando existirem.

## Alterações

### 1. `src/hooks/useFotosAutovistoria.ts` — Retornar ambas as fontes
Modificar `useFotosVistoriaUnificada` para retornar fotos de **ambas** as tabelas (não apenas priorizar uma). Adicionar campo `fotosAutovistoria` ao retorno, buscando `cotacoes_vistoria_fotos` mesmo quando `vistoria_fotos` tem dados.

### 2. `src/pages/cadastro/AssociadoDetalhe.tsx`
- Trocar `useFotosAutovistoriaCotacao(cotacaoId)` por `useFotosVistoriaUnificada({ contratoId: contrato?.id, cotacaoId })`
- Renderizar **duas galerias separadas**:
  - "Galeria do Instalador" — fotos de `vistoria_fotos` (quando existirem)
  - "Galeria de Autovistoria" — fotos de `cotacoes_vistoria_fotos` (quando existirem)
- Atualizar contadores para somar ambas as fontes

## Layout esperado
```text
┌─────────────────────────────────┐
│ 📷 Galeria do Instalador   [12]│
│ Exterior (5)  Interior (4) ... │
│ [img] [img] [img] [vid] ...    │
├─────────────────────────────────┤
│ 📷 Galeria de Autovistoria  [3]│
│ Outros (1)                     │
│ [img] [vid] ...                │
└─────────────────────────────────┘
```

## Impacto
- 2 arquivos alterados
- Instalador e autovistoria exibidos lado a lado
- Nenhuma funcionalidade perdida

