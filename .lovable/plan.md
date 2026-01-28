
# Plano: Melhoria na Navegacao entre Etapas do Fluxo de Contratacao

## Problema Identificado

Ao analisar o codigo, identifiquei que o problema ocorre devido a logica de sincronizacao automatica de etapas no arquivo `CotacaoContratacao.tsx`.

**Causa Raiz (linha 126-138):**
```typescript
useEffect(() => {
  if (cotacao?.status_contratacao) {
    let etapa = determinarEtapa(cotacao.status_contratacao);
    
    if (etapa === 3 && cotacao.tipo_vistoria) {
      etapa = 4;
    }
    
    setEtapaAtual(etapa); // <- PROBLEMA: sobrescreve navegacao manual
  }
}, [cotacao?.status_contratacao, cotacao?.tipo_vistoria, determinarEtapa, setEtapaAtual]);
```

Esse `useEffect` roda sempre que o status muda ou quando ha re-renders, forçando o usuario de volta a etapa "atual" baseada no status, mesmo quando ele esta revisando etapas anteriores.

**Problemas Secundarios:**
1. O Stepper permite clicar em etapas concluidas, mas nao ha botao "Avancar" para retornar
2. Nao existe controle de "navegacao manual" vs "navegacao automatica"

---

## Solucao Proposta

### 1. Adicionar Estado de Navegacao Manual

Criar um estado que indica quando o usuario esta navegando manualmente (revisando etapas anteriores):

```typescript
const [navegacaoManual, setNavegacaoManual] = useState(false);
```

### 2. Modificar o Stepper para Ativar Navegacao Manual

Quando o usuario clicar em uma etapa anterior:
- Ativar `navegacaoManual = true`
- Permitir navegacao para qualquer etapa ja visitada

### 3. Condicionar Sincronizacao Automatica

Modificar o `useEffect` para nao sobrescrever quando em navegacao manual:

```typescript
useEffect(() => {
  // Nao sincronizar se usuario esta navegando manualmente
  if (navegacaoManual) return;
  
  if (cotacao?.status_contratacao) {
    let etapa = determinarEtapa(cotacao.status_contratacao);
    if (etapa === 3 && cotacao.tipo_vistoria) {
      etapa = 4;
    }
    setEtapaAtual(etapa);
  }
}, [cotacao?.status_contratacao, cotacao?.tipo_vistoria, navegacaoManual, ...]);
```

### 4. Adicionar Botoes de Navegacao nos Componentes de Etapa

Adicionar botoes "Voltar" e "Avancar" em cada componente de etapa:

| Etapa | Botao Voltar | Botao Avancar |
|-------|--------------|---------------|
| 0 - Plano | Nao | Sim (se concluida) |
| 1 - Documentos | Sim | Sim (se concluida) |
| 2 - Contrato | Sim | Sim (se concluida) |
| 3 - Vistoria | Sim | Sim (se concluida) |
| 4 - Pagamento | Sim | - |

### 5. Criar Componente de Navegacao Unificado

Novo componente `NavegacaoEtapas` que aparece em todas as etapas:

```tsx
<NavegacaoEtapas
  etapaAtual={etapaAtual}
  etapaMaxima={etapaDoStatus}
  isEtapaConcluida={isEtapaConcluida}
  onVoltar={() => {
    setNavegacaoManual(true);
    setEtapaAtual(etapaAtual - 1);
  }}
  onAvancar={() => {
    if (etapaAtual < etapaDoStatus) {
      setEtapaAtual(etapaAtual + 1);
    } else {
      setNavegacaoManual(false); // Voltar ao fluxo normal
    }
  }}
/>
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/public/CotacaoContratacao.tsx` | Adicionar estado `navegacaoManual`, condicionar useEffect, adicionar navegacao |
| `src/components/cotacao-publica/StepperCotacao.tsx` | Permitir clique em etapas futuras ja visitadas |
| Novo: `src/components/cotacao-publica/NavegacaoEtapas.tsx` | Componente de botoes Voltar/Avancar |

