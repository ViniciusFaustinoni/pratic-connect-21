

## Plano: Corrigir responsividade da TabsList em Serviços de Campo

### Problema
A `TabsList` tem 7-8 abas (Instalações, Vistorias, Retiradas, Encaixes, Viagens, Manutenção, Histórico + opcionalmente Atribuição Manual). Em telas mobile, as abas não cabem e ficam cortadas, impossibilitando o acesso a todas.

### Alteração

**`src/pages/monitoramento/VistoriasInstalacoesMon.tsx`**

1. Aplicar `overflow-x-auto` na `TabsList` para permitir scroll horizontal
2. Adicionar `flex-nowrap w-auto inline-flex` para que as abas não quebrem linha
3. Em mobile, esconder o texto das abas e mostrar apenas ícones (padrão já usado em `Estoque.tsx`)
4. Envolver a `TabsList` num container com `overflow-x-auto` e estilo de scroll suave

Estrutura resultante:
```tsx
<div className="overflow-x-auto -mx-4 px-4">
  <TabsList className="w-auto inline-flex">
    <TabsTrigger value="instalacoes" className="gap-2 shrink-0">
      <Wrench className="h-4 w-4" />
      <span className="hidden sm:inline">Instalações</span>
    </TabsTrigger>
    {/* ... demais abas com mesmo padrão */}
  </TabsList>
</div>
```

### Resultado
- Em mobile: abas mostram apenas ícones, com scroll horizontal se necessário
- Em tablet/desktop: abas completas com ícone + texto
- Todas as abas acessíveis em qualquer dispositivo

### Arquivo
- `src/pages/monitoramento/VistoriasInstalacoesMon.tsx`

