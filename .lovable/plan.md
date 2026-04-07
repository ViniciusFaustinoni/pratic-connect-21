

# Plano: Drawer de Tratativa — Fluxo em 3 Etapas

## Alterações

### 1. Banco de dados — nova tabela `manutencao_tratativa_logs`

Registra cada interação/etapa da tratativa:

```sql
CREATE TABLE manutencao_tratativa_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tratativa_id uuid NOT NULL REFERENCES manutencao_tratativas(id) ON DELETE CASCADE,
  etapa text NOT NULL, -- 'contato', 'validacao', 'decisao'
  acao text NOT NULL,  -- ex: 'contato_registrado', 'situacao_veiculo_parado', 'resolvido_sem_visita'
  dados jsonb DEFAULT '{}', -- canal, resposta, observacoes, etc.
  criado_por uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
```

+ Adicionar coluna `etapa_atual` (text, default 'contato') na tabela `manutencao_tratativas` para rastrear em qual etapa o operador está.

### 2. Hook `useTratativaDrawer.ts`

- Recebe `tratativaId` e `veiculoId`
- Query: dados da tratativa + logs ordenados por `created_at`
- Mutations:
  - `registrarContato(canal, dataHora, resposta)` → insere log etapa 'contato', atualiza tratativa para `etapa_atual = 'validacao'` e `status = 'em_tratativa'`
  - `registrarValidacao(situacao, dados)` → insere log etapa 'validacao', atualiza `etapa_atual = 'decisao'`
  - `resolverSemVisita()` → insere log etapa 'decisao', atualiza `status = 'resolvido_sem_visita'`
  - `confirmarFalha()` → insere log etapa 'decisao', atualiza `status = 'agendado'` (agendamento vem no próximo prompt)

### 3. Componente `TratativaDrawer.tsx`

Drawer (Sheet side="right", largura ~480px) com:

**Cabeçalho fixo:**
- Nome do associado, placa, último ponto, dias sem pontuar

**Indicador de progresso:** 3 steps (Contato → Validação → Decisão) com visual de step indicator

**Conteúdo por etapa:**

- **Etapa 1 (Contato):** Select canal (WhatsApp/Ligação/SMS), DateTimePicker, Textarea "Resposta do associado" (obrigatório), Botão "Avançar para validação"
- **Etapa 2 (Validação):** 2 cards clicáveis (Veículo parado / Uso diário). Veículo parado → pergunta "pode movimentar?" com sub-fluxo. Uso diário → campos de segunda validação.
- **Etapa 3 (Decisão):** Botão verde "Resolvido sem visita" + Botão laranja "Confirmar falha — agendar visita técnica" (apenas marca status, agendamento no próximo prompt)

**Histórico (parte inferior):** Timeline dos logs com data, operador e ação.

### 4. Integração no `ManutencaoRastreadoresTab.tsx`

- State `selectedVeiculo` para controlar abertura do drawer
- Botão "Iniciar tratativa" abre o drawer (após criar o registro, ou abre direto se já existe tratativa)
- Linhas com status != `sem_tratativa` ganham botão "Continuar tratativa" que abre o drawer na etapa atual

## Arquivos

- **Criado**: migration SQL (tabela logs + coluna etapa_atual)
- **Criado**: `src/hooks/useTratativaDrawer.ts`
- **Criado**: `src/components/monitoramento/manutencao-rastreadores/TratativaDrawer.tsx`
- **Modificado**: `src/components/monitoramento/manutencao-rastreadores/ManutencaoRastreadoresTab.tsx`

