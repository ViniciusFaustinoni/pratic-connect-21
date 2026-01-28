
# Plano: Atualização da Tela de Agendamento Pós-Autovistoria

## Problema

O componente `AgendamentoVistoria.tsx` exibe textos que mencionam "vistoria" e "vistoriador" no contexto `pos-autovistoria`, quando na verdade a autovistoria já foi concluída. Neste ponto, o cliente está agendando a **instalação física do rastreador**.

## Arquivo a Modificar

`src/components/cotacao-publica/AgendamentoVistoria.tsx`

## Alterações Detalhadas

### 1. Título da Tela (linhas 218-220)

| Contexto | Texto Atual | Novo Texto |
|----------|-------------|------------|
| `pos-autovistoria` | "Agendar Vistoria Completa" | **"Agendar Instalação"** |
| `presencial-direto` | "Agendar Vistoria Presencial" | Mantém (sem alteração) |

```typescript
const titulo = contexto === 'presencial-direto' 
  ? 'Agendar Vistoria Presencial'
  : 'Agendar Instalação';
```

### 2. Subtítulo da Tela (linhas 222-224)

| Contexto | Texto Atual | Novo Texto |
|----------|-------------|------------|
| `pos-autovistoria` | "Agende a visita para ativar todas as coberturas do seu plano" | **"Escolha data e horário para o técnico instalar o rastreador"** |
| `presencial-direto` | "Escolha data e horário para o vistoriador ir até você" | Mantém (sem alteração) |

```typescript
const subtitulo = contexto === 'presencial-direto'
  ? 'Escolha data e horário para o vistoriador ir até você'
  : 'Escolha data e horário para o técnico instalar o rastreador';
```

### 3. Rótulo do Endereço (linhas 340-343)

| Texto Atual | Novo Texto |
|-------------|------------|
| "Endereço para a vistoria" | **"Endereço para a instalação"** |

```tsx
<Label className="flex items-center gap-2">
  <MapPin className="h-4 w-4" />
  Endereço para a instalação
</Label>
```

### 4. Identificação do Responsável (linhas 443-446)

| Texto Atual | Novo Texto |
|-------------|------------|
| "Quem vai receber o vistoriador?" | **"Quem receberá o técnico/instalador?"** |

```tsx
<Label className="flex items-center gap-2">
  <User className="h-4 w-4" />
  Quem receberá o técnico/instalador?
</Label>
```

## Resumo das Mudanças

| Linha | Campo | Texto Atual | Novo Texto |
|-------|-------|-------------|------------|
| 220 | Título | "Agendar Vistoria Completa" | "Agendar Instalação" |
| 224 | Subtítulo | "Agende a visita para ativar..." | "Escolha data e horário para o técnico instalar o rastreador" |
| 342 | Label Endereço | "Endereço para a vistoria" | "Endereço para a instalação" |
| 445 | Label Responsável | "Quem vai receber o vistoriador?" | "Quem receberá o técnico/instalador?" |

## Resultado Esperado

Após as alterações, a tela de agendamento no contexto pós-autovistoria exibirá mensagens claras indicando que:

1. A próxima etapa é a **instalação do rastreador** (não uma nova vistoria)
2. Um **técnico/instalador** fará a visita (não um vistoriador)
3. O endereço solicitado é para a **instalação** (não para vistoria)

Isso elimina a confusão do cliente, deixando claro que a vistoria já foi concluída via autovistoria e que agora resta apenas a instalação física do equipamento.
