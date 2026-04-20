
## Bloqueio de datas pelo Coordenador de Monitoramento

Permitir que o Coordenador de Monitoramento (e Diretor/Admin Master) bloqueie dias inteiros no calendário. Em datas bloqueadas nenhum novo agendamento é aceito — nem pelo associado no fluxo público, nem por atribuição manual da equipe. Agendamentos **pré-existentes** na data não são afetados (o coordenador decide manualmente o que fazer com eles, normalmente reagendar).

### 1. Banco — nova tabela `datas_bloqueadas`

Migração SQL criando:

```sql
CREATE TABLE public.datas_bloqueadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  motivo text NOT NULL,
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.datas_bloqueadas ENABLE ROW LEVEL SECURITY;

-- Leitura: todos autenticados + anon (fluxo público precisa consultar)
CREATE POLICY "Public read datas bloqueadas"
  ON public.datas_bloqueadas FOR SELECT TO anon, authenticated USING (true);

-- Escrita: apenas coordenador, diretor, admin_master, desenvolvedor
CREATE POLICY "Coord manage datas bloqueadas"
  ON public.datas_bloqueadas FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
    OR has_role(auth.uid(), 'admin_master'::app_role)
    OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  )
  WITH CHECK (...mesmas roles);

-- Função helper usada por UI e edge functions
CREATE OR REPLACE FUNCTION public.data_esta_bloqueada(_data date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.datas_bloqueadas WHERE data = _data);
$$;
```

Trigger `BEFORE INSERT OR UPDATE` em `servicos`, `vistorias` e `agendamentos_base` para rejeitar gravações novas onde `data_agendada` coincide com linha em `datas_bloqueadas` (barreira server-side que vale para qualquer caminho, inclusive edge functions e mutations diretas):

```sql
CREATE OR REPLACE FUNCTION public.bloquear_agendamento_em_data_bloqueada()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.data_agendada IS DISTINCT FROM OLD.data_agendada THEN
    IF NEW.data_agendada IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.datas_bloqueadas WHERE data = NEW.data_agendada::date) THEN
      RAISE EXCEPTION 'DATA_BLOQUEADA: A data % está bloqueada para novos agendamentos.', NEW.data_agendada
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_bloqueio_servicos BEFORE INSERT OR UPDATE ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_agendamento_em_data_bloqueada();
-- mesmo em vistorias e agendamentos_base
```

### 2. Hook compartilhado `useDatasBloqueadas`

Novo arquivo `src/hooks/useDatasBloqueadas.ts`:

- `useDatasBloqueadas()` — lista todas as datas bloqueadas (ordenadas).
- `useIsDataBloqueada(date)` — boolean rápido para validar uma data específica.
- `useBloquearData()` / `useDesbloquearData()` — mutations com toast e invalidação de queries (`vagas-periodo`, `instalacoes-calendario`, etc.).
- Usa `publicSupabase` na versão que precisa rodar no fluxo anon, `supabase` na versão autenticada.

### 3. UI — botão no Calendário de Serviços

Em `src/pages/monitoramento/CalendarioInstalacoes.tsx`:

- Cada célula do dia ganha um pequeno botão "🔒" no canto, visível apenas para roles autorizados (`useHasAnyRole(['coordenador_monitoramento', 'diretor', 'admin_master', 'desenvolvedor'])`).
- Clique abre um `AlertDialog` com:
  - Campo obrigatório **Motivo** (textarea).
  - Aviso: "Novos agendamentos serão recusados. Agendamentos existentes nessa data não serão cancelados automaticamente — reagende manualmente se necessário."
  - Botão **Bloquear data** / **Desbloquear data**.
- Dias bloqueados ficam com fundo `bg-red-50 dark:bg-red-950/30`, faixa diagonal sutil e badge "Bloqueado — {motivo}".
- Modal `CalendarioDiaModal` ganha um alerta vermelho no topo quando o dia está bloqueado, e o botão "Agendar nova instalação" fica desabilitado.

