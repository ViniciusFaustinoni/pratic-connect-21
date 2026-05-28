import { Navigate } from 'react-router-dom';
import { Mail, ShieldAlert } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { usePermissions } from '@/hooks/usePermissions';
import { ToggleEnvioSuspensao } from './components/ToggleEnvioSuspensao';
import { TemplateEditor } from './components/TemplateEditor';
import { HistoricoEnvios } from './components/HistoricoEnvios';

export default function EmailsRelacionamento() {
  const { isAdminMaster, isDesenvolvedor } = usePermissions();
  const podeAcessar = isAdminMaster || isDesenvolvedor;

  if (!podeAcessar) {
    return (
      <div className="container max-w-2xl py-12">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground">
              Apenas administradores podem gerenciar os e-mails de suspensão.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6">
      <header className="flex items-center gap-3">
        <div className="rounded-md bg-primary/10 p-2">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">E-mails de suspensão</h1>
          <p className="text-sm text-muted-foreground">
            Configure o template, ative o envio e acompanhe o histórico de e-mails disparados nos fluxos de suspensão.
          </p>
        </div>
      </header>

      <ToggleEnvioSuspensao />

      <Tabs defaultValue="template" className="space-y-4">
        <TabsList>
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="historico">Histórico de envios</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="space-y-4">
          <TemplateEditor />
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <HistoricoEnvios />
        </TabsContent>
      </Tabs>
    </div>
  );
}
