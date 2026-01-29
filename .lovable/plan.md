
# Revisao Completa - Fluxo de Envio de Comandos para Rastreadores Softruck

## Resumo Executivo

| Item | Status | Detalhes |
|------|--------|----------|
| Botao "Bloquear veiculo" no monitoramento | NAO IMPLEMENTADO | Nao existe na interface |
| Botao "Desbloquear veiculo" | NAO IMPLEMENTADO | Nao existe na interface |
| Comando em confirmacao de sinistro roubo/furto | PARCIALMENTE | Edge function `acionar-roubo-furto` apenas notifica |
| Comando via Assistencia 24h com autorizacao | NAO IMPLEMENTADO | Nao existe integracao |
| Historico de comandos antes de enviar | NAO IMPLEMENTADO | Nao ha tabela de comandos |
| Confirmacao do usuario antes da acao | NAO IMPLEMENTADO | Nao ha dialogs de confirmacao |
| Status do comando (pendente → enviado → confirmado) | NAO IMPLEMENTADO | Nao ha fluxo de status |
| Gravacao de motivo e solicitante para auditoria | PARCIALMENTE | Apenas em acionamentos de roubo |
| API Softruck para bloqueio | NAO DISPONIVEL | API publica nao suporta comandos |

---

## Analise Critica: API Softruck NAO Suporta Comandos de Bloqueio

Apos analise da documentacao oficial da Softruck (`docs.apiary.softruck.com`), constatei que:

1. A **API publica v2** nao possui endpoints para comandos de bloqueio/desbloqueio
2. Os comandos disponíveis na API sao apenas:
   - Gestao de veiculos (CRUD)
   - Gestao de dispositivos (CRUD)
   - Rastreamento (tracking, trajectories)
   - Usuarios e associacoes
   - Service Orders

3. Segundo a documentacao de suporte Softruck, comandos de bloqueio sao enviados via **SMS direto ao dispositivo**:
   - `RELAY,1#` - Bloquear veiculo
   - `RELAY,0#` - Desbloquear veiculo

4. A tabela `rastreadores_config_plataformas` ja reflete essa limitacao:

```sql
SELECT suporta_bloqueio FROM rastreadores_config_plataformas 
WHERE plataforma = 'softruck';
-- Resultado: false
```

---

## Situacao Atual no Sistema

### 1. Interface de Monitoramento

O arquivo `src/components/rastreadores/RastreadorDetailDrawer.tsx` nao possui botoes de bloquear/desbloquear:

```text
Acoes Rapidas disponiveis:
- Manutencao (mudar status para manutencao)
- Voltar Estoque (mudar status para estoque)
- Desinstalar (mudar status para estoque)
- Baixar (mudar status para baixado)
- Redefinir Senha (para associado)

NAO HA: Bloquear Veiculo / Desbloquear Veiculo
```

### 2. Edge Function de Acionamento de Roubo

A `acionar-roubo-furto` **tenta** chamar endpoint de alertas, mas nao comandos:

```typescript
// Linhas 326-340 de acionar-roubo-furto/index.ts
const response = await fetch(`${baseUrl}/alerts/theft`, {
  method: "POST",
  headers: { ... },
  body: JSON.stringify({
    vehicle_id: rastreador.plataforma_veiculo_id,
    alert_type: "theft",
    priority: "critical",
  }),
});
```

**NOTA:** O endpoint `/alerts/theft` nao existe na documentacao publica da Softruck.

### 3. Tabela de Logs

Existe `rastreadores_logs` com campos:
- id, rastreador_id, plataforma, operacao
- request, response, status
- tempo_resposta_ms, erro_mensagem, created_at

**Mas nao e usada para comandos** - apenas para sincronizacao e autenticacao.

### 4. Tabela de Acionamentos

Existe `acionamentos_roubo_furto` com fluxo completo de status:
- status: solicitado → autorizado → enviado → confirmado/erro
- solicitado_por, solicitado_por_nome, autorizado_por
- observacoes, motivo_encerramento

---

## Opcoes de Implementacao

