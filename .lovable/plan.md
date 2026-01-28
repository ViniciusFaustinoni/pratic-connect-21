
# Plano: Adicionar Escolha de Local (Base vs Técnico) Após Pagamento de Autovistoria

## Diagnóstico do Problema

O problema está em **`CotacaoContratacao.tsx`** (linha ~688-700):

Após o cliente realizar a **autovistoria** e **confirmar o pagamento**, o sistema exibe diretamente o componente `<AgendamentoVistoriaCompleta>`, que por sua vez usa `<AgendamentoVistoria>` com `contexto="pos-autovistoria"`.

O problema é que esse fluxo **vai direto para o formulário de agendamento de técnico no endereço do cliente**, sem dar a opção de:
- **"Quero que o técnico venha até mim"** (agendamento em casa)
- **"Quero levar meu veículo até a Base"** (agendamento na base)

Essa tela de escolha (`EscolhaLocalVistoria`) só existe no fluxo **antes do pagamento** (na etapa de vistoria presencial, dentro de `EtapaVistoria`), mas **não existe no fluxo pós-autovistoria**.

## Solução Proposta

Criar um novo componente **`AgendamentoVistoriaCompletaComEscolha`** que:
1. Primeiro exibe `EscolhaLocalVistoria` para o cliente escolher base ou técnico
2. Se escolher "técnico vem até mim" → exibe `AgendamentoVistoria` (já existente)
3. Se escolher "base" → exibe `AgendamentoBase` (já existente)

### Implementação

#### 1. Modificar `AgendamentoVistoriaCompleta.tsx`

Transformar o componente para ter estados internos que gerenciam a escolha:

```typescript
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgendamentoVistoria } from './AgendamentoVistoria';
import { EscolhaLocalVistoria } from './EscolhaLocalVistoria';
import { AgendamentoBase } from './AgendamentoBase';
import { motion, AnimatePresence } from 'framer-motion';

interface AgendamentoVistoriaCompletaProps {
  cotacaoId: string;
  tipoVistoria?: 'autovistoria' | 'agendada';
  clienteNome?: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  veiculoPlaca?: string;
  veiculoDescricao?: string;
  onConfirmar: () => void;
}

type ModoAgendamento = 'escolha' | 'cliente' | 'base';

export function AgendamentoVistoriaCompleta({ 
  cotacaoId, 
  tipoVistoria, 
  clienteNome = '',
  clienteTelefone,
  clienteEmail,
  veiculoPlaca,
  veiculoDescricao,
  onConfirmar 
}: AgendamentoVistoriaCompletaProps) {
  const [modo, setModo] = useState<ModoAgendamento>('escolha');

  return (
    <AnimatePresence mode="wait">
      {modo === 'escolha' && (
        <motion.div
          key="escolha"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <EscolhaLocalVistoria 
            onEscolher={(local) => setModo(local)}
          />
        </motion.div>
      )}

      {modo === 'cliente' && (
        <motion.div
          key="cliente"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
        >
          <Button variant="ghost" size="sm" onClick={() => setModo('escolha')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <AgendamentoVistoria
            cotacaoId={cotacaoId}
            onConfirmar={onConfirmar}
            contexto="pos-autovistoria"
            tipoVistoria={tipoVistoria}
          />
        </motion.div>
      )}

      {modo === 'base' && (
        <motion.div
          key="base"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
        >
          <AgendamentoBase
            cotacaoId={cotacaoId}
            clienteNome={clienteNome}
            clienteTelefone={clienteTelefone}
            clienteEmail={clienteEmail}
            veiculoPlaca={veiculoPlaca}
            veiculoDescricao={veiculoDescricao}
            onAgendado={onConfirmar}
            onVoltar={() => setModo('escolha')}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

#### 2. Atualizar chamada em `CotacaoContratacao.tsx` (linha ~690)

Passar as props necessárias para o `AgendamentoVistoriaCompleta`:

```diff
  <AgendamentoVistoriaCompleta
    cotacaoId={cotacao.id}
    tipoVistoria="autovistoria"
+   clienteNome={cotacao?.leads?.nome || ''}
+   clienteTelefone={cotacao?.leads?.telefone}
+   clienteEmail={cotacao?.leads?.email}
+   veiculoPlaca={cotacao?.veiculo_placa}
+   veiculoDescricao={`${cotacao?.veiculo_marca} ${cotacao?.veiculo_modelo}`}
    onConfirmar={() => {
      setAgendamentoConcluido(true);
      queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao'] });
      queryClient.invalidateQueries({ queryKey: ['instalacao-existente'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria-existente'] });
+     queryClient.invalidateQueries({ queryKey: ['agendamento-base-existente'] });
      refetch();
    }}
  />
```

## Arquivos a Modificar

1. **`src/components/cotacao-publica/AgendamentoVistoriaCompleta.tsx`** - Adicionar lógica de escolha de local
2. **`src/pages/public/CotacaoContratacao.tsx`** - Passar props adicionais para o componente

## Resultado Esperado

Após o pagamento no fluxo de autovistoria:
1. Cliente verá a tela de escolha com duas opções:
   - "Quero que o técnico venha até mim" 
   - "Quero levar meu veículo até a Base"
2. Ao escolher "técnico", exibirá o formulário de agendamento com endereço (atual)
3. Ao escolher "base", exibirá o agendamento na base com slots disponíveis

## Notas Técnicas

- O componente `EscolhaLocalVistoria` já existe e está pronto para reuso
- O componente `AgendamentoBase` já existe e funciona corretamente
- Ambos os fluxos já salvam no local correto (`servicos` com `local_vistoria = 'cliente'` ou `agendamentos_base`)
- A verificação `hasAgendamentoBase` no hook `useAgendamentoExistente` já considera ambos os cenários
