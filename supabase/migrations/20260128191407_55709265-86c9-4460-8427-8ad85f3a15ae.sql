-- =====================================================
-- Tabela: encaixes_urgentes
-- Sistema estilo Uber para horários vagos quando cliente reagenda
-- =====================================================

-- 1. Criar tabela
CREATE TABLE IF NOT EXISTS public.encaixes_urgentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'reservado', 'confirmado', 'expirado', 'cancelado')),
  reservado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reservado_em TIMESTAMPTZ,
  motivo TEXT NOT NULL DEFAULT 'cliente_reagendou' CHECK (motivo IN ('cliente_reagendou', 'horario_vago', 'cancelamento', 'outro')),
  telefone_cliente TEXT NOT NULL,
  nome_cliente TEXT NOT NULL,
  dados_servico JSONB NOT NULL DEFAULT '{}',
  expira_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_encaixes_urgentes_status ON public.encaixes_urgentes(status);
CREATE INDEX IF NOT EXISTS idx_encaixes_urgentes_reservado_por ON public.encaixes_urgentes(reservado_por);
CREATE INDEX IF NOT EXISTS idx_encaixes_urgentes_created_at ON public.encaixes_urgentes(created_at DESC);

-- Constraint de unicidade: apenas UM pode reservar por vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_encaixe_reservado_unico 
ON public.encaixes_urgentes(servico_id) 
WHERE status = 'reservado';

-- 3. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_encaixes_urgentes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_encaixes_urgentes_updated_at ON public.encaixes_urgentes;
CREATE TRIGGER tr_encaixes_urgentes_updated_at
  BEFORE UPDATE ON public.encaixes_urgentes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_encaixes_urgentes_updated_at();

-- 4. Habilitar RLS
ALTER TABLE public.encaixes_urgentes ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS
-- Vistoriadores/instaladores ativos podem ver encaixes disponíveis e seus próprios reservados
CREATE POLICY "Profissionais veem encaixes disponíveis"
ON public.encaixes_urgentes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    INNER JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE p.user_id = auth.uid()
      AND p.tipo = 'funcionario'
      AND p.ativo = true
      AND (p.bloqueado IS NULL OR p.bloqueado = false)
      AND ur.role = 'instalador_vistoriador'
  )
  AND (
    status = 'disponivel' 
    OR reservado_por = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Diretores/gerentes veem tudo
CREATE POLICY "Gerência vê todos encaixes"
ON public.encaixes_urgentes FOR SELECT
TO authenticated
USING (
  public.is_gerencia(auth.uid()) OR public.is_diretor(auth.uid())
);

-- Insert apenas pelo sistema (service_role)
CREATE POLICY "Sistema pode inserir encaixes"
ON public.encaixes_urgentes FOR INSERT
TO authenticated
WITH CHECK (false); -- Apenas service_role pode inserir via edge functions

-- Update restrito ao profissional que reservou ou ao sistema
CREATE POLICY "Profissional atualiza próprio encaixe"
ON public.encaixes_urgentes FOR UPDATE
TO authenticated
USING (
  reservado_por = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR reservado_por IS NULL
);

-- 6. Função RPC para reservar com exclusividade atômica
CREATE OR REPLACE FUNCTION public.reservar_encaixe_urgente(
  p_encaixe_id UUID,
  p_profissional_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE encaixes_urgentes
  SET 
    status = 'reservado',
    reservado_por = p_profissional_id,
    reservado_em = NOW(),
    expira_em = NOW() + INTERVAL '30 minutes',
    updated_at = NOW()
  WHERE id = p_encaixe_id
    AND status = 'disponivel'
    AND reservado_por IS NULL;
  
  RETURN FOUND;
END;
$$;

-- 7. Função RPC para confirmar encaixe e atribuir tarefa
CREATE OR REPLACE FUNCTION public.confirmar_encaixe_urgente(
  p_encaixe_id UUID,
  p_profissional_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servico_id UUID;
BEGIN
  -- Buscar serviço do encaixe
  SELECT servico_id INTO v_servico_id
  FROM encaixes_urgentes
  WHERE id = p_encaixe_id
    AND status = 'reservado'
    AND reservado_por = p_profissional_id;
  
  IF v_servico_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Atualizar encaixe para confirmado
  UPDATE encaixes_urgentes
  SET status = 'confirmado', updated_at = NOW()
  WHERE id = p_encaixe_id;
  
  -- Atribuir serviço ao profissional e iniciar rota
  UPDATE servicos
  SET 
    profissional_id = p_profissional_id,
    status = 'em_rota',
    em_rota_em = NOW(),
    confirmacao_whatsapp = 'confirmada',
    updated_at = NOW()
  WHERE id = v_servico_id;
  
  RETURN TRUE;
END;
$$;

-- 8. Função para expirar reservas não confirmadas
CREATE OR REPLACE FUNCTION public.expirar_encaixes_urgentes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE encaixes_urgentes
  SET 
    status = 'disponivel',
    reservado_por = NULL,
    reservado_em = NULL,
    expira_em = NULL,
    updated_at = NOW()
  WHERE status = 'reservado'
    AND expira_em < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 9. Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.encaixes_urgentes;

-- 10. Comentários
COMMENT ON TABLE public.encaixes_urgentes IS 'Sistema de encaixe urgente estilo Uber para horários vagos';
COMMENT ON COLUMN public.encaixes_urgentes.status IS 'disponivel=aberto para aceite, reservado=profissional reservou, confirmado=cliente confirmou, expirado/cancelado';
COMMENT ON COLUMN public.encaixes_urgentes.dados_servico IS 'JSON com tipo, data, hora, endereco, veiculo para exibir no card';