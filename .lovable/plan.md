
# Plano: Correção do Fluxo de Agendamento de Manutenção

## Diagnóstico do Problema

### Situação Atual (incorreta)

Existem **dois modais de agendamento** sendo usados em lugares diferentes:

| Local | Modal Usado | Ação |
|-------|-------------|------|
| Menu **Estoque** | `EnviarManutencaoModal` | "Agendar Manutenção" para rastreadores em estoque e instalados |
| Menu **Rastreadores** | `EnviarManutencaoModal` | "Enviar para Manutenção" para rastreadores em estoque e instalados |
| Menu **Vistorias de Manutenção** | `AgendarManutencaoModal` | Agendar manutenção já aberta (correto) |

### Situação Desejada

- O agendamento de manutenção deve existir **exclusivamente** no menu **Rastreadores**
- Apenas rastreadores com status **instalado** podem ter manutenção agendada
- O modal deve seguir o layout da foto (com Local, Técnico, Encaixe)
- Menus **Estoque** e **Vistorias** NÃO devem exibir modais de agendamento

---

## Solução

### 1. Remover opção "Agendar Manutenção" do menu Estoque

**Arquivo:** `src/components/monitoramento/estoque/ListaRastreadores.tsx`

Remover o bloco que exibe "Agendar Manutenção" no dropdown (linhas 455-471) e remover o modal `EnviarManutencaoModal` do componente.

### 2. Ajustar menu Rastreadores para usar o modal correto

**Arquivo:** `src/pages/monitoramento/Rastreadores.tsx`

- Remover a opção "Enviar para Manutenção" para rastreadores em `estoque` (manter apenas para `instalado`)
- Substituir `EnviarManutencaoModal` pelo `AbrirManutencaoModal` que:
  - Seleciona o motivo da manutenção
  - Cria o serviço como pendente
  - O agendamento de data/técnico acontece na tela VistoriasManutencao

### 3. Manter o fluxo em duas etapas (padrão atual do sistema)

O sistema já possui o fluxo correto em duas etapas:
1. **Abrir Manutenção** → Cria serviço com status `pendente` (sem data)
2. **Agendar** → Coordenador atribui data, período e técnico

Este fluxo está implementado em `VistoriasManutencao.tsx` e deve ser mantido.

### 4. Alternativa: Modal único no menu Rastreadores (conforme imagem)

Se o desejo é ter um modal único que já abre E agenda no menu Rastreadores:

**Criar novo modal** `AbrirEAgendarManutencaoModal` que:
- Mostra informações do rastreador/veículo/associado
- Pede data, período, local (Base/Rota), técnico responsável
- Opções de encaixe e notificação WhatsApp
- Ao confirmar, cria o serviço já agendado

Este modal seria uma combinação dos modais `AbrirManutencaoModal` + `AgendarManutencaoModal`.

---

## Alterações Detalhadas

### Arquivo 1: `src/components/monitoramento/estoque/ListaRastreadores.tsx`

**Remover:**
- Linhas 455-471: Bloco do dropdown que exibe "Agendar Manutenção"
- Linhas 554-559: Modal `EnviarManutencaoModal`
- Estado `dialogManutencao` e sua tipagem
- Import do `EnviarManutencaoModal`

### Arquivo 2: `src/pages/monitoramento/Rastreadores.tsx`

**Modificar:**
- Linhas 538-555: Remover condição `status === 'estoque'` para opção "Enviar para Manutenção"
- Manter opção apenas para `status === 'instalado'`
- Substituir `EnviarManutencaoModal` por `AbrirManutencaoModal`
- Ajustar imports e estados

**Antes:**
```typescript
{(rastreador.status === 'instalado' || rastreador.status === 'estoque') && (
  // ...
  <DropdownMenuItem onClick={() => setDialogManutencao({...})}>
    <Wrench className="mr-2 h-4 w-4" />
    Enviar para Manutenção
  </DropdownMenuItem>
```

**Depois:**
```typescript
{rastreador.status === 'instalado' && (
  // ...
  <DropdownMenuItem onClick={() => setModalAbrirManutencao({
    id: rastreador.id,
    codigo: rastreador.codigo,
  })}>
    <Wrench className="mr-2 h-4 w-4" />
    Abrir Manutenção
  </DropdownMenuItem>
```

### Arquivo 3: `src/components/monitoramento/manutencao/AbrirManutencaoModal.tsx`

**Nenhuma alteração** - Modal já funciona corretamente e pode receber `rastreadorPreSelecionado`.

---

## Fluxo Final Proposto

```text
┌─────────────────────────────────────────────────────────────────┐
│  MENU RASTREADORES                                              │
│  (Lista de rastreadores instalados)                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Usuário clica "Abrir Manutenção"
                             │ em rastreador INSTALADO
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  MODAL "ABRIR MANUTENÇÃO"                                       │
│  - Mostra dados do rastreador/veículo/associado                 │
│  - Usuário seleciona MOTIVO                                     │
│  - Ao confirmar: cria serviço com status "pendente"             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Serviço aparece em 
                             │ VistoriasManutencao
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  MENU VISTORIAS DE MANUTENÇÃO                                   │
│  (Lista de manutenções pendentes)                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Coordenador clica "Agendar"
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  MODAL "AGENDAR MANUTENÇÃO" (conforme foto)                     │
│  - Data, Período                                                │
│  - Local (Base/Rota)                                            │
│  - Técnico Responsável                                          │
│  - Opção de encaixe                                             │
│  - Notificar via WhatsApp                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Resumo das Alterações

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/monitoramento/estoque/ListaRastreadores.tsx` | Remover | Opção "Agendar Manutenção" e modal associado |
| `src/pages/monitoramento/Rastreadores.tsx` | Modificar | Ajustar para usar `AbrirManutencaoModal` apenas para rastreadores instalados |
| Nenhum arquivo novo | - | O sistema já possui os modais corretos |

---

## Resultado Esperado

1. Menu **Estoque**: Sem opção de agendamento de manutenção
2. Menu **Rastreadores**: Opção "Abrir Manutenção" apenas para rastreadores **instalados**
3. Menu **Vistorias de Manutenção**: Onde o coordenador agenda data/técnico (já funciona)
4. Fluxo único e consistente em todo o sistema
