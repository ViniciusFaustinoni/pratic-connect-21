
# Corrigir Mapa de Monitoramento na Versao Mobile

## Problema

A pagina de Monitoramento > Mapa (`/monitoramento/mapa`) usa layout desktop-only com sidebar fixa de 320px (`w-80`) ao lado do mapa. No mobile, essa sidebar ocupa toda a largura da tela, deixando o mapa sem espaco para renderizar.

Isso afeta tanto a aba "Vistorias Pendentes" (`MapaVistoriasContent.tsx`) quanto a aba "Veiculos em Tempo Real" (dentro de `Mapa.tsx`).

## Solucao

Tornar o layout responsivo em ambos os componentes: no mobile, empilhar sidebar e mapa verticalmente (mapa em cima, lista embaixo como painel deslizante ou dividido). No desktop, manter o layout atual lado a lado.

### Abordagem: Mapa fullscreen + lista como sheet/drawer no mobile

No mobile:
- O mapa ocupa toda a tela
- A lista de vistorias/veiculos aparece como um painel inferior arrastavel (sheet), similar ao comportamento do Google Maps mobile
- Botoes de filtro ficam sobrepostos no topo do mapa

No desktop (>= 768px):
- Manter layout atual com sidebar `w-80` + mapa `flex-1`

## Alteracoes

### 1. `src/pages/monitoramento/Mapa.tsx`

- Detectar mobile via `useIsMobile()`
- No mobile: renderizar tabs + mapa fullscreen, com a lista de veiculos em um `Sheet` (vaul drawer) que abre de baixo
- Manter botoes de filtro compactos sobrepostos no mapa
- No desktop: manter layout atual sem alteracoes

### 2. `src/components/mapa/MapaVistoriasContent.tsx`

- Aceitar prop `isMobile` ou usar `useIsMobile()` internamente
- No mobile: mapa fullscreen com lista em drawer/sheet inferior
- No desktop: manter sidebar lateral atual

### 3. Ajustes de CSS

- Garantir que o container do mapa ocupe `100%` de altura no mobile
- Ajustar z-index do drawer para ficar acima do mapa

## Detalhes Tecnicos

### Layout mobile para aba Veiculos

```text
+---------------------------+
|  [Tabs: Vistorias | Veic] |
|  +---------------------+  |
|  |                     |  |
|  |      MAPA           |  |
|  |    (fullscreen)     |  |
|  |                     |  |
|  +---------------------+  |
|  [Filtros: Status|Busca]  |  <- overlay no mapa
|  +----- DRAWER --------+  |
|  | Lista de veiculos   |  |  <- arrastavel de baixo
|  +---------------------+  |
+---------------------------+
```

### Componentes reutilizados

- `Drawer` do vaul (ja instalado no projeto) para o painel inferior mobile
- `useIsMobile()` de `@/hooks/use-mobile` para deteccao

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/pages/monitoramento/Mapa.tsx` | Layout responsivo com drawer mobile para aba veiculos |
| `src/components/mapa/MapaVistoriasContent.tsx` | Layout responsivo com drawer mobile para aba vistorias |
