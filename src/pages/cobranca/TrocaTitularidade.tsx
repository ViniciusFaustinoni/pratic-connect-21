import { Navigate } from 'react-router-dom';

// Página descontinuada — toda a fila de troca de titularidade vive agora em
// /cadastro/processos?tab=titularidade (área única de Cadastro › Processos).
export default function TrocaTitularidade() {
  return <Navigate to="/cadastro/processos?tab=titularidade" replace />;
}
