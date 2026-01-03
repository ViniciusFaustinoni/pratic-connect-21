-- Tabela de Histórico de Associados
CREATE TABLE IF NOT EXISTS associados_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Associado
  associado_id UUID NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
  
  -- Tipo de ação
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
    'associado_criado',
    'status_alterado',
    'dados_atualizados',
    'documento_enviado',
    'documento_aprovado',
    'documento_reprovado',
    'veiculo_adicionado',
    'veiculo_removido',
    'instalacao_agendada',
    'instalacao_concluida',
    'instalacao_cancelada',
    'boleto_gerado',
    'boleto_pago',
    'boleto_cancelado',
    'chamado_aberto',
    'chamado_concluido',
    'sinistro_aberto',
    'sinistro_atualizado',
    'sinistro_encerrado',
    'contrato_assinado',
    'observacao_adicionada'
  )),
  
  -- Descrição do evento
  descricao TEXT NOT NULL,
  
  -- Dados para auditoria
  dados_anteriores JSONB,
  dados_novos JSONB,
  metadata JSONB,
  
  -- Referências opcionais
  documento_id UUID REFERENCES documentos(id) ON DELETE SET NULL,
  veiculo_id UUID REFERENCES veiculos(id) ON DELETE SET NULL,
  instalacao_id UUID REFERENCES instalacoes(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES contratos(id) ON DELETE SET NULL,
  
  -- Usuário que fez a ação
  usuario_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_assoc_hist_associado ON associados_historico(associado_id);
CREATE INDEX idx_assoc_hist_tipo ON associados_historico(tipo);
CREATE INDEX idx_assoc_hist_data ON associados_historico(created_at DESC);

-- RLS
ALTER TABLE associados_historico ENABLE ROW LEVEL SECURITY;

-- Funcionários podem ver histórico
CREATE POLICY "Funcionarios podem ver historico"
  ON associados_historico FOR SELECT
  TO authenticated
  USING (is_funcionario(auth.uid()));

-- Associado pode ver próprio histórico
CREATE POLICY "Associado pode ver proprio historico"
  ON associados_historico FOR SELECT
  TO authenticated
  USING (associado_id = get_my_associado_id(auth.uid()));

-- Funcionários podem inserir histórico
CREATE POLICY "Funcionarios podem inserir historico"
  ON associados_historico FOR INSERT
  TO authenticated
  WITH CHECK (is_funcionario(auth.uid()));

-- Função para registrar histórico automaticamente
CREATE OR REPLACE FUNCTION fn_registrar_historico_associado()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO associados_historico (associado_id, tipo, descricao, dados_novos)
    VALUES (
      NEW.id, 
      'associado_criado', 
      'Associado cadastrado no sistema: ' || NEW.nome,
      jsonb_build_object('nome', NEW.nome, 'cpf', NEW.cpf, 'telefone', NEW.telefone)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Verificar mudança de status
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO associados_historico (associado_id, tipo, descricao, dados_anteriores, dados_novos)
      VALUES (
        NEW.id, 
        'status_alterado', 
        'Status alterado de ' || OLD.status || ' para ' || NEW.status,
        jsonb_build_object('status', OLD.status),
        jsonb_build_object('status', NEW.status)
      );
    END IF;
    
    -- Verificar bloqueio
    IF (OLD.bloqueado IS DISTINCT FROM NEW.bloqueado) AND NEW.bloqueado = true THEN
      INSERT INTO associados_historico (associado_id, tipo, descricao, dados_novos)
      VALUES (
        NEW.id, 
        'status_alterado', 
        'Associado bloqueado: ' || COALESCE(NEW.motivo_bloqueio, 'Sem motivo informado'),
        jsonb_build_object('bloqueado', true, 'motivo', NEW.motivo_bloqueio)
      );
    ELSIF (OLD.bloqueado IS DISTINCT FROM NEW.bloqueado) AND NEW.bloqueado = false THEN
      INSERT INTO associados_historico (associado_id, tipo, descricao, dados_anteriores)
      VALUES (
        NEW.id, 
        'status_alterado', 
        'Associado desbloqueado',
        jsonb_build_object('bloqueado', false)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger
CREATE TRIGGER trg_historico_associado
  AFTER INSERT OR UPDATE ON associados
  FOR EACH ROW
  EXECUTE FUNCTION fn_registrar_historico_associado();