### Opcao A: Comando via SMS (Requer Integracao SMS)

Para enviar comandos de bloqueio, seria necessario:
1. Criar edge function `enviar-comando-rastreador`
2. Integrar com servico de envio de SMS (Twilio, Vonage, etc.)
3. Armazenar numero do chip em `rastreadores.chip_numero`
4. Enviar comandos SMS padrao do dispositivo:
   - `RELAY,1#` para bloquear
   - `RELAY,0#` para desbloquear

### Opcao B: API Proprietaria (Requer Contato Softruck)

Verificar com suporte comercial Softruck se existe:
1. API de comandos nao documentada publicamente
2. Endpoint de outputs para dispositivos especificos
3. Contrato enterprise com acesso a recursos adicionais

### Opcao C: Implementar Fluxo Sem Integracao

Criar interface de registro de comandos para:
1. Registrar solicitacao de bloqueio manualmente
2. Operador executa comando externamente (painel Softruck)
3. Registrar confirmacao no sistema

---

## Plano de Implementacao Recomendado

Dado que a API Softruck nao suporta comandos de bloqueio, proponho implementar:

### Fase 1: Criar Estrutura de Comandos no Banco

**Nova tabela: `rastreadores_comandos`**

```sql
CREATE TABLE rastreadores_comandos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rastreador_id UUID REFERENCES rastreadores(id),
  veiculo_id UUID REFERENCES veiculos(id),
  plataforma VARCHAR(50),
  tipo_comando VARCHAR(50), -- 'bloquear', 'desbloquear', 'localizar_agora'
  origem VARCHAR(50), -- 'monitoramento', 'sinistro', 'assistencia', 'diretoria'
  origem_id UUID, -- ID do sinistro ou chamado
  solicitado_por UUID REFERENCES profiles(id),
  solicitado_por_nome VARCHAR(255),
  solicitado_em TIMESTAMPTZ DEFAULT NOW(),
  autorizado_por UUID REFERENCES profiles(id),
  autorizado_por_nome VARCHAR(255),
  autorizado_em TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'pendente', -- 'pendente', 'autorizado', 'enviado', 'confirmado', 'erro', 'cancelado'
  metodo_envio VARCHAR(50), -- 'api', 'sms', 'manual'
  telefone_destino VARCHAR(20),
  comando_enviado TEXT,
  api_request JSONB,
  api_response JSONB,
  erro_mensagem TEXT,
  confirmado_em TIMESTAMPTZ,
  observacoes TEXT,
  motivo TEXT NOT NULL, -- Obrigatorio para auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Fase 2: Criar Edge Function para Comandos

**Novo arquivo: `supabase/functions/enviar-comando-rastreador/index.ts`**

Funcoes:
- Validar autenticacao e permissoes
- Verificar se plataforma suporta_bloqueio
- Registrar comando na tabela antes de enviar
- Para Softruck: registrar como "manual" (operador executa no painel)
- Para plataformas com API: chamar endpoint
- Atualizar status apos resposta
- Criar alerta no sistema
- Notificar equipe de monitoramento

### Fase 3: Adicionar Botoes na Interface

**Modificar: `src/components/rastreadores/RastreadorDetailDrawer.tsx`**

```tsx
// Adicionar na secao "Acoes Rapidas"
{isInstalled && plataforma?.suporta_bloqueio && (
  <>
    <Button
      variant="destructive"
      size="sm"
      onClick={() => setConfirmDialogOpen({ type: 'bloquear', open: true })}
    >
      <Lock className="mr-2 h-4 w-4" />
      Bloquear Veiculo
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => setConfirmDialogOpen({ type: 'desbloquear', open: true })}
    >
      <Unlock className="mr-2 h-4 w-4" />
      Desbloquear
    </Button>
  </>
)}
```

### Fase 4: Dialogo de Confirmacao com Motivo

**Novo componente: `src/components/rastreadores/ComandoRastreadorDialog.tsx`**

```tsx
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoComando: 'bloquear' | 'desbloquear';
  rastreador: Rastreador;
  veiculo?: Veiculo;
  onConfirm: (motivo: string) => Promise<void>;
}