---

## Implementacao Detalhada

### Mudancas em CotacaoContratacao.tsx

```typescript
// 1. Novo estado para navegacao manual
const [navegacaoManual, setNavegacaoManual] = useState(false);

// 2. Funcao para verificar se pode avancar
const podeAvancar = useCallback((etapaIndex: number): boolean => {
  return etapaIndex < etapaDoStatus || isEtapaConcluida(etapaIndex);
}, [etapaDoStatus, isEtapaConcluida]);

// 3. Handler para navegacao no Stepper
const handleStepClick = (step: number) => {
  if (isEtapaConcluida(step) || step <= etapaDoStatus) {
    setNavegacaoManual(true);
    setEtapaAtual(step);
  }
};

// 4. Handler para avancar
const handleAvancar = () => {
  if (etapaAtual < etapaDoStatus) {
    setEtapaAtual(etapaAtual + 1);
  } else {
    setNavegacaoManual(false);
  }
};

// 5. Handler para voltar
const handleVoltar = () => {
  if (etapaAtual > 0) {
    setNavegacaoManual(true);
    setEtapaAtual(etapaAtual - 1);
  }
};

// 6. Modificar useEffect para respeitar navegacao manual
useEffect(() => {
  if (navegacaoManual) return; // <-- Nova condicao
  
  if (cotacao?.status_contratacao) {
    let etapa = determinarEtapa(cotacao.status_contratacao);
    if (etapa === 3 && cotacao.tipo_vistoria) {
      etapa = 4;
    }
    setEtapaAtual(etapa);
  }
}, [cotacao?.status_contratacao, cotacao?.tipo_vistoria, navegacaoManual, ...]);
```

### Novo Componente NavegacaoEtapas.tsx

```tsx
interface NavegacaoEtapasProps {
  etapaAtual: number;
  etapaMaxima: number;
  totalEtapas: number;
  onVoltar: () => void;
  onAvancar: () => void;
  readOnly?: boolean;
}

export function NavegacaoEtapas({
  etapaAtual,
  etapaMaxima,
  totalEtapas,
  onVoltar,
  onAvancar,
  readOnly = false,
}: NavegacaoEtapasProps) {
  const podeVoltar = etapaAtual > 0;
  const podeAvancar = etapaAtual < etapaMaxima;
  
  if (!podeVoltar && !podeAvancar) return null;
  
  return (
    <div className="flex justify-between items-center pt-6 border-t border-border/30">
      {podeVoltar ? (
        <Button variant="ghost" onClick={onVoltar}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      ) : <div />}
      
      {podeAvancar && !readOnly && (
        <Button onClick={onAvancar}>
          Continuar
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      )}
    </div>
  );
}
```

---

## Fluxo de Usuario Apos Implementacao

```
1. Usuario esta na Etapa 4 (Pagamento)
   |
   v
2. Clica na Etapa 1 (Documentos) para revisar
   |
   v
3. navegacaoManual = true
   |
   v
4. Usuario ve Etapa 1 em modo readOnly
   |
   v
5. Usuario pode:
   - Clicar no Stepper em qualquer etapa <= etapaDoStatus
   - Clicar "Voltar" para etapa anterior
   - Clicar "Avancar" para proxima etapa
   |
   v
6. Ao chegar na etapa atual (4), continua fluxo normal
```

---

## Consideracoes Tecnicas

### Preservacao de Dados
- Modo `readOnly` ja esta implementado nos componentes
- Nenhuma acao de edicao e permitida em etapas concluidas
- Dados ja salvos no banco nao sao afetados pela navegacao

### Performance
- O estado `navegacaoManual` e local, nao causa re-fetch de dados
- Navegacao e instantanea sem chamadas de API

### Compatibilidade
- Mantem comportamento atual para novos usuarios
- Navegacao manual so e ativada por acao explicita do usuario
