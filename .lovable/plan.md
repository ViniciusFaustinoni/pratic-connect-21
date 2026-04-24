# Cadastro só libera para Monitoramento após aprovação

## Regra de negócio (resumo)

| Caminho do associado | O que o Cadastro precisa aprovar | Quando o associado vai para Monitoramento |
|---|---|---|
| Autovistoria (com R&F) | Documentos + Fotos/Vídeo (libera Roubo & Furto) | Só depois da aprovação |
| Vistoria agendada na base/no cliente (com R&F) | Apenas Documentos (fotos serão do técnico) | Só depois da aprovação |
| Plano sem Roubo & Furto | Apenas Documentos | Só depois da aprovação |

Em **nenhum** dos casos a `instalacao` / `servico` deve existir (e portanto aparecer em filas de atribuição, calendário, rotas) antes que `contratos.aprovado_em` seja preenchido pelo analista de Cadastro.

## Diagnóstico — o que já está correto

1. `supabase/functions/criar-instalacao-pos-pagamento/index.ts` já bloqueia: `if (dataAgendada && !cadastroAprovado) → não cria` (linha 456).
2. `supabase/functions/aprovar-proposta/index.ts` cria a `instalacao` exatamente no momento da aprovação cadastral.
3. `src/pages/cadastro/PropostaAnalise.tsx` já calcula `cadastroAvaliaFotos = planoTemRouboFurto && temFotosOuVideo`, portanto o stepper esconde a etapa "Fotos & Vistoria" quando: (a) plano sem R&F, ou (b) vistoria agendada ainda não realizada.
4. `useServicosParaAtribuir` lê de `servicos` + `agendamentos_base` — ambos só nascem após a aprovação, em condições normais.

## Diagnóstico — a brecha real (CRÍTICA)

Existe um **trigger de banco** que ignora a regra:

- `trigger_criar_instalacao_cotacao` em `cotacoes` (AFTER INSERT/UPDATE) → função `public.criar_instalacao_de_cotacao()`.
- Quando `tipo_vistoria='agendada'` AND `status_contratacao='pagamento_ok'` AND `vistoria_data_agendada IS NOT NULL`, ele faz `INSERT INTO instalacoes (... status='agendada' ...)` sem checar `contratos.aprovado_em`.
- Em seguida, `trigger_sync_instalacao_to_servicos` cria automaticamente o registro em `servicos` → o associado **aparece na fila de atribuição** do Monitoramento antes de o Cadastro aprovar.

## Mudanças

### 1. Banco (migration) — fechar a brecha do trigger

Recriar `public.criar_instalacao_de_cotacao()` adicionando o guard:

```sql
-- Não criar instalação se o cadastro ainda não aprovou o contrato
IF NOT EXISTS (
  SELECT 1 FROM contratos c
  WHERE c.cotacao_id = NEW.id AND c.aprovado_em IS NOT NULL
) THEN
  RETURN NEW;
END IF;
```

Mantém o resto da função (assinatura, search_path, security definer) inalterado.

Efeito: `criar-instalacao-pos-pagamento` (edge) e o trigger DB passam a ter o **mesmo** comportamento — instalação só nasce após aprovação cadastral, independente do caminho (webhook Asaas, cron de reconciliação, ou UPDATE direto na cotação).

### 2. Edge `aprovar-proposta` — reuso do mesmo caminho

Hoje `aprovar-proposta/index.ts` insere `instalacoes` direto. Substituir esse bloco por uma chamada a `criar-instalacao-pos-pagamento` (passando `cotacaoId` e `skipPaymentCheck:true`), aproveitando o guard, geocodificação e cálculo de `tipo_deslocamento` já existentes lá. Garante uma única fonte de verdade para "como nasce uma instalação".

### 3. Reconciliação de dados existentes

Adicionar à mesma migration uma limpeza única para o estado atual:

