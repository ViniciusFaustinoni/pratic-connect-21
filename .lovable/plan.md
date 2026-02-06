
# Plano: Adicionar Botão de Contato WhatsApp na Tarefa Atual do Vistoriador

## Contexto

Atualmente, o `TarefaAtualCard` exibe as informações do cliente e possui apenas um botão para **ligar** (telefone). O vistoriador precisa também de um **botão para contatar via WhatsApp** para confirmar detalhes com o associado de forma mais prática.

## Dados Disponíveis

O hook `useTarefaAtual` já retorna:
```typescript
cliente: {
  id: tarefa.associado_id,
  nome: tarefa.associado_nome,
  telefone: tarefa.associado_telefone,
  whatsapp: tarefa.associado_whatsapp,  // ✅ Já disponível!
}
```

## Solução Proposta

### Modificar `src/components/vistoriador/TarefaAtualCard.tsx`

#### 1. Adicionar função para abrir WhatsApp

```typescript
const abrirWhatsApp = () => {
  const numero = tarefa.cliente.whatsapp || tarefa.cliente.telefone;
  if (numero) {
    const numeroLimpo = numero.replace(/\D/g, '');
    const mensagem = encodeURIComponent(
      `Olá ${tarefa.cliente.nome?.split(' ')[0] || ''}, sou o técnico da PRATIC. ` +
      `Estou entrando em contato para confirmar os detalhes do serviço agendado. Podemos conversar?`
    );
    window.open(`https://wa.me/55${numeroLimpo}?text=${mensagem}`, '_blank');
  }
};
```

#### 2. Adicionar botão de WhatsApp ao lado do botão de telefone

Na seção do cliente (linha 217-233), adicionar um segundo botão:

**Antes:**
```text
┌───────────────────────────────────────────┐
│ 👤 Cliente                         [📞]   │
│    Nome do Cliente                        │
│    (21) 99999-9999                        │
└───────────────────────────────────────────┘
```

**Depois:**
```text
┌───────────────────────────────────────────┐
│ 👤 Cliente                   [💬] [📞]   │
│    Nome do Cliente                        │
│    (21) 99999-9999                        │
└───────────────────────────────────────────┘
```

Código da modificação:

```typescript
// Seção Cliente (linhas 217-233)
<div className="flex items-start gap-3">
  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
    <User className="h-5 w-5 text-primary" />
  </div>
  <div className="flex-1 min-w-0">
    <p className="font-medium text-foreground truncate">{tarefa.cliente.nome}</p>
    <p className="text-sm text-muted-foreground">{tarefa.cliente.telefone}</p>
  </div>
  
  {/* NOVO: Botão WhatsApp */}
  <Button
    variant="outline"
    size="icon"
    onClick={abrirWhatsApp}
    disabled={!tarefa.cliente.whatsapp && !tarefa.cliente.telefone}
    className="text-green-600 hover:text-green-700 hover:bg-green-50"
  >
    <MessageCircle className="h-4 w-4" />
  </Button>
  
  {/* Botão Ligar (existente) */}
  <Button
    variant="outline"
    size="icon"
    onClick={ligarCliente}
    disabled={!tarefa.cliente.telefone}
  >
    <Phone className="h-4 w-4" />
  </Button>
</div>
```

#### 3. Atualizar tipagem do cliente

Adicionar o campo `whatsapp` à interface:

```typescript
interface TarefaAtualCardProps {
  tarefa: TarefaAtual & {
    confirmacao_whatsapp?: string | null;
    confirmado_via_whatsapp_em?: string | null;
    permite_encaixe?: boolean;
    cliente: {
      id: string;
      nome: string;
      telefone: string;
      whatsapp?: string | null;  // Garantir que está tipado
    };
  };
}
```

## Arquivo a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/vistoriador/TarefaAtualCard.tsx` | Adicionar botão WhatsApp e função `abrirWhatsApp` |

## Comportamento Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Cliente com WhatsApp | Só podia ligar | Pode enviar WhatsApp com mensagem pré-formatada |
| Cliente sem WhatsApp | Só podia ligar | Usa telefone como fallback para WhatsApp |
| Sem telefone/WhatsApp | Botão desabilitado | Botão desabilitado |

## Mensagem Pré-Formatada

Quando o vistoriador clicar no botão de WhatsApp, o aplicativo abrirá com a mensagem:

> "Olá [Nome], sou o técnico da PRATIC. Estou entrando em contato para confirmar os detalhes do serviço agendado. Podemos conversar?"

## Testes Recomendados

1. Acessar como vistoriador com uma tarefa atribuída
2. Verificar se o botão de WhatsApp aparece ao lado do botão de telefone
3. Clicar no botão e verificar se abre o WhatsApp com a mensagem pré-formatada
4. Testar com cliente que tem apenas telefone (fallback)