// Campos:
// - Tipo de comando (apenas exibicao)
// - Placa do veiculo (apenas exibicao)
// - Nome do associado (apenas exibicao)
// - Motivo (obrigatorio, textarea)
// - Checkbox de confirmacao
// - Botoes: Cancelar / Confirmar
```

### Fase 5: Hook de Comandos

**Novo arquivo: `src/hooks/useComandosRastreador.ts`**

```typescript
export function useEnviarComando() {
  return useMutation({
    mutationFn: async (data: {
      rastreador_id: string;
      tipo_comando: 'bloquear' | 'desbloquear';
      motivo: string;
      origem?: 'monitoramento' | 'sinistro' | 'assistencia';
      origem_id?: string;
    }) => {
      const { data: response, error } = await supabase.functions.invoke(
        'enviar-comando-rastreador',
        { body: data }
      );
      if (error) throw error;
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comandos-rastreador'] });
      toast({ title: 'Comando registrado' });
    },
  });
}

export function useHistoricoComandos(rastreadorId: string) {
  return useQuery({
    queryKey: ['comandos-rastreador', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores_comandos')
        .select('*, solicitante:profiles!solicitado_por(nome)')
        .eq('rastreador_id', rastreadorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
```

### Fase 6: Integrar com Sinistro de Roubo

**Modificar: `src/pages/eventos/SinistroDetalhe.tsx`**

Adicionar botao "Bloquear Veiculo" na sidebar quando:
- Tipo do sinistro = roubo ou furto
- Veiculo possui rastreador instalado
- Status do sinistro permite acao

### Fase 7: Integrar com Assistencia 24h

**Modificar pagina de chamados de assistencia** para:
- Permitir solicitar bloqueio mediante autorizacao
- Registrar fluxo de aprovacao

---

## Fluxo Completo Proposto

```text
1. Analista clica "Bloquear Veiculo"
   |
   v
2. Dialog de confirmacao abre
   - Exibe dados do veiculo/associado
   - Campo OBRIGATORIO de motivo
   - Checkbox de confirmacao
   |
   v
3. Registro ANTES de enviar
   - Insere em rastreadores_comandos
   - Status = 'pendente'
   - Grava solicitante + motivo
   |
   v
4. Verificacao de plataforma
   - Se suporta_bloqueio = true → Envia via API
   - Se suporta_bloqueio = false → Marca como 'manual'
   |
   v
5. Atualizacao de status
   - 'enviado' → Comando em processamento
   - 'confirmado' → API retornou sucesso
   - 'erro' → Falha no envio
   |
   v
6. Notificacoes
   - Alerta no sistema
   - Notificacao para monitoramento
   - Log de auditoria
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/enviar-comando-rastreador/index.ts` | Edge function de comandos |
| `src/hooks/useComandosRastreador.ts` | Hooks React Query |
| `src/components/rastreadores/ComandoRastreadorDialog.tsx` | Dialogo de confirmacao |
| `src/components/rastreadores/HistoricoComandos.tsx` | Lista de comandos enviados |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/components/rastreadores/RastreadorDetailDrawer.tsx` | Adicionar botoes Bloquear/Desbloquear |
| `src/pages/eventos/SinistroDetalhe.tsx` | Adicionar botao de bloqueio em sinistros de roubo |
| `supabase/config.toml` | Registrar nova edge function |

## Migracao SQL

Uma migracao sera necessaria para criar a tabela `rastreadores_comandos`.

---

## Consideracao Importante

Para a plataforma Softruck especificamente, como a API publica nao suporta comandos de bloqueio:

1. Os botoes serao exibidos apenas se `suporta_bloqueio = true` na config da plataforma
2. Atualmente Softruck esta com `suporta_bloqueio = false`
3. Para habilitar, e necessario:
   - Verificar com Softruck se existe API de comandos (contrato enterprise)
   - Ou implementar envio de comandos via SMS (requer servico SMS)

Se desejar, posso implementar o fluxo completo de forma que esteja pronto para quando a integracao de comandos estiver disponivel.
