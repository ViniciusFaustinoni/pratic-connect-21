
# Plano: Adicionar Botão "Enviar para SGA" nas Ativações

## Problema Identificado

O botão "Enviar para SGA" **não aparece** no menu de ações porque:

1. O componente `AtivacaoTableRow` espera receber a prop `onEnviarSGA`
2. A página `AtivacoesList.tsx` **não está passando** essa prop
3. Também não existe um hook/função para enviar para o SGA nessa página

## Solução

Adicionar a funcionalidade completa de envio ao SGA na página de ativações.

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/vendas/AtivacoesList.tsx` | Adicionar função e props para enviar ao SGA |

## Alterações Detalhadas

### 1. Criar Função de Envio ao SGA

Adicionar uma função que chama a edge function `sga-hinova-sync`:

```typescript
const [enviandoSGAId, setEnviandoSGAId] = useState<string | null>(null);

const handleEnviarSGA = async (contratoId: string, veiculoId: string, associadoId: string) => {
  setEnviandoSGAId(contratoId);
  try {
    const { data, error } = await supabase.functions.invoke('sga-hinova-sync', {
      body: { veiculo_id: veiculoId, associado_id: associadoId }
    });
    
    if (error) throw error;
    
    if (data.success) {
      toast.success('Enviado para SGA com sucesso!');
      refetch(); // Atualizar lista
    } else {
      throw new Error(data.error || 'Erro ao enviar para SGA');
    }
  } catch (err) {
    toast.error(err.message || 'Erro ao enviar para SGA');
  } finally {
    setEnviandoSGAId(null);
  }
};
```

### 2. Passar Props para AtivacaoTableRow

Atualizar o componente para passar as props necessárias:

```typescript
<AtivacaoTableRow
  key={contrato.id}
  contrato={contrato}
  onAtivar={() => handleAtivar(contrato.id)}
  onEnviarSGA={
    contrato.veiculo?.id && contrato.associado_id
      ? () => handleEnviarSGA(contrato.id, contrato.veiculo!.id, contrato.associado_id!)
      : undefined
  }
  onExcluir={() => excluirAtivacao(contrato.id)}
  canDelete={canDeleteAtivacoes}
  isAtivando={isAtivando}
  isExcluindo={isExcluindo}
  isEnviandoSGA={enviandoSGAId === contrato.id}
/>
```

## Condições para o Botão Aparecer

O botão "Enviar para SGA" aparecerá quando:

1. O veículo **não está sincronizado** (`sincronizado_hinova = false`)
2. O contrato **tem veículo vinculado** (`veiculo.id` existe)
3. O contrato **tem associado vinculado** (`associado_id` existe)
4. O contrato **não está ativo** (já que o dropdown só aparece para não-ativos)

## Fluxo Visual

```text
┌────────────────────────────────────────────────────────────┐
│  Usuário clica no menu (...) de uma ativação pendente      │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│  Menu dropdown aparece com opções:                         │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 🚀 Ativar Contrato (se pronto)                     │    │
│  │ 📤 Enviar para SGA (se !sgaOk e tem veículo)       │ ◄──── NOVO
│  │ ────────────────────────────────────────────────── │    │
│  │ 🗑️ Excluir (se canDelete)                          │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│  Ao clicar em "Enviar para SGA":                           │
│  1. Chama edge function sga-hinova-sync                    │
│  2. Mostra loading no botão                                │
│  3. Atualiza lista ao concluir                             │
│  4. Ícone SGA fica verde na coluna Progresso               │
└────────────────────────────────────────────────────────────┘
```

## Validação

Após a implementação:

1. Acessar `/vendas/ativacoes`
2. Encontrar o contrato de MARCUS VINICIUS FAUSTINONI DE FREITAS
3. Clicar no menu (...)
4. Ver opção "Enviar para SGA"
5. Clicar e verificar se o código agora usa `codigo_conta: 2`
6. Verificar se o ícone SGA fica verde após sucesso
