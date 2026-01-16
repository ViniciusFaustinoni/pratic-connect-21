import { useParams, Navigate } from 'react-router-dom';
import { useDocumentoPermissoes } from '@/hooks/useDocumentoPermissoes';

export default function TemplateForm() {
  const { id } = useParams();
  const { podeCriarTemplate, podeEditarTemplate } = useDocumentoPermissoes();

  // Verificar permissão para criar
  if (!id && !podeCriarTemplate) {
    return <Navigate to="/documentos/templates" replace />;
  }

  // Verificar permissão para editar
  if (id && !podeEditarTemplate) {
    return <Navigate to="/documentos/templates" replace />;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{id ? 'Editar Template' : 'Novo Template'}</h1>
      <p className="text-muted-foreground">Em construção...</p>
    </div>
  );
}
