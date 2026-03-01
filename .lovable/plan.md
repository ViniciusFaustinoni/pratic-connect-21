

# Redesign de Layout - Area do Instalador/Vistoriador

## Problema

As telas da area do instalador/vistoriador tem problemas de scroll e sobreposicao porque:

1. O **InstaladorLayout** usa `sticky` header + `fixed` bottom nav com `pb-16` no main
2. As paginas filhas (ExecutarManutencao, ExecutarVistoriaCompleta, InstaladorChecklist, etc.) criam seus **proprios** headers `sticky top-0` e footers `fixed bottom-0` que conflitam com o layout pai
3. Varias paginas usam `min-h-screen` dentro de um container que ja tem altura controlada, causando overflow duplo
4. O `InstaladorChecklist` e `ExecutarRetirada` ja foram parcialmente corrigidos com `h-[100dvh]`, mas isso tambem conflita com o layout pai que ja fornece a estrutura

## Solucao

Padronizar todas as paginas para funcionar **dentro** do container de scroll do `InstaladorLayout`, sem criar seus proprios containers de viewport completa.

### Principio: Paginas normais vs Paginas de execucao

- **Paginas normais** (Home, Tarefas, Perfil, Configuracoes): Conteudo simples que rola dentro do `main` do layout. Remover `min-h-screen` redundante.

- **Paginas de execucao** (InstaladorChecklist, ExecutarManutencao, ExecutarRetirada, ExecutarVistoriaCompleta): Precisam de header proprio + footer fixo. Usar `h-full` com flex column para ocupar o espaco disponivel do layout pai, nao da viewport.

### Alteracoes por arquivo

**1. `src/components/instalador/InstaladorLayout.tsx`**
- Mudar o `main` de `overflow-hidden pb-16` para um container flex que permite as paginas de execucao controlarem seu proprio scroll
- Garantir que a area de conteudo ocupa `flex-1 min-h-0` corretamente
- Mudar a bottom nav de `fixed` para estar dentro do flow do flex (evita conflito de z-index)

**2. `src/pages/instalador/InstaladorHome.tsx`**
- Remover `min-h-screen` do container principal (o layout pai ja fornece isso)
- Manter o conteudo como flow normal

**3. `src/pages/instalador/InstaladorTarefas.tsx`**
- Remover `min-h-screen` do container principal

**4. `src/pages/instalador/InstaladorPerfil.tsx`**
- Remover `min-h-screen` (se existir)

**5. `src/pages/instalador/InstaladorConfiguracoes.tsx`**
- Remover `min-h-screen`

**6. `src/pages/instalador/InstaladorChecklist.tsx`**
- Remover `h-[100dvh]` e `overflow-hidden` do container raiz
- Usar `flex flex-col h-full` para se encaixar no espaco do layout pai
- Progress bar: `flex-shrink-0` (ja feito)
- Content: `flex-1 overflow-y-auto` com `-webkit-overflow-scrolling: touch`
- Footer: `flex-shrink-0` (ja feito), remover `fixed`

**7. `src/pages/instalador/ExecutarRetirada.tsx`**
- Mesma abordagem: trocar `h-[100dvh]` por `flex flex-col h-full`
- Header e progress como `flex-shrink-0`
- Content como `flex-1 overflow-y-auto`

**8. `src/pages/instalador/ExecutarManutencao.tsx`**
- Trocar `min-h-screen bg-background` por `flex flex-col h-full bg-background`
- Header `sticky top-0` vira `flex-shrink-0`
- Content area recebe `flex-1 overflow-y-auto`

**9. `src/pages/instalador/ExecutarVistoriaCompleta.tsx`**
- Trocar `min-h-screen pb-32` por `flex flex-col h-full`
- Header e progress bar como `flex-shrink-0`
- Main como `flex-1 overflow-y-auto`
- Footer: trocar `fixed bottom-0` por `flex-shrink-0`

### Ajuste chave no InstaladorLayout

O layout precisa esconder a bottom nav nas rotas de execucao (checklist, manutencao, retirada, vistoria) para que o footer proprio da pagina de execucao nao conflite:

```text
// Detectar se esta numa rota de execucao
const isRotaExecucao = location.pathname.match(
  /\/instalador\/(retirada|vistoria|manutencao|instalacao)\//
);

// Esconder bottom nav em rotas de execucao
{!isRotaExecucao && <nav>...</nav>}
```

Isso elimina o conflito de dois footers sobrepostos e libera o espaco para o footer da pagina de execucao.

### Resultado esperado

- Scroll funciona fluido em todas as telas, sem travamento no iOS
- Nenhum elemento sobreposto (header do layout + header da pagina, ou bottom nav + footer de execucao)
- Paginas normais rolam naturalmente no container do layout
- Paginas de execucao tem seu proprio scroll interno sem conflitos

### Total: 9 arquivos alterados

