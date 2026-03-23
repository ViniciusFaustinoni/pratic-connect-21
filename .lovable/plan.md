

# Plano: Adicionar rotas ocultas ao menu lateral

## Resumo

Adicionar 6 itens de navegacao ao AppSidebar.tsx em 3 grupos existentes, sem alterar nenhuma pagina.

---

## Alteracao unica: `src/components/layout/AppSidebar.tsx`

### 1. Imports de icones (linha 72)

Adicionar ao bloco de imports do lucide-react: `CalendarCheck`, `Settings2`, `GraduationCap`, `UserSearch`

(`Truck`, `Route` ja estao importados)

### 2. Grupo Monitoramento (apos "Aprovação de Associados", linha 228)

Adicionar 3 itens:

```tsx
{ title: 'Prestadores Parceiros', url: '/monitoramento/prestadores-parceiros', icon: Truck },
{ title: 'Encaixes', url: '/monitoramento/encaixes', icon: CalendarCheck },
{ title: 'Config. Plataformas', url: '/monitoramento/config-plataformas', icon: Settings2, permission: 'canManageRastreadores' },
```

### 3. Grupo RH (apos "Benefícios", linha 356)

Adicionar 2 itens:

```tsx
{ title: 'Treinamentos', url: '/rh/treinamentos', icon: GraduationCap },
{ title: 'Recrutamento', url: '/rh/recrutamento', icon: UserSearch },
```

### 4. Grupo Diretoria (apos "Vistorias e Instalações", linha 404)

Adicionar 1 item:

```tsx
{ title: 'Gestão de Rotas', url: '/diretoria/gestao-vistorias-instalacoes', icon: Route },
```

---

## Nenhuma outra alteracao

Nenhuma pagina criada ou modificada. Apenas navegacao.

