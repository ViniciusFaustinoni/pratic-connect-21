

## Plano: Corrigir CRUD de Locais de Instalação

### Causa Raiz

As políticas RLS da tabela `locais_instalacao` exigem role `admin`, mas esse role **não existe** no sistema. O role mais alto é `diretor`. Por isso INSERT e UPDATE falham silenciosamente.

### Correção

**Migration SQL** -- atualizar as policies para usar `diretor` ao invés de `admin`:

```sql
-- Remover policies antigas
DROP POLICY "Admin insert" ON public.locais_instalacao;
DROP POLICY "Admin update" ON public.locais_instalacao;

-- Recriar com role correto
CREATE POLICY "Diretor insert" ON public.locais_instalacao
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'diretor'));

CREATE POLICY "Diretor update" ON public.locais_instalacao
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'diretor'))
  WITH CHECK (has_role(auth.uid(), 'diretor'));
```

Tambem incluir `coordenador_monitoramento` para permitir que coordenadores gerenciem locais:

```sql
-- Ou usar uma abordagem OR:
WITH CHECK (
  has_role(auth.uid(), 'diretor') OR 
  has_role(auth.uid(), 'coordenador_monitoramento')
);
```

### Melhoria no componente

Adicionar tratamento de erro mais claro no `useLocaisInstalacao.ts` para exibir mensagem quando a operação falha por permissão.

### Arquivos
- **Migration SQL**: corrigir RLS policies de `locais_instalacao`
- **Editar**: `src/hooks/useLocaisInstalacao.ts` (melhorar mensagens de erro)

