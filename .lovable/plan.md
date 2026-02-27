

# Melhorar Exibicao do Prompt de Instalacao PWA

## Problemas Identificados

1. **Banner temporario**: O prompt atual e um banner flutuante que, ao ser dispensado ("Agora nao"), fica oculto por 7 dias — o usuario perde a oportunidade de instalar
2. **Sem icone permanente**: Nao existe nenhum icone fixo no menu ou header que permita ao usuario instalar o PWA a qualquer momento
3. **iOS limitado ao Safari**: O hook so mostra como instalavel em iOS se o navegador for Safari (`isIOS && isSafari`). Usuarios usando Chrome ou outros browsers no iOS nao veem nada
4. **Sem indicacao no menu lateral**: O `AppMobileMenu` (hamburger) e o `AppUserDropdown` (desktop) nao tem opcao de instalacao

## Solucao

### 1. Icone permanente de download no `AppBottomNav`

Quando o app NAO estiver instalado como PWA, substituir o ultimo item da barra inferior (Perfil) por um item "Instalar" com icone de download, ou adicionar um indicador visual (badge/dot) no icone existente.

**Abordagem escolhida**: Adicionar um botao de download fixo na barra inferior, visivel apenas quando o app nao esta instalado. Ao clicar, dispara o prompt nativo (Android) ou abre o guia iOS.

### 2. Opcao "Instalar App" no menu lateral (`AppMobileMenu`)

Adicionar item "Instalar App" no menu hamburger com icone `Download`, visivel apenas quando `!isInstalled`. Ao clicar, dispara instalacao ou mostra guia iOS.

### 3. Opcao "Instalar App" no dropdown desktop (`AppUserDropdown`)

Adicionar item no dropdown do usuario com icone `Download`, mesma logica.

### 4. Corrigir deteccao iOS para todos os browsers

No hook `usePWAInstall`, remover a restricao `isSafari` para iOS. Em qualquer browser no iOS, mostrar as instrucoes (pois apenas Safari suporta "Add to Home Screen", mas o usuario precisa ser informado disso).

### 5. Manter o banner flutuante como lembrete inicial

O banner continua existindo como lembrete nos primeiros acessos, mas agora o icone permanente no menu garante que o usuario sempre tenha acesso a instalacao.

---

## Arquivos Modificados (5)

1. **`src/hooks/usePWAInstall.ts`** — Corrigir deteccao iOS (aceitar qualquer browser), exportar `isInstalled` de forma independente para uso nos menus
2. **`src/components/app/AppBottomNav.tsx`** — Adicionar botao de download quando nao instalado
3. **`src/components/app/AppMobileMenu.tsx`** — Adicionar item "Instalar App" no menu
4. **`src/components/app/AppUserDropdown.tsx`** — Adicionar item "Instalar App" no dropdown
5. **`src/components/app/AppHeader.tsx`** — Adicionar icone de download visivel no header (desktop)

## Detalhes Tecnicos

### Hook `usePWAInstall` — Mudancas

```typescript
// ANTES: iOS so mostra se for Safari
if (isIOS && isSafari) return true;

// DEPOIS: iOS mostra em qualquer browser (instrui a abrir no Safari)
if (isIOS) return true;
```

Exportar tambem um hook simplificado `usePWAStatus` que retorna apenas `{ isInstalled, isIOS, promptInstall, showIOSInstructions, setShowIOSInstructions }` para uso nos menus sem depender de autenticacao (a autenticacao ja e garantida pelo layout).

### `AppBottomNav` — Botao de download

- Quando `!isInstalled`: adicionar um icone `Download` com um badge/indicador verde pulsante na barra inferior
- Ao clicar: chama `promptInstall()` ou abre guia iOS
- Posicao: como item extra ou substituindo temporariamente um dos itens menos prioritarios

### `AppMobileMenu` — Item no menu

- Adicionar antes do "Sair da conta"
- Icone `Download` + texto "Instalar App"
- Visivel apenas quando `!isInstalled`

### `AppUserDropdown` — Item no dropdown

- Adicionar antes do separador de "Sair"
- Mesma logica

