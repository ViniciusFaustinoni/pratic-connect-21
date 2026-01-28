
# Plano: Sistema de Encaixe Estilo Uber Quando Cliente Reagenda

## Visao Geral

Quando um cliente **reagendar** durante a confirmacao via WhatsApp, o horario original fica vago. Este sistema:
1. Libera esse horario como um "encaixe urgente" para todos os vistoriadores ativos
2. Permite que UM vistoriador "aceite a corrida" (exclusividade garantida)
3. Vistoriador entra em contato manual via WhatsApp com o cliente
4. Apos confirmar com cliente, inicia rota e a tarefa e atribuida a ele

## Arquitetura do Fluxo

```text
Cliente responde "REAGENDAR"
         |
         v
+------------------------+
| whatsapp-webhook       |
| - Status -> reagendado |
| - Libera encaixe       |
+------------------------+
         |
         v
+----------------------------------+
| NOVA tabela: encaixes_urgentes   |
| - servico_id                     |
| - status: 'disponivel'           |
| - reservado_por: NULL            |
+----------------------------------+
         |
    (Realtime)
         v
+----------------------------------+
| App Vistoriador                  |
| Lista de Encaixes Urgentes       |
| Botao "Aceitar Corrida"          |
+----------------------------------+
         |
   (Reservar)
         v
+----------------------------------+
| Vistoriador reserva (exclusivo)  |
| - Ve botao WhatsApp cliente      |
| - Entra em contato manual        |
+----------------------------------+
         |
  (Confirmar)
         v
+----------------------------------+
| Vistoriador confirma com cliente |
| - Clica "Iniciar Rota"           |
| - Atribui tarefa ao vistoriador  |
| - Remove encaixe da lista        |
+----------------------------------+
```

---

## Banco de Dados

### Nova Tabela: `encaixes_urgentes`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| servico_id | uuid | FK -> servicos (NOT NULL) |
| status | text | 'disponivel', 'reservado', 'confirmado', 'expirado', 'cancelado' |
| reservado_por | uuid | FK -> profiles (quem reservou) |
| reservado_em | timestamptz | Quando foi reservado |
| motivo | text | 'cliente_reagendou', 'horario_vago', etc |
| telefone_cliente | text | Para exibir botao WhatsApp |
| nome_cliente | text | Nome do cliente |
| dados_servico | jsonb | Dados resumidos (endereco, veiculo, tipo) |
| expira_em | timestamptz | 30 min apos reserva (timeout) |
| created_at | timestamptz | |

### Constraint de Unicidade

```sql
-- Apenas UM vistoriador pode reservar um encaixe por vez
CREATE UNIQUE INDEX idx_encaixe_reservado 
ON encaixes_urgentes(servico_id) 
WHERE status = 'reservado';
```

### Funcao para Reservar com Exclusividade

```sql
CREATE OR REPLACE FUNCTION reservar_encaixe_urgente(
  p_encaixe_id UUID,
  p_profissional_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE encaixes_urgentes
  SET 
    status = 'reservado',
    reservado_por = p_profissional_id,
    reservado_em = NOW(),
    expira_em = NOW() + INTERVAL '30 minutes'
  WHERE id = p_encaixe_id
    AND status = 'disponivel'
    AND reservado_por IS NULL;
  
  RETURN FOUND;
END;
$$;
```

---

## Edge Function: whatsapp-webhook (Modificar)

Quando cliente responde com intencao `REAGENDAR`:

```typescript
if (resultado.intencao === 'REAGENDAR') {
  // 1. Atualizar servico
  await supabase.from('servicos')
    .update({ confirmacao_whatsapp: 'reagendado' })
    .eq('id', confirmacao.servico_id);

  // 2. Buscar dados do servico para criar encaixe urgente
  const { data: servico } = await supabase
    .from('servicos')
    .select(`
      id, tipo, data_agendada, hora_agendada, periodo,
      logradouro, numero, bairro, cidade,
      associado:associados(nome, telefone),
      veiculo:veiculos(placa, marca, modelo)
    `)
    .eq('id', confirmacao.servico_id)
    .single();

  // 3. Criar encaixe urgente para outros vistoriadores
  await supabase.from('encaixes_urgentes').insert({
    servico_id: confirmacao.servico_id,
    status: 'disponivel',
    motivo: 'cliente_reagendou',
    telefone_cliente: confirmacao.telefone,
    nome_cliente: servico.associado?.nome,
    dados_servico: {
      tipo: servico.tipo,
      data: servico.data_agendada,
      hora: servico.hora_agendada,
      periodo: servico.periodo,
      endereco: `${servico.logradouro}, ${servico.numero} - ${servico.bairro}, ${servico.cidade}`,
      veiculo: `${servico.veiculo?.marca} ${servico.veiculo?.modelo} - ${servico.veiculo?.placa}`,
    },
  });

  // 4. Remover profissional atual do servico (liberar horario)
  await supabase.from('servicos')
    .update({ profissional_id: null })
    .eq('id', confirmacao.servico_id);
}
```

---

## Frontend: Novo Componente EncaixesUrgentes

### Hook: `useEncaixesUrgentes`

```typescript
export function useEncaixesUrgentes() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['encaixes-urgentes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('encaixes_urgentes')
        .select('*')
        .in('status', ['disponivel', 'reservado'])
        .order('created_at', { ascending: false });
      return data || [];
    },
    refetchInterval: 5000, // Polling a cada 5s
  });
}
```

