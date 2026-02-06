
# Plano: Adicionar Botão de WhatsApp nas Telas de Execução de Serviço

## Problema Identificado

As páginas de execução de serviços do vistoriador/instalador não possuem botão de WhatsApp para contato com o cliente:

| Página | WhatsApp? | Problema |
|--------|-----------|----------|
| `TarefaAtualCard.tsx` | ✅ Já tem | - |
| `ExecutarManutencao.tsx` | ✅ Já tem | - |
| `EncaixeUrgenteCard.tsx` | ✅ Já tem | - |
| `ExecutarVistoriaCompleta.tsx` | ❌ Não tem | Campo `whatsapp` não buscado + sem botão |
| `ExecutarRetirada.tsx` | ❌ Não tem | Campo `whatsapp` não buscado + sem botão |

## Solução Proposta

### 1. Atualizar queries para incluir campo `whatsapp`

**Arquivo: `src/hooks/useVistorias.ts`**

Adicionar `whatsapp` em todas as queries de associado:
- Linha 629: `associado:associados(id, nome, cpf, telefone, whatsapp)`
- Linha 647: `associado:associados(id, nome, cpf, telefone, whatsapp)`
- Linha 631: `associado:associados!vistorias_associado_id_fkey(id, nome, cpf, telefone, whatsapp)`
- Linha 649: `associado:associados!vistorias_associado_id_fkey(id, nome, cpf, telefone, whatsapp)`

**Arquivo: `src/pages/instalador/ExecutarRetirada.tsx`**

Linha 46: Adicionar `whatsapp` à query do associado:
```typescript
associado:associados(id, nome, telefone, cpf, whatsapp),
```

### 2. Adicionar botão de WhatsApp no header das páginas

**Arquivo: `src/pages/instalador/ExecutarVistoriaCompleta.tsx`**

Adicionar botões de contato no header (ao lado do nome do cliente):
- Importar `MessageCircle` e `Phone` do lucide-react
- Adicionar função `abrirWhatsApp()` 
- Adicionar função `ligarCliente()`
- Modificar o header para incluir botões de contato

Código da modificação do header (linha 266-276):
```typescript
<header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-800 px-4 py-3">
  <div className="flex items-center gap-3">
    <Button variant="ghost" size="icon" onClick={() => navigate('/vistoriador/tarefas')} className="text-slate-400">
      <ArrowLeft className="h-5 w-5" />
    </Button>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-white">Vistoria Completa</p>
      <p className="text-xs text-slate-400 truncate">{associado?.nome} | {veiculo?.placa}</p>
    </div>
    {/* NOVOS: Botões de Contato */}
    <Button
      variant="ghost"
      size="icon"
      onClick={abrirWhatsApp}
      disabled={!associado?.whatsapp && !associado?.telefone}
      className="text-green-500 hover:text-green-400 hover:bg-green-500/10"
    >
      <MessageCircle className="h-5 w-5" />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      onClick={ligarCliente}
      disabled={!associado?.telefone}
      className="text-slate-400"
    >
      <Phone className="h-5 w-5" />
    </Button>
  </div>
</header>
```

**Arquivo: `src/pages/instalador/ExecutarRetirada.tsx`**

Mesma estrutura de botões no header (linhas 221-235).

### 3. Adicionar funções de contato

Em ambas as páginas, adicionar as funções:

```typescript
const abrirWhatsApp = () => {
  const numero = associado?.whatsapp || associado?.telefone;
  if (numero) {
    const numeroLimpo = numero.replace(/\D/g, '');
    const mensagem = encodeURIComponent(
      `Olá ${associado?.nome?.split(' ')[0] || ''}, sou o técnico da PRATIC. ` +
      `Estou no local para realizar o serviço. Podemos confirmar?`
    );
    window.open(`https://wa.me/55${numeroLimpo}?text=${mensagem}`, '_blank');
  }
};

const ligarCliente = () => {
  if (associado?.telefone) {
    window.open(`tel:${associado.telefone}`, '_self');
  }
};
```

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useVistorias.ts` | Adicionar `whatsapp` nas queries de associado (4 lugares) |
| `src/pages/instalador/ExecutarVistoriaCompleta.tsx` | Importar ícones, adicionar funções e botões no header |
| `src/pages/instalador/ExecutarRetirada.tsx` | Importar ícones, adicionar funções e botões no header |

## Comportamento Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Vistoria/Retirada | Sem contato WhatsApp | Botão verde no header abre WhatsApp |
| Cliente sem WhatsApp | - | Fallback usa telefone para WhatsApp |
| Cliente sem dados | - | Botão desabilitado |

## Testes Recomendados

1. Acessar como vistoriador com uma tarefa de vistoria
2. Verificar se o botão de WhatsApp aparece no header
3. Clicar e verificar se abre o WhatsApp com mensagem pré-formatada
4. Repetir teste para tela de retirada de rastreador
