
# Plano: Correção do Bug de Navegação entre Etapas no Link do Cliente

## Problema Identificado

Quando o cliente volta para uma etapa anterior para revisar, o sistema "trava" e ele não consegue mais avançar. Isso acontece por um conflito na lógica de navegação.

## Causa Raiz

O problema está na interação entre os botões "Continuar" de cada componente de etapa e o componente `NavegacaoEtapas`:

### Problema 1: Botão "Continuar" de cada etapa é desativado quando `readOnly=true`

Quando o cliente volta para a etapa 0 (Plano), o sistema corretamente marca `readOnly={isEtapaConcluida(0)}` como `true`. Porém, o botão "Continuar com este plano" fica desativado porque a etapa já foi concluída:

```tsx
// EscolhaPlano.tsx - botão desativado se readOnly
<Button
  onClick={onConfirmar}
  disabled={!planoSelecionadoId || isLoading}  // não considera readOnly
  // ...
```

### Problema 2: Botão "Continuar" do NavegacaoEtapas não aparece

O `NavegacaoEtapas` só mostra o botão "Continuar" quando `podeAvancar = etapaAtual < etapaMaxima`. No entanto, quando a etapa já está concluída, o botão deveria aparecer para permitir a navegação.

A linha 29 do `NavegacaoEtapas` oculta o componente inteiro:
```tsx
if (!navegacaoManual && etapaAtual >= etapaMaxima) return null;
```

Mas quando `navegacaoManual=true` e `etapaAtual < etapaMaxima`, o botão deveria aparecer. O problema é que `podeAvancar` verifica `etapaAtual < etapaMaxima`, mas isso pode falhar em certos estados.

### Problema 3: Conflito entre botões

Existem dois botões que podem avançar:
1. O botão específico da etapa (ex: "Continuar com este plano")
2. O botão genérico de navegação

Quando em modo `readOnly`, o botão específico é desativado, mas o genérico também não aparece corretamente.

## Solução Proposta

### 1. Modificar `NavegacaoEtapas` para sempre mostrar navegação em modo manual

Quando `navegacaoManual=true`, os botões de navegação devem sempre estar visíveis, permitindo que o usuário avance para qualquer etapa já concluída.

**Mudança**: Garantir que o botão "Continuar" apareça quando estamos em navegação manual e ainda não chegamos na etapa máxima.

### 2. Adicionar botão "Continuar" específico para modo readOnly nos componentes

Nos componentes de etapa (`EscolhaPlano`, `EtapaDadosPessoaisDocumentos`, etc.), quando `readOnly=true`, não mostrar o botão de ação primária (que executa a ação), mas garantir que o `NavegacaoEtapas` cuide da navegação.

### 3. Simplificar a lógica de visibilidade do NavegacaoEtapas

```tsx
// NavegacaoEtapas.tsx - Nova lógica simplificada
export function NavegacaoEtapas({...}: NavegacaoEtapasProps) {
  const podeVoltar = etapaAtual > 0;
  const podeAvancar = navegacaoManual && etapaAtual < etapaMaxima;
  
  // Sempre mostrar se pode voltar OU se está em navegação manual e pode avançar
  if (!podeVoltar && !podeAvancar) return null;
  
  return (
    // Mostrar botões de navegação...
  );
}
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/cotacao-publica/NavegacaoEtapas.tsx` | Corrigir lógica de visibilidade para navegação manual |
| `src/components/cotacao-publica/EscolhaPlano.tsx` | Ocultar botão "Continuar" quando `readOnly=true` |
| `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` | Ocultar botão "Continuar" quando `readOnly=true` |
| `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx` | Verificar comportamento em modo `readOnly` |
| `src/components/cotacao-publica/EtapaVistoria.tsx` | Verificar comportamento em modo `readOnly` |
| `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx` | Verificar comportamento em modo `readOnly` |

## Fluxo Corrigido

```
1. Cliente completa etapas 1, 2, 3, 4
           ↓
2. Cliente clica na etapa 1 para revisar
           ↓
3. navegacaoManual = true, etapaAtual = 0, etapaMaxima = 4
           ↓
4. EscolhaPlano mostra em modo readOnly (sem botão "Continuar com este plano")
           ↓
5. NavegacaoEtapas mostra:
   [Voltar] (desativado - etapa 0)  |  [Continuar] (ativo - vai para etapa 1)
           ↓
6. Cliente clica "Continuar" e vai para etapa 1
           ↓
7. Pode continuar navegando até chegar na etapa máxima (4)
```

## Alterações Detalhadas

### NavegacaoEtapas.tsx
```tsx
export function NavegacaoEtapas({
  etapaAtual,
  etapaMaxima,
  totalEtapas,
  onVoltar,
  onAvancar,
  navegacaoManual = false,
}: NavegacaoEtapasProps) {
  const podeVoltar = etapaAtual > 0;
  // CORREÇÃO: Em modo manual, permitir avançar até a etapa máxima
  const podeAvancar = navegacaoManual && etapaAtual < etapaMaxima;
  
  // Só oculta se não pode fazer nenhuma ação
  if (!podeVoltar && !podeAvancar) return null;
  
  return (
    <motion.div className="flex justify-between items-center pt-6 mt-6 border-t border-border/30" ...>
      {podeVoltar ? (
        <Button variant="ghost" onClick={onVoltar}>
          <ChevronLeft /> Voltar
        </Button>
      ) : <div />}
      
      {podeAvancar && (
        <Button onClick={onAvancar}>
          Continuar <ChevronRight />
        </Button>
      )}
    </motion.div>
  );
}
```

### EscolhaPlano.tsx
```tsx
// Ocultar botão quando em modo somente leitura
{!readOnly && (
  <Button onClick={onConfirmar} disabled={!planoSelecionadoId || isLoading}>
    Continuar com este plano
  </Button>
)}
```

### EtapaDadosPessoaisDocumentos.tsx
```tsx
// Ocultar botão quando em modo somente leitura
{!readOnly && (
  <Button onClick={handleSubmit} disabled={!podeAvancar || isLoading}>
    Continuar
  </Button>
)}
```

## Benefícios

1. **Navegação fluida** - Cliente pode revisar qualquer etapa anterior sem travar
2. **Interface consistente** - Botões de navegação aparecem de forma previsível
3. **Modo revisão claro** - Em etapas já concluídas, apenas mostra os dados (sem ações duplicadas)
4. **Sem perda de dados** - Ao revisar, os dados permanecem salvos
