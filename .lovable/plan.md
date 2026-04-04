

# Aba Histórico de Atribuições em Serviços de Campo

## Problema
Não existe registro nem visualização do histórico de atribuições (manuais ou automáticas) de serviços a profissionais.

## Solução

### 1. Migração SQL — Criar tabela `servicos_atribuicoes_log`
Tabela dedicada para registrar cada atribuição:

```sql
CREATE TABLE servicos_atribuicoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id uuid REFERENCES servicos(id) ON DELETE CASCADE NOT NULL,
  profissional_id uuid REFERENCES profiles(id) NOT NULL,
  tipo_atribuicao text NOT NULL DEFAULT 'automatica', -- 'manual' ou 'automatica'
  atribuido_por uuid REFERENCES profiles(id), -- NULL = automático, preenchido = quem atribuiu manualmente
  distancia_km numeric,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE servicos_atribuicoes_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view logs" ON servicos_atribuicoes_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert logs" ON servicos_atribuicoes_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_atribuicoes_log_created ON servicos_atribuicoes_log(created_at DESC);
CREATE INDEX idx_atribuicoes_log_servico ON servicos_atribuicoes_log(servico_id);
```

### 2. Registrar atribuições automáticas — `cron-atribuir-tarefas/index.ts`
Após atribuição bem-sucedida (~linha 714), inserir registro no log:
```typescript
await supabase.from('servicos_atribuicoes_log').insert({
  servico_id: servico.id,
  profissional_id: prof.vistoriador_id,
  tipo_atribuicao: tipoAtribuicao, // 'hoje', 'amanha', 'encaixe'
  distancia_km: servico.distancia_km,
});
```

### 3. Registrar atribuições manuais — `useAtribuicaoManual.ts`
No `useAtribuirServicoManual`, após update com sucesso, inserir log com `tipo_atribuicao: 'manual'` e `atribuido_por` = usuário logado.

### 4. Hook `useHistoricoAtribuicoes` — novo arquivo
Query na tabela `servicos_atribuicoes_log` com joins em `servicos` (tipo, associado, veículo), `profiles` (profissional) e `profiles` (atribuidor). Suporte a filtros por data, tipo de atribuição e profissional. Paginação.

### 5. Componente `HistoricoAtribuicoesTab` — novo arquivo
Tabela com colunas:
- Data/Hora
- Tipo Serviço (instalação/vistoria/retirada)
- Associado / Placa
- Profissional atribuído
- Tipo (badge: Manual / Automática / Encaixe)
- Atribuído por (nome ou "Sistema")
- Distância (km)

Filtros: período, tipo de atribuição, profissional.

### 6. `VistoriasInstalacoesMon.tsx` — Adicionar aba
Nova tab "Histórico" com ícone `History`, carregando `HistoricoAtribuicoesTab` via lazy import.

## Arquivos
| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabela `servicos_atribuicoes_log` |
| `supabase/functions/cron-atribuir-tarefas/index.ts` | Inserir log após atribuição |
| `src/hooks/useAtribuicaoManual.ts` | Inserir log após atribuição manual |
| `src/hooks/useHistoricoAtribuicoes.ts` | Novo hook de consulta |
| `src/components/monitoramento/HistoricoAtribuicoesTab.tsx` | Novo componente |
| `src/pages/monitoramento/VistoriasInstalacoesMon.tsx` | Adicionar aba |

