## Problema

A vistoria criada pelo fluxo de troca de titularidade (`servicos.origem = 'troca_titularidade'`, tipo `vistoria_entrada`, placa LTB4J74, agendada 12/05) aparece na aba **Serviços** e dentro de **Mapa › Atribuições (Manual)**, mas NÃO aparece na aba principal **Atribuição Manual** — mesmo marcada como encaixe.

Causa raiz: o hook `useServicosParaAtribuir` (`src/hooks/useAtribuicaoManual.ts`) filtra qualquer serviço cujo `contrato.aprovado_em` esteja nulo. O contrato do novo titular fica com `aprovado_em = null` até a etapa final (`efetivar-troca-titularidade`). Esse gate foi pensado para vendas novas e bloqueia indevidamente vistorias de troca, que têm aprovação independente (assinatura do termo de cancelamento pelo titular antigo + aprovação do Cadastro).

## Mudança proposta

Ajustar APENAS o filtro do hook `useServicosParaAtribuir` para tratar `origem = 'troca_titularidade'` como exceção ao gate de `contrato.aprovado_em`. Vistoria de troca não passa pelo fluxo de aprovação de proposta de venda.

### Detalhes técnicos

Arquivo: `src/hooks/useAtribuicaoManual.ts`

1. Adicionar `origem` na lista de colunas selecionadas em `from('servicos').select(...)` (já existem `tipo`, `status`, etc.).
2. Ajustar o filtro `servicosFiltrados`:
   ```ts
   const servicosFiltrados = (servicos || []).filter((s: any) => {
     if (s.instalacao_origem_id && instalacoesComLinkAtivo.has(s.instalacao_origem_id)) return false;
     if (!s.contrato_id) return true;
     // Vistorias de troca de titularidade têm aprovação independente
     if (s.origem === 'troca_titularidade') return true;
     return !!s.contrato?.aprovado_em;
   });
   ```

Nada mais muda — a vistoria já aparece corretamente em todas as outras telas, e o fluxo de atribuição (`useAtribuirServicoManual`) não precisa de alteração.

## Verificação

Após a mudança:
- Login como diretor → `/monitoramento/vistorias-instalacoes-mon` → aba **Atribuição Manual** deve mostrar o card `LTB4J74 · Vistoria de Entrada · 12/05 Manhã · MARCUS VINICIUS`.
- Confirmar que a fila continua escondendo serviços normais com contrato não aprovado (regressão).
