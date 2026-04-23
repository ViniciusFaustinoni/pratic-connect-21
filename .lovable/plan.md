

## Corrigir mensagem de aprovação que menciona "Roubo/Furto" em planos sem essa cobertura

### Diagnóstico

A imagem mostra **dois toasts sobrepostos** após o cadastro aprovar a proposta:

1. ✅ **Toast correto** (vem do hook `useAprovarProposta`, `usePropostasPendentes.ts` linha 1462): usa a `mensagem` retornada pelo backend `aprovar-proposta`, que já distingue corretamente entre os 4 cenários:
   - Plano sem R&F → "Plano de assistência ativado (sem cobertura de Roubo/Furto)."
   - Plano com R&F + rastreador → "Cobertura Roubo/Furto ativada. Aguardando instalação para Proteção 360º."
   - Plano com R&F sem necessidade de rastreador → "Proteção 360° ativada (sem necessidade de rastreador)."
   - Instalação já concluída → "Proteção 360º ativada."

2. ❌ **Toast hardcoded duplicado** (`src/pages/cadastro/PropostaAnalise.tsx` linhas 202-205): dispara **sempre** a mesma frase — "Após a instalação, o monitoramento dará o segundo check para liberação total da Proteção 360 e do app do associado." — mesmo quando o plano não tem R&F, ou quando o veículo não precisa de rastreador, ou quando a instalação já foi concluída. **É esse o toast errado da captura de tela.**

Além disso, há um **banner fixo** na página (`PropostaAnalise.tsx` linhas 443-456) com texto similar ("o monitoramento dará o segundo check para liberar a Proteção 360...") que também aparece para qualquer plano, inclusive os de assistência.

### O que vai mudar

**1. Remover o toast hardcoded duplicado** (`PropostaAnalise.tsx` linhas 202-205)

O hook `useAprovarProposta` já dispara o toast com a mensagem correta vinda do backend. Deletar o `toast.success(...)` redundante da página. Apenas a navegação (`if (nextProposta) navigate(...)`) permanece.

**2. Tornar o banner "Análise documental disponível" condicional ao plano** (`PropostaAnalise.tsx` linhas 443-456)

O banner aparece quando `aguardandoExecucao && !aprovarApenasDocumentos`. Vou:
- Buscar do contrato/plano a flag `planoTemRouboFurto` (mesma heurística do backend: regex `/roubo|furto/i` sobre nomes das coberturas via `plano_coberturas` → `coberturas.nome`).
- Trocar o texto fixo por uma das duas variantes:
  - **Plano com R&F**: mantém o texto atual ("...A aprovação final será liberada após a execução da vistoria/instalação agendada. Em seguida, o monitoramento dará o segundo check para liberar a Proteção 360 e o app do associado.").
  - **Plano só de assistência (sem R&F)**: troca para "...A aprovação final será liberada após a execução da vistoria. Não há instalação de rastreador nem segundo check de monitoramento neste plano de assistência."

**3. Sem mudanças no backend**

A edge function `aprovar-proposta` já está correta. Nenhuma migration necessária.

### Arquivos editados

- `src/pages/cadastro/PropostaAnalise.tsx`:
  - Remover `toast.success(...)` hardcoded em `handleConfirmarAprovacao` (linhas 202-205).
  - Adicionar derivação `planoTemRouboFurto` a partir de `proposta?.plano?.coberturas` (ou fetch direto se não vier embutido).
  - Tornar o conteúdo do banner "Análise documental disponível" (linhas 449-452) condicional a essa flag.

### O que NÃO muda

- Lógica do backend `aprovar-proposta` (já distingue corretamente os 4 cenários).
- Toast emitido pelo hook `useAprovarProposta` (já usa `data.mensagem` do backend).
- Navegação após aprovação (próxima proposta ou volta para lista).
- Permissões, status de contrato, geração de instalação.

### Riscos

- Se `proposta?.plano` não trouxer `coberturas` no shape esperado, o banner pode cair no caso default (sem R&F) erroneamente. Mitigação: fazer fetch leve de `plano_coberturas` quando a info não estiver disponível, ou usar fallback conservador (mostrar mensagem genérica neutra).

