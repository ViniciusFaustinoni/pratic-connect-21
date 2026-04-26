# Preencher código Hinova (codigo_sga_voluntario) dos usuários

## Contexto

A coluna que armazena o "código Hinova" no banco se chama `codigo_sga_voluntario` na tabela `profiles` (não existe `codigo_hinova`). Hoje só 4 perfis têm valor preenchido. Você enviou 225 linhas (usuário + email + código) para popular o restante.

## Estratégia de matching

- Match por **email case-insensitive** (`lower(p.email) = lower(novos.email)`).
- Não vou tentar fazer match por nome — tem caracteres acentuados, abreviações e nomes idênticos entre pessoas diferentes (ex: "EDUARDO SANTOS" pode existir mais de uma vez).
- Emails que não baterem em nenhum profile não atualizam nada (UPDATE silencioso). Após rodar, vou listar os emails sem match para você revisar manualmente.

## Migration

Um único `UPDATE` com `WITH ... VALUES` carregando os 225 pares (código, email):

```sql
WITH novos(codigo, email) AS (
  VALUES
    (125, 'vendedorctl@teste.com'),
    (39, 'adrianaleandropraticcar@gmail.com'),
    -- ... 223 linhas ...
    (40, 'eduardonegreirospraticcar@gmail.com')
)
UPDATE public.profiles p
SET codigo_sga_voluntario = novos.codigo::varchar,
    updated_at = now()
FROM novos
WHERE lower(p.email) = lower(novos.email);
```

A lista completa dos 225 pares já foi gerada em `/tmp/migration.sql` (9277 caracteres). Vai entrar inteira na migration final.

## Após aplicar

Vou rodar 2 queries de verificação:

1. `SELECT COUNT(*) FROM profiles WHERE codigo_sga_voluntario IS NOT NULL` — número total de perfis preenchidos (esperado: ~225 + 4 que já tinham).
2. Listagem dos emails da sua planilha que **não** bateram com nenhum profile — para você decidir se precisam ser criados ou se há divergência de email.

## O que não muda

- Schema da tabela continua igual (sem nova coluna, sem nova constraint).
- Os 4 códigos já preenchidos (5, 6, 10, 125) coincidem com a sua lista, então serão sobrescritos com o mesmo valor.
- Nada de UI ou edge function muda.
