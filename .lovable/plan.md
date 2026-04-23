

## Bugs do app do instalador: tarefa fantasma após aprovação + UX confusa de "fotos faltando"

### Bug A — "Não foi possível carregar esta tarefa" / "Vistoria Finalizada" persistente como tarefa atual

**Causa raiz** (`src/hooks/useVistoriaCompleta.ts`, função `useAprovarVeiculoVistoria` linhas 27-156):

Quando o técnico aprova a vistoria, o hook atualiza `vistorias.status='aprovada'`, `veiculos.status='ativo'`, `associados.status='em_analise'`, `instalacoes.status='concluida'` — mas **não atualiza**:

1. `agendamentos_base.status` para `'realizado'` (continua como `'agendado'`/`'confirmado'`).
2. `servicos.status` para `'aprovada'` quando a tarefa veio materializada como serviço (continua em `'em_andamento'`/`'em_analise'`).

A RPC `buscar_tarefa_atual_profissional` (migration `20260416184325`) lê:

- Bloco 1 (servicos): `WHERE s.status IN ('em_rota','em_andamento','agendada','em_analise')` → o serviço aprovado segue aparecendo.
- Bloco 2 (agendamentos_base): `WHERE ab.status IN ('confirmado','em_andamento','agendado')` → o agendamento aprovado segue aparecendo.

Resultado para o técnico:
- Tela "WALLACE" (imagem 2) mostra a `vistoria_base` da KPQ8J26 já aprovada como tarefa atual.
- Ao clicar, navega para `/instalador/vistoria/{ab.id}` (a rota usa `tarefa.id`, e para `vistoria_base` esse id é o de `agendamentos_base`).
- `ExecutarVistoriaCompleta` resolve via `useVistoriaCompletaPorAgendamentoBase` → encontra a vistoria com `status='aprovada'` → cai no bloco "Vistoria Finalizada" (imagem 3). Em janelas de timing entre invalidações, pode ainda mostrar "Não foi possível carregar esta tarefa" (imagem 1) quando a leitura cai numa réplica desatualizada e nenhum dos 3 hooks resolve.

### Bug B — Mensagem "Envie todas as fotos obrigatórias e o vídeo 360°" repetida e sem indicação do que falta (imagem 4)

**Causa raiz** (`src/pages/instalador/InstaladorChecklist.tsx` linhas 2103-2118):

O handler do botão "Próximo" mostra um único toast genérico "Envie todas as fotos obrigatórias e o vídeo 360°" quando `podeAvancar()` é `false` na etapa 3. Problemas:

1. Quando o vídeo já está enviado (tela mostra ✓ verde), o toast continua dizendo "envie o vídeo 360°" — confunde.
2. Não diz **quais** fotos faltam nem quantas — o técnico precisa rolar a lista inteira procurando o que está pendente.
3. O toast aparece duplicado na imagem 4 — provável dupla invocação por re-render do React StrictMode em dev OU porque o componente está sendo desmontado/remontado e disparando de novo. Sonner não dedupa toasts idênticos por padrão.

Adicionalmente, falta um sumário no topo da etapa 3 do tipo "5/7 fotos enviadas — faltam: motor_chassi, painel_km" (existe um resumo na linha 1372-1376 mas só aparece em outra etapa, não no topo da 3).

### Correções

**Edição A1 — `src/hooks/useVistoriaCompleta.ts`, dentro de `useAprovarVeiculoVistoria.mutationFn` (após o passo 4 / antes do 5):**

Adicionar duas novas etapas:

```ts
// 4b. Marcar agendamento_base como realizado (se a vistoria veio de uma tarefa de base)
const { data: agendVinculado } = await supabase
  .from('agendamentos_base')
  .select('id')
  .eq('vistoria_id', data.vistoriaId)
  .maybeSingle();

if (agendVinculado) {
  await supabase
    .from('agendamentos_base')
    .update({ status: 'realizado', updated_at: agora })
    .eq('id', agendVinculado.id);
}

// 4c. Encerrar serviço materializado vinculado a esta vistoria
await supabase
  .from('servicos')
  .update({
    status: 'aprovada',
    concluida_em: agora,
    updated_at: agora,
  })
  .eq('vistoria_origem_id', data.vistoriaId)
  .in('status', ['em_andamento', 'em_analise', 'em_rota', 'agendada']);
```

E em `onSuccess`, invalidar também:

```ts
queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
queryClient.invalidateQueries({ queryKey: ['tarefa-atual-servico'] });
queryClient.invalidateQueries({ queryKey: ['agendamentos-base-calendario'] });
queryClient.invalidateQueries({ queryKey: ['servicos'] });
```

**Edição A2 — backfill defensivo (migration SQL):**

Para limpar tarefas-fantasma já criadas (caso da KPQ8J26 das imagens):