```sql
-- Cancelar/limpar instalações órfãs criadas pelo trigger antes da regra
UPDATE instalacoes i
SET status = 'cancelada',
    observacoes = COALESCE(observacoes,'') || ' | Cancelada: criada antes da aprovação do Cadastro'
WHERE status = 'agendada'
  AND EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.id = i.contrato_id AND c.aprovado_em IS NULL
  )
  AND i.instalador_responsavel_id IS NULL
  AND i.rota_id IS NULL;
```

Os `servicos` correspondentes serão atualizados pelo trigger `trigger_sync_servicos_to_instalacao` (já existente) e não aparecerão mais em filas (`status in ('pendente','agendada')` deixa de bater).

### 4. Tela do Cadastro — reforço visual (já 90% pronto)

Em `src/pages/cadastro/PropostaAnalise.tsx` e `src/components/cadastro/proposta/PropostaApprovalStepper.tsx`:

- Já existe `cadastroAvaliaFotos`. Confirmar que para o cenário **"sem autovistoria + sem R&F"** (raro mas possível) ele realmente cai em só-documentos — está correto pelo cálculo atual.
- Ajustar o texto do botão final para deixar explícito: quando `aprovarApenasDocumentos === true`, o CTA mostra **"Aprovar documentação e liberar para Monitoramento"** (em vez de "Aprovar e liberar cobertura"), evitando a impressão de que está liberando R&F.
- No banner verde "Plano sem cobertura de Roubo e Furto" e no banner azul "Vistoria agendada", acrescentar a frase: *"Após aprovar, o associado segue para Monitoramento atribuir a instalação."*

### 5. Verificação no Monitoramento

Em `src/hooks/useAtribuicaoManual.ts` (`useServicosParaAtribuir`), adicionar um filtro defensivo extra ao select de `servicos`: garantir que só aparecem itens cujo `contrato_id` tenha `aprovado_em IS NOT NULL`. Defesa em profundidade caso algum trigger futuro reintroduza a brecha. (Mesmo após a correção do trigger, isto evita regressões silenciosas.)

## Fora de escopo

- Não alterar a lógica de cobertura de Roubo/Furto vs Proteção 360 — a edge `aprovar-proposta` já trata isso corretamente em função do plano.
- Não mexer em `agendamentos_base` (vistorias na base): hoje só são criados manualmente pelo cliente no fluxo público e não passam pelo trigger problemático.

## Detalhes técnicos por arquivo

- `supabase/migrations/<nova>.sql` — recria `criar_instalacao_de_cotacao()` com guard de `aprovado_em`; cancela instalações órfãs.
- `supabase/functions/aprovar-proposta/index.ts` — substitui o bloco de `INSERT INTO instalacoes` por `supabase.functions.invoke('criar-instalacao-pos-pagamento', { body: { cotacaoId, skipPaymentCheck: true } })` por veículo aplicável; mantém demais responsabilidades (status do contrato/associado, SGA, R&F, histórico, documentos).
- `src/pages/cadastro/PropostaAnalise.tsx` — passa nova prop `aprovarApenasDocumentos` ao stepper; ajusta texto do CTA condicionalmente.
- `src/components/cadastro/proposta/PropostaApprovalStepper.tsx` — usa o texto contextual no botão final; mantém comportamento.
- `src/hooks/useAtribuicaoManual.ts` — filtro extra em `servicos` por contratos aprovados.

## Riscos

- O cancelamento das instalações órfãs (passo 3) é destrutivo. Limitamos a `instalador_responsavel_id IS NULL AND rota_id IS NULL` para não tocar em nada que já tenha sido manipulado pelo Monitoramento. Pode ser executado em janela de baixa atividade.
- A troca interna em `aprovar-proposta` por chamada à edge `criar-instalacao-pos-pagamento` é mais lenta (overhead HTTP), porém ganha consistência. Caso o usuário prefira, pode ser substituída por uma função SQL compartilhada — mas isso aumenta o blast radius.
