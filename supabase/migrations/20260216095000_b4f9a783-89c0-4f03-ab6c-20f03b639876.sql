DROP POLICY IF EXISTS "Reguladores e gestores podem atualizar vistorias" ON vistorias_evento;

CREATE POLICY "Reguladores gestores e analistas podem atualizar vistorias"
  ON vistorias_evento FOR UPDATE
  USING (
    has_role(auth.uid(), 'regulador') OR
    has_role(auth.uid(), 'diretor') OR
    has_role(auth.uid(), 'gerente_comercial') OR
    has_role(auth.uid(), 'analista_eventos')
  );