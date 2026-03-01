

# Corrigir erro "Erro ao confirmar duplo check"

## Problema Identificado

O erro ocorre porque a politica de seguranca (RLS) da tabela `servicos` **nao permite que prestadores (instaladores/vistoriadores) facam updates**. A unica politica de update existente exige que o usuario seja do tipo `funcionario`, mas instaladores e vistoriadores sao do tipo `prestador`.

Quando o prestador clica em "Confirmar Duplo Check", o frontend tenta fazer um UPDATE na tabela `servicos` (campos `imprevisto_duplo_check`, `status`, etc.), mas o Supabase bloqueia a operacao silenciosamente por causa da RLS.

## Solucao

Criar uma politica RLS que permita prestadores atualizarem servicos **atribuidos a eles**, limitando os campos que podem ser alterados via uma funcao de validacao.

### Alteracao 1: Criar funcao auxiliar `is_prestador`

```sql
CREATE OR REPLACE FUNCTION public.is_prestador(_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND tipo = 'prestador'
      AND ativo = true
  )
$$;
```

### Alteracao 2: Criar politica RLS para prestadores

Permitir que prestadores atualizem servicos que estao atribuidos a eles (campo `profissional_id` igual ao seu `profile.id`):

```sql
CREATE POLICY "Prestadores podem atualizar seus servicos"
ON public.servicos
FOR UPDATE
USING (
  is_prestador(auth.uid())
  AND profissional_id = (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  is_prestador(auth.uid())
  AND profissional_id = (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);
```

### Alteracao 3: Permitir SELECT para prestadores

Os prestadores tambem precisam ler seus proprios servicos (para o hook `useTarefaAtual` funcionar). Verificar se ja existe uma politica SELECT para prestadores; se nao, criar:

```sql
CREATE POLICY "Prestadores podem ver seus servicos"
ON public.servicos
FOR SELECT
USING (
  is_prestador(auth.uid())
  AND profissional_id = (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);
```

## Nenhuma alteracao no frontend

O codigo do `DuploCheckImprevisto.tsx` esta correto. O problema e exclusivamente de permissao no banco de dados.

## Resultado esperado

Apos a migracao, prestadores poderao:
- Ler servicos atribuidos a eles
- Atualizar campos dos seus servicos (status, imprevisto, duplo check, etc.)
- Confirmar o duplo check sem erro

## Resumo: 1 migracao SQL com 2-3 comandos