### Componente: `EncaixeUrgenteCard`

| Estado | Exibicao |
|--------|----------|
| `disponivel` | Card com dados + Botao "Aceitar Corrida" |
| `reservado` (por mim) | Card com WhatsApp + Botao "Confirmar e Iniciar Rota" |
| `reservado` (por outro) | Card com badge "Reservado por [Nome]" (bloqueado) |

### Acoes do Vistoriador

1. **Aceitar Corrida**
   - Chama RPC `reservar_encaixe_urgente`
   - Se retornar `false`: outro ja reservou (exibir toast)
   - Se `true`: mostrar botao WhatsApp e opcao confirmar

2. **Contato WhatsApp**
   - Botao abre `https://wa.me/55${telefone}?text=...`
   - Texto pre-formatado: "Ola, sou o vistoriador da PRATIC. Voce pode me receber agora?"

3. **Confirmar e Iniciar Rota**
   - Atualiza `encaixes_urgentes.status = 'confirmado'`
   - Atualiza `servicos.profissional_id = profile.id`
   - Atualiza `servicos.status = 'em_rota'`
   - Redireciona para mapa/tarefa

---

## Integracao com InstaladorHome

### Adicionar Secao de Encaixes Urgentes

Na pagina `InstaladorHome.tsx`, adicionar:

```tsx
// Abaixo do TarefaAtualCard ou BotaoIniciarServico
{encaixesUrgentes.length > 0 && (
  <div className="space-y-3">
    <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
      <Zap className="h-4 w-4 text-amber-400" />
      Encaixes Urgentes ({encaixesUrgentes.length})
    </h2>
    {encaixesUrgentes.map(encaixe => (
      <EncaixeUrgenteCard key={encaixe.id} encaixe={encaixe} />
    ))}
  </div>
)}
```

---

## Realtime para Atualizacoes Instantaneas

```typescript
// Em useEncaixesUrgentes
useEffect(() => {
  const channel = supabase
    .channel('encaixes-urgentes-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'encaixes_urgentes',
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ['encaixes-urgentes'] });
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);
```

---

## Timeout e Expiracao

### Cron Job para Expirar Reservas

Se um vistoriador reservou mas nao confirmou em 30 minutos:

```sql
-- Executar a cada 5 minutos
UPDATE encaixes_urgentes
SET 
  status = 'disponivel',
  reservado_por = NULL,
  reservado_em = NULL,
  expira_em = NULL
WHERE status = 'reservado'
  AND expira_em < NOW();
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| Migracao SQL | Criar | Tabela `encaixes_urgentes` + RPC + indices |
| `supabase/functions/whatsapp-webhook/index.ts` | Modificar | Criar encaixe urgente ao reagendar |
| `src/hooks/useEncaixesUrgentes.ts` | Criar | Hook para buscar/reservar/confirmar encaixes |
| `src/components/vistoriador/EncaixeUrgenteCard.tsx` | Criar | Card com fluxo Uber-like |
| `src/pages/instalador/InstaladorHome.tsx` | Modificar | Adicionar secao de encaixes urgentes |
| `src/pages/instalador/InstaladorTarefas.tsx` | Modificar | Adicionar aba "Encaixes" |

---

## Sequencia de Implementacao

### Fase 1: Banco de Dados
1. Criar tabela `encaixes_urgentes`
2. Criar RPC `reservar_encaixe_urgente`
3. Habilitar Realtime na tabela

### Fase 2: Edge Function
4. Modificar `whatsapp-webhook` para criar encaixe ao reagendar

### Fase 3: Frontend
5. Criar hook `useEncaixesUrgentes`
6. Criar componente `EncaixeUrgenteCard`
7. Integrar em `InstaladorHome` e `InstaladorTarefas`

### Fase 4: Realtime + Timeout
8. Adicionar subscription Realtime
9. Configurar cron para expirar reservas

---

## Fluxo Visual do Vistoriador

```text
[Home do Vistoriador]
        |
        v
+-----------------------------+
| ENCAIXE URGENTE!            |
| Cliente reagendou           |
| Vistoria - 10:00            |
| Joao Silva - ABC-1234       |
| Rua X, 123 - Centro         |
|                             |
| [ACEITAR CORRIDA]           |
+-----------------------------+
        |
  (Clica aceitar)
        v
+-----------------------------+
| RESERVADO POR VOCE          |
| 29:45 para confirmar        |
|                             |
| [WhatsApp Cliente]          |
|                             |
| [CONFIRMAR E INICIAR ROTA]  |
+-----------------------------+
        |
  (Confirma com cliente)
        v
+-----------------------------+
| TAREFA ATRIBUIDA!           |
| Navegando para local...     |
+-----------------------------+
```

---

## Consideracoes de Seguranca

### RLS para `encaixes_urgentes`

```sql
-- Apenas vistoriadores ativos podem ver encaixes
CREATE POLICY "Vistoriadores veem encaixes"
ON encaixes_urgentes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.tipo = 'funcionario'
    AND p.ativo = true
  )
);

-- Apenas o proprio vistoriador pode atualizar sua reserva
CREATE POLICY "Vistoriador atualiza propria reserva"
ON encaixes_urgentes FOR UPDATE
TO authenticated
USING (
  reservado_por = (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR reservado_por IS NULL
);
```

### Prevenir Reservas Duplicadas

A constraint `UNIQUE` + a funcao RPC com `WHERE status = 'disponivel'` garantem que apenas UM vistoriador pode reservar o mesmo encaixe.
