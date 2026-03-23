

# Plano: Separar Prestadores de Instalacao dos Prestadores de Assistencia

## Problema

A pagina Prestadores Parceiros do Monitoramento usa a tabela `prestadores_assistencia` (reboque, guincho, etc). Prestadores de instalacao sao um cadastro distinto com campos diferentes.

---

## Alteracoes

### 1. Nova tabela: `prestadores_instalacao` (migracao SQL)

```sql
CREATE TABLE public.prestadores_instalacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  whatsapp text,
  municipios_atuacao text[] DEFAULT '{}',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.prestadores_instalacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON public.prestadores_instalacao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### 2. Migrar FK da `instalacao_prestador_links`

Alterar a coluna `prestador_id` para referenciar `prestadores_instalacao` em vez de `prestadores_assistencia`:

```sql
ALTER TABLE public.instalacao_prestador_links
  DROP CONSTRAINT instalacao_prestador_links_prestador_id_fkey,
  ADD CONSTRAINT instalacao_prestador_links_prestador_id_fkey
    FOREIGN KEY (prestador_id) REFERENCES public.prestadores_instalacao(id);
```

### 3. Novo componente: `NovoPrestadorInstalacaoModal.tsx`

Modal simples com 4 campos:
- Nome / Razao Social (text, obrigatorio)
- WhatsApp (text)
- Municipios de atuacao (multi-select dos municipios com tipo "prestador" do Mapa de Atendimento, ja buscados na pagina)
- Status ativo/inativo (switch)

Faz insert/update na tabela `prestadores_instalacao`.

### 4. Reescrever `PrestadoresParceiros.tsx`

Trocar todas as queries de `prestadores_assistencia` para `prestadores_instalacao`:
- Lista principal: `from('prestadores_instalacao')`
- Metricas: `from('instalacao_prestador_links')` com join em `prestadores_instalacao` (ja funciona pois a FK sera migrada)
- Historico expandido: sem alteracao (usa `instalacao_prestador_links` que ja esta correto)
- Toggle status: update em `prestadores_instalacao`
- Substituir `NovoPrestadorModal` pelo novo `NovoPrestadorInstalacaoModal`
- Coluna "Municipios" mostra `p.municipios_atuacao` do prestador (nao mais todos os municipios genericos)

### 5. Atualizar `PrestadoresAtivos.tsx` (dashboard card)

Trocar query de nomes de `prestadores_assistencia` para `prestadores_instalacao`.

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Nova tabela + migrar FK |
| `src/components/monitoramento/NovoPrestadorInstalacaoModal.tsx` | **Novo** modal de cadastro |
| `src/pages/monitoramento/PrestadoresParceiros.tsx` | Trocar tabela e modal |
| `src/components/monitoramento/PrestadoresAtivos.tsx` | Trocar tabela de nomes |

## Nao alterado

- `prestadores_assistencia` e toda a area de Assistencia 24h permanecem intactos
- `NovoPrestadorModal.tsx` nao e modificado