### 4. Propagação do bloqueio nos fluxos de agendamento

Todos os componentes que possuem `disabled={isDateDisabled}` passam a consultar `useDatasBloqueadas()` e somam a regra:

- `src/components/associado/AgendarVistoria.tsx`
- `src/components/associado/AgendamentoInstalacaoContrato.tsx`
- `src/components/cotacao-publica/AgendamentoVistoria.tsx`
- `src/components/cotacao-publica/AgendamentoBase.tsx`
- `src/components/evento/EventoAgendamento.tsx`
- `src/components/monitoramento/manutencao/AgendarManutencaoModal.tsx`

```ts
const { data: bloqueadas } = useDatasBloqueadas();
const setBloqueadas = useMemo(() => new Set(bloqueadas?.map(b => b.data) ?? []), [bloqueadas]);

const isDateDisabled = (date: Date) => {
  // regras atuais (passado, domingo, etc.)
  return ... || setBloqueadas.has(format(date, 'yyyy-MM-dd'));
};
```

Nas listas que geram "próximas datas disponíveis" (laços `while` que empilham datas úteis) o mesmo `Set` é usado para pular dias bloqueados.

### 5. Edge functions de atribuição/reagendamento

`supabase/functions/atribuir-proxima-tarefa/index.ts` e `cron-reagendamento-automatico/index.ts` ganham checagem via `data_esta_bloqueada(_data)` antes de insert/update, retornando erro amigável. Como o trigger do banco já protege, isso é defesa em profundidade para dar mensagem clara (`"Data bloqueada: {motivo}"` em vez de erro genérico).

### 6. Tratamento de erro no frontend

Helper `src/lib/supabaseErrors.ts` (ou local nos hooks de criação) detecta `DATA_BLOQUEADA:` no `error.message` e exibe toast destrutivo: "Esta data foi bloqueada pelo coordenador. Escolha outra data."

### Validação pós-deploy

1. Logar como `admin@teste.com` → `/monitoramento/calendario` → clicar no cadeado de `2026-04-25` → preencher motivo "Feriado regional" → confirmar. Dia fica hachurado em vermelho.
2. Abrir fluxo público `/cotacao/:token` → tentar escolher `2026-04-25` no calendário → data aparece desabilitada.
3. Abrir modal "Agendar Manutenção" como coordenador → `2026-04-25` desabilitado.
4. Tentar `INSERT` direto via SQL com `data_agendada='2026-04-25'` em `servicos` → erro `DATA_BLOQUEADA`.
5. Desbloquear a data → calendário e formulários voltam ao normal sem reload manual (invalidação de query funciona).
6. Testar mobile: botão de cadeado acessível via tap, modal responsivo.
7. Logar como `analista_cadastro` → cadeado **não aparece** no calendário; apenas visualiza o dia bloqueado.

### Arquivos tocados

- **Migração SQL** (nova) — tabela, RLS, função `data_esta_bloqueada`, trigger aplicado em `servicos`, `vistorias`, `agendamentos_base`.
- `src/hooks/useDatasBloqueadas.ts` (novo).
- `src/pages/monitoramento/CalendarioInstalacoes.tsx` — botão cadeado + destaque visual.
- `src/components/monitoramento/CalendarioDiaModal.tsx` — alerta + desabilitar ações.
- `src/components/monitoramento/BloquearDataDialog.tsx` (novo) — dialog de motivo.
- `src/components/associado/AgendarVistoria.tsx`, `AgendamentoInstalacaoContrato.tsx`
- `src/components/cotacao-publica/AgendamentoVistoria.tsx`, `AgendamentoBase.tsx`
- `src/components/evento/EventoAgendamento.tsx`
- `src/components/monitoramento/manutencao/AgendarManutencaoModal.tsx`
- `supabase/functions/atribuir-proxima-tarefa/index.ts`
- `supabase/functions/cron-reagendamento-automatico/index.ts`

Sem mudança em schema de `servicos`/`vistorias`, sem quebrar fluxos existentes.
