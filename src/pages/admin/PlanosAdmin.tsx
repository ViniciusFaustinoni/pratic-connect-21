import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/hooks/usePermissions';
import { Package, Gift, Shield, Layers } from 'lucide-react';
import { PlanosTab } from '@/components/admin/planos/PlanosTab';
import { BeneficiosTab } from '@/components/admin/planos/BeneficiosTab';
import { CoberturasTab } from '@/components/admin/planos/CoberturasTab';
import { LinhasTab } from '@/components/admin/planos/LinhasTab';

export default function PlanosAdmin() {
  const navigate = useNavigate();
  const { isDiretor, isDesenvolvedor, isAdminMaster } = usePermissions();

  // Access control - only admin, diretor, desenvolvedor
  const hasAccess = isDiretor || isDesenvolvedor || isAdminMaster;

  useEffect(() => {
    if (!hasAccess) {
      navigate('/dashboard', { replace: true });
    }
  }, [hasAccess, navigate]);

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Gestão de Planos</h1>
        <p className="text-muted-foreground">
          Gerencie planos, benefícios, coberturas e linhas de produtos
        </p>
      </header>

      <Tabs defaultValue="planos" className="space-y-4">
        <TabsList className="bg-muted/50 rounded-lg p-1">
          <TabsTrigger value="planos" className="gap-2">
            <Package className="h-4 w-4" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="beneficios" className="gap-2">
            <Gift className="h-4 w-4" />
            Benefícios
          </TabsTrigger>
          <TabsTrigger value="coberturas" className="gap-2">
            <Shield className="h-4 w-4" />
            Coberturas
          </TabsTrigger>
          <TabsTrigger value="linhas" className="gap-2">
            <Layers className="h-4 w-4" />
            Linhas de Produtos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planos">
          <PlanosTab />
        </TabsContent>
        <TabsContent value="beneficios">
          <BeneficiosTab />
        </TabsContent>
        <TabsContent value="coberturas">
          <CoberturasTab />
        </TabsContent>
        <TabsContent value="linhas">
          <LinhasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
