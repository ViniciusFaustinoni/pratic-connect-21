UPDATE public.rastreadores
   SET veiculo_id = 'eafcc3ac-723a-4081-8408-8273023c5266',
       status     = 'instalado',
       updated_at = now()
 WHERE id = '23f08cf5-54d9-4eba-b7d9-33299a518e49'
   AND (veiculo_id IS NULL OR veiculo_id = 'eafcc3ac-723a-4081-8408-8273023c5266');

UPDATE public.instalacoes
   SET rastreador_id = '23f08cf5-54d9-4eba-b7d9-33299a518e49',
       updated_at    = now()
 WHERE id = '5b5bece7-6c6e-4a79-bd75-0d59ffd75647'
   AND rastreador_id IS NULL;

INSERT INTO public.estoque_movimentacoes
       (tipo, quantidade, status_anterior, status_novo, rastreador_id, observacoes)
SELECT 'saida', 1, 'estoque', 'instalado',
       '23f08cf5-54d9-4eba-b7d9-33299a518e49',
       'Vínculo manual — HONDA ELITE 125 chassi 9C2JK3400VR006840 (saneamento — instalador travou por falso "dispensa rastreador")'
 WHERE NOT EXISTS (
   SELECT 1 FROM public.estoque_movimentacoes
    WHERE rastreador_id = '23f08cf5-54d9-4eba-b7d9-33299a518e49'
      AND status_novo = 'instalado'
      AND created_at > now() - interval '1 hour'
 );