

## Correção: Botão Atribuir Portador e Exibição da Atribuição

### Diagnóstico

Após análise detalhada e testes, identifiquei que a funcionalidade **está funcionando corretamente**. O dialog de atribuição abre, a atribuição é salva com sucesso e a informação do portador é exibida. 

No entanto, existem problemas de **usabilidade visual** que podem causar confusão:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ PROBLEMAS IDENTIFICADOS                                                     │
├────────────────────────────────────────────────────────────────────────────┤
│ 1. Botão "Atribuir" é muito discreto (variant="ghost", cor cinza)          │
│ 2. Ícone de alterar portador é muito pequeno (6x6 pixels)                  │
│ 3. Botão na página Estoque não tem opção inline, apenas no menu dropdown   │
│ 4. Screenshot do usuário mostra botão vermelho que não existe no código    │
└────────────────────────────────────────────────────────────────────────────┘
```

### Solução Proposta

Melhorar a visibilidade e usabilidade dos controles de atribuição de portador em ambas as páginas:

#### 1. Melhorar o botão "Atribuir" na página Rastreadores

**Arquivo:** `src/pages/monitoramento/Rastreadores.tsx`

**Antes:**
- Botão `variant="ghost"` com `text-muted-foreground` (cinza, pouco visível)

**Depois:**
- Botão `variant="outline"` com cores de destaque para ser mais clicável

```text
Antes:      [👤 Atribuir] (cinza, discreto)
                   ↓
Depois:     [👤 Atribuir] (com borda azul, mais visível)
```

#### 2. Aumentar ícone de alterar portador

**Arquivo:** `src/pages/monitoramento/Rastreadores.tsx`

**Antes:**
- Ícone de 3.5x3.5 em um botão de 6x6 (muito pequeno)

**Depois:**
- Ícone de 4x4 em um botão de 7x7 com tooltip explicativo

#### 3. Adicionar botão inline na página Estoque

**Arquivo:** `src/components/monitoramento/estoque/ListaRastreadores.tsx`

Adicionar o mesmo padrão de botão inline usado na página Rastreadores:
- Quando tem portador: mostrar nome + ícone de edição
- Quando não tem: mostrar botão "Atribuir"

### Mudanças Técnicas

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/monitoramento/Rastreadores.tsx` | Melhorar estilo do botão "Atribuir" (linhas 432-443) |
| `src/pages/monitoramento/Rastreadores.tsx` | Aumentar tamanho do ícone de alterar portador (linhas 417-429) |
| `src/components/monitoramento/estoque/ListaRastreadores.tsx` | Adicionar botão inline na coluna Portador (linhas 363-371) |

### Comparação Visual

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ ANTES (problema de visibilidade)                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ Portador                                                                │
│ ─────────────────                                                       │
│ 👤 Atribuir  (cinza, quase invisível)                                   │
│ [Nome] 🔍    (ícone muito pequeno)                                      │
│ -                                                                       │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ DEPOIS (melhor visibilidade)                                            │
├─────────────────────────────────────────────────────────────────────────┤
│ Portador                                                                │
│ ─────────────────                                                       │
│ ┌───────────────┐                                                       │
│ │ 👤 Atribuir   │  (com borda, mais visível)                            │
│ └───────────────┘                                                       │
│ [Nome]  🔍       (ícone maior com tooltip)                              │
│ -                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Código Proposto

**Rastreadores.tsx - Botão "Atribuir" melhorado:**
```typescript
<Button
  variant="outline"
  size="sm"
  className="h-7 text-xs border-primary/50 text-primary hover:bg-primary/10"
  onClick={(e) => {
    e.stopPropagation();
    handleOpenPortadorDialog(rastreador);
  }}
>
  <UserPlus className="h-3.5 w-3.5 mr-1" />
  Atribuir
</Button>
```

**Rastreadores.tsx - Ícone de alterar maior:**
```typescript
<Button
  variant="ghost"
  size="icon"
  className="h-7 w-7"
  onClick={(e) => {
    e.stopPropagation();
    handleOpenPortadorDialog(rastreador);
  }}
  title="Alterar portador"
>
  <UserPlus className="h-4 w-4 text-muted-foreground hover:text-foreground" />
</Button>
```

**ListaRastreadores.tsx - Adicionar botão inline:**
```typescript
<TableCell>
  <div className="flex items-center gap-1.5">
    {item.portador?.nome ? (
      <>
        <User className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate max-w-[100px] text-sm">{item.portador.nome}</span>
        {item.status === 'estoque' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setDialogAtribuirPortador({...})}
            title="Alterar portador"
          >
            <UserPlus className="h-3.5 w-3.5" />
          </Button>
        )}
      </>
    ) : item.status === 'estoque' ? (
      <Button
        variant="outline"
        size="sm"
        className="h-6 text-xs"
        onClick={() => setDialogAtribuirPortador({...})}
      >
        <UserPlus className="h-3 w-3 mr-1" />
        Atribuir
      </Button>
    ) : (
      <span className="text-muted-foreground text-sm">-</span>
    )}
  </div>
</TableCell>
```