```sql
-- Encerrar agendamentos_base cuja vistoria já está aprovada/reprovada
UPDATE public.agendamentos_base ab
   SET status = 'realizado', updated_at = now()
  FROM public.vistorias v
 WHERE ab.vistoria_id = v.id
   AND v.status IN ('aprovada','reprovada')
   AND ab.status IN ('agendado','confirmado','em_andamento');

-- Encerrar serviços cuja vistoria de origem já está aprovada/reprovada
UPDATE public.servicos s
   SET status = CASE WHEN v.status = 'aprovada' THEN 'aprovada'::status_servico
                     ELSE 'reprovada'::status_servico END,
       concluida_em = COALESCE(s.concluida_em, now()),
       updated_at = now()
  FROM public.vistorias v
 WHERE s.vistoria_origem_id = v.id
   AND v.status IN ('aprovada','reprovada')
   AND s.status IN ('em_andamento','em_analise','em_rota','agendada');
```

**Edição A3 — `src/pages/instalador/ExecutarVistoriaCompleta.tsx` linha 421-435:**

A tela "Não foi possível carregar esta tarefa" deve ter um botão de retry explícito (já tem "Voltar para tarefas") e uma chamada manual de `refetch` antes de desistir. Adicionar:

```tsx
<Button
  variant="outline"
  onClick={() => {
    vistoriaPorServicoQuery.refetch();
    vistoriaPorInstalacaoQuery.refetch();
    vistoriaPorAgendamentoBaseQuery.refetch();
  }}
>
  Tentar novamente
</Button>
```

**Edição B1 — `src/pages/instalador/InstaladorChecklist.tsx` linhas 2104-2118:**

Substituir o toast genérico por mensagem específica do que falta:

```tsx
onClick={() => {
  if (!podeAvancar()) {
    if (etapaAtual === 2 && !checklistCompleto) {
      const faltam = checklistItems.filter(item =>
        checklist[item.id]?.status === 'pendente' || !checklist[item.id]
      ).length;
      toast.error(`Marque todos os itens do checklist (${faltam} pendente${faltam > 1 ? 's' : ''})`, { id: 'avancar-bloqueado' });
    } else if (etapaAtual === 3) {
      const fotosFaltam = totalObrigatorias - totalFotosEnviadas;
      const partes: string[] = [];
      if (fotosFaltam > 0) partes.push(`${fotosFaltam} foto${fotosFaltam > 1 ? 's' : ''}`);
      if (!video360Enviado) partes.push('vídeo 360°');
      toast.error(`Falta enviar: ${partes.join(' + ')}`, { id: 'avancar-bloqueado' });
    } else {
      toast.error('Complete todos os campos obrigatórios para avançar', { id: 'avancar-bloqueado' });
    }
    return;
  }
  avancar();
}}
```

O `id: 'avancar-bloqueado'` faz o Sonner deduplicar — elimina o toast em dobro da imagem 4.

**Edição B2 — adicionar resumo permanente no topo da etapa 3** (acima do `<VistoriaFotoSequencial>` linha 1300):

```tsx
<div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
  <div className="flex items-center justify-between text-sm">
    <span className="text-slate-300">Progresso de mídias</span>
    <span className="font-semibold text-white">
      {totalFotosEnviadas}/{totalObrigatorias} fotos · {video360Enviado ? '✓ vídeo' : '✗ vídeo'}
    </span>
  </div>
  {totalFotosEnviadas < totalObrigatorias && (
    <p className="mt-1 text-xs text-amber-400">
      Faltam: {fotosObrigatoriasConfig
        .filter(f => !fotosEnviadas.some(foto => foto.tipo === f.id))
        .slice(0, 3)
        .map(f => f.nome)
        .join(', ')}
      {fotosObrigatoriasConfig.filter(f => !fotosEnviadas.some(foto => foto.tipo === f.id)).length > 3 && '…'}
    </p>
  )}
</div>
```

### Arquivos editados

- `src/hooks/useVistoriaCompleta.ts` — `useAprovarVeiculoVistoria`: encerrar `agendamentos_base` e `servicos` vinculados; invalidar queries de tarefa atual.
- `src/pages/instalador/ExecutarVistoriaCompleta.tsx` — botão "Tentar novamente" na tela de erro.
- `src/pages/instalador/InstaladorChecklist.tsx` — toast específico com `id` (dedupe) + sumário de progresso na etapa 3.
- Nova migration SQL — backfill: agendamentos_base/servicos com vistoria já aprovada → status terminal.

### Não muda

- RPC `buscar_tarefa_atual_profissional` (a lógica de filtro está correta — o problema é que os registros nunca eram atualizados).
- Hooks de resolução de vistoria (`useVistoriaCompletaPorServico`, `useVistoriaCompletaPorAgendamentoBase`).
- Fluxo de upload de fotos/vídeo (`useUploadFotoVistoriaCompleta`, `useUploadVideo360`).
- Tela "Vistoria Finalizada" (continua sendo o destino correto se o técnico forçar a navegação para uma vistoria já encerrada).

### Riscos

- A1: caso uma vistoria seja aprovada manualmente sem ter `agendamentos_base` vinculado nem `vistoria_origem_id` em servicos, o `update` simplesmente não afeta nada — sem regressão.
- A2 (backfill): atualiza apenas registros já com vistoria em `aprovada`/`reprovada` — comportamento equivalente ao que já deveria ter ocorrido. Não toca em registros ativos.
- B1: Sonner com `id` reaproveita o mesmo container do toast em vez de criar outro. Comportamento desejado.

