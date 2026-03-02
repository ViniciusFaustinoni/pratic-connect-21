

# Correcao: Tela de Recusas do Instalador nao acessivel

## Problema Identificado

A rota `/cadastro/recusas-instalador` existe e a pagina `RecusasInstalador.tsx` foi criada corretamente, porem **nao foi adicionada ao menu lateral** (`AppSidebar.tsx`). Por isso o usuario nao consegue encontrar a tela visualmente e, ao navegar para `/cadastro`, ve um 404 (pois nao existe rota index para `/cadastro`).

## Correcoes Necessarias

### 1. Adicionar item no menu lateral do Cadastro

**Arquivo:** `src/components/layout/AppSidebar.tsx`

Adicionar no grupo `cadastro` (linha ~178, apos "Substituicoes"):

```
{ title: 'Recusas do Instalador', url: '/cadastro/recusas-instalador', icon: ShieldAlert }
```

Importar o icone `ShieldAlert` de `lucide-react`.

### 2. Garantir visibilidade para perfis corretos

No filtro `isAnalistaCadastroOnly` (linha ~548), adicionar `/cadastro/recusas-instalador` na lista de URLs permitidas, para que analistas de cadastro tambem vejam o item.

Verificar se `coordenador_monitoramento` tambem precisa de ajuste similar (se houver filtro especifico para esse perfil).

### 3. Badge de contagem no menu (opcional, melhoria visual)

Utilizar `useContagemRecusasPendentes()` para exibir um badge vermelho com a contagem de pendentes ao lado do item "Recusas do Instalador" no menu, similar ao padrao de notificacoes.

---

## Arquivos a editar

- `src/components/layout/AppSidebar.tsx` -- adicionar item de menu + importar icone + ajustar filtro de perfil

