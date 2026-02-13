

# Corrigir duplicacao persistente de documentos de sinistro

## Problema

A correcao anterior (filtro no frontend) esta correta, mas:
1. Ja existem duplicatas no banco de dados de tentativas anteriores
2. Nao ha uma restricao a nivel de banco de dados para impedir duplicatas, entao qualquer falha no frontend permite novas duplicatas

## Solucao em duas etapas

### Etapa 1: Limpar duplicatas existentes no banco

Executar SQL para remover registros duplicados, mantendo apenas o mais antigo de cada tipo por sinistro.

```sql
DELETE FROM sinistro_documentos 
WHERE id NOT IN (
  SELECT DISTINCT ON (sinistro_id, tipo) id 
  FROM sinistro_documentos 
  ORDER BY sinistro_id, tipo, created_at ASC
);
```

### Etapa 2: Adicionar restricao UNIQUE no banco

Criar um indice unico na combinacao `(sinistro_id, tipo)` para que o banco rejeite duplicatas automaticamente, independente do frontend.

```sql
CREATE UNIQUE INDEX idx_sinistro_documentos_unique_tipo 
ON sinistro_documentos (sinistro_id, tipo);
```

### Etapa 3: Ajustar o INSERT no dialog para usar upsert

Alterar o `SolicitarDocumentosSinistroDialog.tsx` para usar `.upsert()` com `onConflict` ao inves de `.insert()`, garantindo que mesmo em caso de conflito o registro nao seja duplicado.

## Alteracoes

| Arquivo / Recurso | Descricao |
|---|---|
| Migracao SQL | Remover duplicatas existentes e criar indice UNIQUE |
| `src/components/sinistros/SolicitarDocumentosSinistroDialog.tsx` | Usar upsert com onConflict para prevenir duplicatas |
| `supabase/functions/criar-sinistro/index.ts` | Usar upsert para nao falhar se documentos ja existirem |

