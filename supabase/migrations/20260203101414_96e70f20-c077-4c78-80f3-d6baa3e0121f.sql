-- Criar tabela turnos_profissionais para controle de jornada
CREATE TABLE public.turnos_profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  
  -- Horários
  inicio_turno TIMESTAMPTZ,
  inicio_almoco TIMESTAMPTZ,
  fim_almoco TIMESTAMPTZ,
  fim_turno TIMESTAMPTZ,
  
  -- Cálculos automáticos (em minutos)
  minutos_trabalhados INTEGER DEFAULT 0,
  minutos_almoco INTEGER DEFAULT 0,
  minutos_extras INTEGER DEFAULT 0,
  minutos_faltantes INTEGER DEFAULT 0,
  
  -- Saldo de horas do dia anterior (carryover)
  saldo_anterior_minutos INTEGER DEFAULT 0,
  
  -- Status: ativo, em_almoco, encerrado
  status VARCHAR(20) DEFAULT 'ativo',
  encerrado_automaticamente BOOLEAN DEFAULT false,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Garantir um turno por profissional por dia
  UNIQUE(profissional_id, data)
);

-- Índices para performance
CREATE INDEX idx_turnos_profissional_data ON public.turnos_profissionais(profissional_id, data DESC);
CREATE INDEX idx_turnos_data ON public.turnos_profissionais(data);
CREATE INDEX idx_turnos_status ON public.turnos_profissionais(status) WHERE status IN ('ativo', 'em_almoco');

-- Habilitar RLS
ALTER TABLE public.turnos_profissionais ENABLE ROW LEVEL SECURITY;

-- Profissionais veem próprios turnos
CREATE POLICY "Profissionais veem proprios turnos"
ON public.turnos_profissionais
FOR SELECT
USING (profissional_id = public.get_current_profile_id());

-- Profissionais gerenciam próprios turnos
CREATE POLICY "Profissionais gerenciam proprios turnos"
ON public.turnos_profissionais
FOR ALL
USING (profissional_id = public.get_current_profile_id())
WITH CHECK (profissional_id = public.get_current_profile_id());

-- Gerência pode ver todos os turnos (usando roles existentes)
CREATE POLICY "Gerencia ve todos turnos"
ON public.turnos_profissionais
FOR SELECT
USING (
  public.is_gerencia(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('coordenador_monitoramento', 'diretor', 'desenvolvedor', 'admin_master')
  )
);

-- Gerência pode editar todos os turnos
CREATE POLICY "Gerencia edita todos turnos"
ON public.turnos_profissionais
FOR UPDATE
USING (
  public.is_gerencia(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('coordenador_monitoramento', 'diretor', 'desenvolvedor', 'admin_master')
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_turnos_profissionais_updated_at
BEFORE UPDATE ON public.turnos_profissionais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular minutos trabalhados
CREATE OR REPLACE FUNCTION public.fn_calcular_minutos_turno()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minutos_trabalhados INTEGER := 0;
  v_minutos_almoco INTEGER := 0;
  v_jornada_padrao INTEGER := 480;
BEGIN
  -- Calcular minutos trabalhados
  IF NEW.inicio_turno IS NOT NULL AND NEW.fim_turno IS NOT NULL THEN
    v_minutos_trabalhados := EXTRACT(EPOCH FROM (NEW.fim_turno - NEW.inicio_turno)) / 60;
  ELSIF NEW.inicio_turno IS NOT NULL THEN
    v_minutos_trabalhados := EXTRACT(EPOCH FROM (NOW() - NEW.inicio_turno)) / 60;
  END IF;
  
  -- Calcular minutos de almoço
  IF NEW.inicio_almoco IS NOT NULL AND NEW.fim_almoco IS NOT NULL THEN
    v_minutos_almoco := EXTRACT(EPOCH FROM (NEW.fim_almoco - NEW.inicio_almoco)) / 60;
  ELSIF NEW.inicio_almoco IS NOT NULL AND NEW.status = 'em_almoco' THEN
    v_minutos_almoco := EXTRACT(EPOCH FROM (NOW() - NEW.inicio_almoco)) / 60;
  END IF;
  
  -- Descontar almoço do tempo trabalhado
  v_minutos_trabalhados := GREATEST(0, v_minutos_trabalhados - v_minutos_almoco);
  
  NEW.minutos_trabalhados := v_minutos_trabalhados;
  NEW.minutos_almoco := v_minutos_almoco;
  
  -- Calcular extras/faltantes apenas quando turno encerrado
  IF NEW.status = 'encerrado' THEN
    DECLARE
      v_jornada_ajustada INTEGER;
    BEGIN
      v_jornada_ajustada := v_jornada_padrao - COALESCE(NEW.saldo_anterior_minutos, 0);
      
      IF v_minutos_trabalhados > v_jornada_ajustada THEN
        NEW.minutos_extras := v_minutos_trabalhados - v_jornada_ajustada;
        NEW.minutos_faltantes := 0;
      ELSE
        NEW.minutos_extras := 0;
        NEW.minutos_faltantes := v_jornada_ajustada - v_minutos_trabalhados;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para calcular automaticamente
CREATE TRIGGER trigger_calcular_minutos_turno
BEFORE INSERT OR UPDATE ON public.turnos_profissionais
FOR EACH ROW
EXECUTE FUNCTION public.fn_calcular_minutos_turno();

-- Função para verificar e iniciar almoço automaticamente
CREATE OR REPLACE FUNCTION public.fn_verificar_almoco_profissional(p_profissional_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turno RECORD;
  v_minutos_trabalhados INTEGER;
BEGIN
  SELECT * INTO v_turno
  FROM public.turnos_profissionais
  WHERE profissional_id = p_profissional_id
    AND data = CURRENT_DATE
    AND status = 'ativo'
    AND inicio_almoco IS NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  v_minutos_trabalhados := EXTRACT(EPOCH FROM (NOW() - v_turno.inicio_turno)) / 60;
  
  IF v_minutos_trabalhados >= 240 THEN
    UPDATE public.turnos_profissionais
    SET status = 'em_almoco',
        inicio_almoco = NOW()
    WHERE id = v_turno.id;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Função para finalizar almoço automaticamente
CREATE OR REPLACE FUNCTION public.fn_verificar_fim_almoco_profissional(p_profissional_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turno RECORD;
  v_minutos_almoco INTEGER;
BEGIN
  SELECT * INTO v_turno
  FROM public.turnos_profissionais
  WHERE profissional_id = p_profissional_id
    AND data = CURRENT_DATE
    AND status = 'em_almoco'
    AND fim_almoco IS NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  v_minutos_almoco := EXTRACT(EPOCH FROM (NOW() - v_turno.inicio_almoco)) / 60;
  
  IF v_minutos_almoco >= 60 THEN
    UPDATE public.turnos_profissionais
    SET status = 'ativo',
        fim_almoco = NOW()
    WHERE id = v_turno.id;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;