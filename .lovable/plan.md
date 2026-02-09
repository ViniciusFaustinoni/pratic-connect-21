

# Corrigir Problemas da Tela de Retirada no Mobile

## Problemas Identificados

### Problema 1: "Serviço indisponível" no mobile
A tela que aparece **nao e** "servico indisponivel" -- e a tela de **"Localizacao Desativada"** (`TelaLocalizacaoBloqueada`). No `InstaladorLayout`, a condicao `deveBloqueiarPorLocalizacao` e:

```
geoState.status === 'denied' || geoState.status === 'unavailable'
  && tarefaAtual !== null
```

Em navegadores mobile (e no preview do Lovable), a geolocalizacao muitas vezes retorna `denied` ou `unavailable`, bloqueando toda a interface mesmo quando o profissional so precisa ver dados do servico. A tela de execucao de retirada fica inacessivel.

**Solucao:** Permitir acesso a paginas de execucao (`/instalador/retirada/*`, `/instalador/vistoria/*`, `/instalador/manutencao/*`) mesmo sem geolocalizacao. A localizacao e necessaria para **iniciar servico** e **rastreamento**, nao para visualizar/executar o checklist.

### Problema 2: Bottom nav sobrepoe conteudo (screenshot)
A `ExecutarRetirada.tsx` usa `pb-32` na raiz, mas a `InstaladorLayout` ja adiciona `pb-16` via `main`. O resultado e que o bottom nav ainda sobrepoe o botao "Concluir Retirada" e mensagens de validacao, porque o `pb-32` e insuficiente quando a nav tem `safe-area-inset-bottom`.

**Solucao:** Aumentar o padding inferior e usar `pb-safe` para garantir compatibilidade com dispositivos com barra inferior (notch).

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/instalador/InstaladorLayout.tsx` | Nao bloquear localizacao em rotas de execucao |
| `src/pages/instalador/ExecutarRetirada.tsx` | Ajustar padding inferior + corrigir navegacao "Voltar" |

---

## Detalhamento

### 1. InstaladorLayout.tsx

Na linha 55, modificar a condicao de bloqueio para excluir paginas de execucao:

```typescript
// Rotas de execucao nao devem ser bloqueadas por localizacao
const isRotaExecucao = location.pathname.match(
  /\/instalador\/(retirada|vistoria|manutencao|instalacao)\//
);

const deveBloqueiarPorLocalizacao = 
  !isVistoriadorBase &&
  !isRotaExecucao &&  // <-- NOVO: nao bloquear execucao
  (geoState.status === 'denied' || geoState.status === 'unavailable') &&
  tarefaAtual !== null;
```

### 2. ExecutarRetirada.tsx

- Trocar `pb-32` por `pb-40` para dar mais espaco ao bottom nav + safe area
- Corrigir navegacao de "Voltar" de `/vistoriador/tarefas` para `/instalador/tarefas` (3 ocorrencias nas linhas 246, 374, 780)

