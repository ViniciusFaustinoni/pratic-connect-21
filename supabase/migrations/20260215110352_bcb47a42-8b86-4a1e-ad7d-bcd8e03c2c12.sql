-- Analistas de eventos podem ver todas as solicitações
CREATE POLICY "Analistas de eventos podem ver solicitacoes"
  ON public.chat_solicitacoes_ia FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'analista_eventos'));

-- Analistas de eventos podem atualizar solicitações (aprovar/rejeitar)
CREATE POLICY "Analistas de eventos podem atualizar solicitacoes"
  ON public.chat_solicitacoes_ia FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'analista_eventos'));