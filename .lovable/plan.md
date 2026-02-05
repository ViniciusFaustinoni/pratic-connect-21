
## Plano: Remover Botão "Voltar" da Área Pública

### Objetivo
Remover o botão "Voltar" do canto inferior esquerdo que aparece na jornada pública de cotações.

---

### Análise do Estado Atual

O botão "Voltar" aparece em dois arquivos:

#### 1. `src/components/cotacao-publica/NavegacaoEtapas.tsx`
- **Linhas 36-44:** Renderiza o botão "Voltar" com ícone ChevronLeft quando `podeVoltar` é verdadeiro
- Usado em `CotacaoContratacao.tsx` (fluxo de contratação/acompanhamento)

#### 2. `src/pages/public/CotacaoPublicaCompleta.tsx`
- **Linhas 760-762:** Botão "Voltar" no passo "plano"
- **Linhas 824-826:** Botão "Voltar" no passo "proposta"
- **Linhas 900-902:** Botão "Voltar" no passo "documentos"
- **Linhas 973-975:** Botão "Voltar" no passo "selfie"
- **Linhas 1150-1152:** Botão "Voltar" no passo "vistoria"
- Cada botão está em um `<div className="flex gap-3">` ao lado do botão de continuar

---

### Solução Proposta

#### Opção 1: Ocultar o Botão "Voltar" (Recomendado)
Adicionar uma propriedade `mostrarVoltar` ao componente `NavegacaoEtapas` que permite controlar se o botão é exibido. Isso mantém a flexibilidade para futuro.

**Arquivo:** `src/components/cotacao-publica/NavegacaoEtapas.tsx`

```typescript
interface NavegacaoEtapasProps {
  etapaAtual: number;
  etapaMaxima: number;
  totalEtapas: number;
  onVoltar: () => void;
  onAvancar: () => void;
  navegacaoManual?: boolean;
  mostrarVoltar?: boolean; // Novo prop
}

export function NavegacaoEtapas({
  // ...
  mostrarVoltar = false, // Padrão: não mostrar
}: NavegacaoEtapasProps) {
  // ...
  {mostrarVoltar && podeVoltar ? (
    <Button ...>
      <ChevronLeft className="h-4 w-4" />
      Voltar
    </Button>
  ) : <div />}
}
```

**Arquivo:** `src/pages/public/CotacaoPublicaCompleta.tsx`

Remover todos os botões "Voltar" com ChevronLeft (linhas 760-762, 824-826, 900-902, 973-975, 1150-1152). As divs com `flex gap-3` ficarão apenas com o botão "Continuar", que ocupará a largura total.

---

### Comportamento Esperado

**Antes:**
```
┌────────────────────────────────────────┐
│     Conteúdo da Etapa                  │
├────────────────────────────────────────┤
│ [ ← Voltar ]         [ Continuar → ]   │
└────────────────────────────────────────┘
```

**Depois:**
```
┌────────────────────────────────────────┐
│     Conteúdo da Etapa                  │
├────────────────────────────────────────┤
│                [ Continuar → ]         │
└────────────────────────────────────────┘
```

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/cotacao-publica/NavegacaoEtapas.tsx` | Adicionar prop `mostrarVoltar` (com padrão `false`) e condicionar a renderização do botão |
| `src/pages/public/CotacaoPublicaCompleta.tsx` | Remover os 5 botões "Voltar" (ChevronLeft + "Voltar") |

---

### Impacto

- ✅ Usuários da área pública não verão o botão "Voltar"
- ✅ A navegação fica mais linear e direciona o fluxo para frente
- ✅ Mantém a flexibilidade para reativar em futuras necessidades (via prop)
- ✅ O componente `NavegacaoEtapas` continuará sendo usado normalmente em outras páginas

---

### Estimativa

| Tarefa | Tempo |
|--------|-------|
| Atualizar `NavegacaoEtapas.tsx` | 1 min |
| Remover botões em `CotacaoPublicaCompleta.tsx` | 2 min |
| Ajustar layout dos botões (se necessário) | 1 min |
| Testar fluxo público | 3 min |
| **Total** | **~7 min** |

