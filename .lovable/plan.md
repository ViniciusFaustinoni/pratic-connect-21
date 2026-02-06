
## Plano: Remover Botão "Encerrar Turno" e Implementar Finalização Automática

### Análise Atual

O sistema já possui:
- ✅ Cálculo correto de `minutosRestantes` (jornada ajustada - tempo trabalhado)
- ✅ Mutation `encerrarTurnoMutation` pronta para encerrar o turno
- ✅ Campo `encerrado_automaticamente` na tabela `turnos_profissionais`
- ✅ Botão "Encerrar Turno" no `InstaladorPerfil.tsx` (linhas 92-102)

**O que falta:**
- Lógica para finalizar o turno **automaticamente** quando `minutosRestantes === 0`
- Remover o botão "Encerrar Turno" da tela de perfil

---

### Arquivos a Modificar

| Arquivo | Modificação | Tipo |
|---------|-------------|------|
| `src/pages/instalador/InstaladorPerfil.tsx` | Remover botão "Encerrar Turno" | REMOVE |
| `src/hooks/useJornadaTrabalho.ts` | Adicionar useEffect para finalizar turno automaticamente | ADD |

---

### Alteração 1: Remover Botão de Perfil

**Arquivo**: `src/pages/instalador/InstaladorPerfil.tsx` (linhas 92-102)

Remover:
```typescript
{/* Botão Encerrar Turno - apenas quando em serviço e sem tarefa ativa */}
{emServico && !tarefaAtual && (
  <Button 
    variant="outline" 
    className="w-full border-orange-600 text-orange-400 hover:bg-orange-900/30 hover:text-orange-300"
    onClick={handleEncerrarTurno}
  >
    <Power className="h-4 w-4 mr-2" />
    Encerrar Turno
  </Button>
)}
```

Também remover:
- Import do ícone `Power` (linha 2)
- Função `handleEncerrarTurno` (linhas 22-24)
- Hook `encerrarServico` da desestruturação (linha 14)

---

### Alteração 2: Finalização Automática de Turno

**Arquivo**: `src/hooks/useJornadaTrabalho.ts`

Adicionar um novo `useEffect` após o `useEffect` que verifica almoço automático (após linha 312):

```typescript
// Verificar se deve encerrar turno automaticamente quando jornada está completa
useEffect(() => {
  if (
    turno?.status === 'ativo' &&
    tempoReal.minutosTrabalhados > 0 &&
    minutosRestantes === 0
  ) {
    console.log('[useJornadaTrabalho] Jornada completa - encerrando turno automaticamente');
    encerrarTurnoMutation.mutate();
  }
}, [turno?.status, tempoReal.minutosTrabalhados, minutosRestantes, turno?.id]);
```

**Lógica:**
- Verifica se está em turno ativo
- Verifica se há tempo trabalhado
- Verifica se `minutosRestantes === 0` (8 horas completas + ajustes)
- Se tudo OK, chama a mutation para encerrar o turno automaticamente
- O banco registra `encerrado_automaticamente = true`

---

### Fluxo de Funcionamento

```
┌────────────────────────────────────────────────────────────────┐
│                    TURNO DO VISTORIADOR                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. Vistoriador clica "Iniciar Serviço"                       │
│     → Turno criado com status = 'ativo'                       │
│                                                                │
│  2. Trabalha 4 horas                                          │
│     → Sistema inicia almoço automaticamente                   │
│                                                                │
│  3. Retorna do almoço (pode ter atraso)                       │
│     → Atraso é registrado em minutos_atraso_almoco            │
│                                                                │
│  4. Trabalha mais 4h (+ atraso se houver)                     │
│                                                                │
│  5. minutosRestantes === 0                                    │
│     → Sistema finaliza turno AUTOMATICAMENTE                  │
│     → Não há botão para clicar!                               │
│     → Turno marcado como encerrado_automaticamente = true     │
│                                                                │
│  6. Vistoriador vê status "Turno encerrado"                   │
│     → JornadaStatusBar mostra "Turno encerrado"               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

### Sequência de Implementação

1. **Remover botão do perfil** em `InstaladorPerfil.tsx`
2. **Adicionar lógica de finalização automática** em `useJornadaTrabalho.ts`
3. **Testar fluxo completo** no simulador para verificar se encerra automaticamente

---

### Casos de Teste

| Cenário | Comportamento Esperado |
|---------|----------------------|
| Trabalha exatamente 8h | Encerra automaticamente |
| Trabalha 4h, almoço, volta, trabalha 4h | Encerra automaticamente |
| Trabalha 4h, almoço, volta 15min atrasado, trabalha 4h15min | Encerra automaticamente |
| Vistoriador sai do app durante turno | useEffect continua verificando, encerra quando retornar se completou |

---

### Impacto na Interface

**Antes:**
```
┌──────────────────────────┐
│ Perfil                   │
├──────────────────────────┤
│ [Configurações]          │
│ [Notificações]           │
│ [Ajuda e Suporte]        │
│ [Privacidade]            │
│ ────────────────         │
│ [🔴 Encerrar Turno] ← X  │  (REMOVE)
│ [🔴 Sair da Conta]       │
└──────────────────────────┘
```

**Depois:**
```
┌──────────────────────────┐
│ Perfil                   │
├──────────────────────────┤
│ [Configurações]          │
│ [Notificações]           │
│ [Ajuda e Suporte]        │
│ [Privacidade]            │
│ ────────────────         │
│ [🔴 Sair da Conta]       │  ← Único botão de ação
└──────────────────────────┘
```

