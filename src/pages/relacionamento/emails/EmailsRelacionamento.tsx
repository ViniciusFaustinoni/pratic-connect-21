import { useState } from 'react';
import { Mail, ShieldAlert, Send } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { ToggleEnvioSuspensao } from './components/ToggleEnvioSuspensao';
import { TemplatesList } from './components/TemplatesList';
import { HistoricoEnvios } from './components/HistoricoEnvios';
import { EnviarTesteDialog } from './components/EnviarTesteDialog';

export default function EmailsRelacionamento() {
  const { isAdminMaster, isDesenvolvedor, isDiretor } = usePermissions();
  const podeAcessar = isAdminMaster || isDesenvolvedor || isDiretor;
  const [testeOpen, setTesteOpen] = useState(false);

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
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">E-mails de suspensão</h1>
            <p className="text-sm text-muted-foreground">
              Configure o template, ative o envio e acompanhe o histórico de e-mails disparados nos fluxos de suspensão.
            </p>
          </div>
        </div>
        <Button onClick={() => setTesteOpen(true)}>
          <Send className="mr-2 h-4 w-4" />
          Enviar e-mail de teste
        </Button>
      </header>

      <ToggleEnvioSuspensao />

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="historico">Histórico de envios</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <TemplatesList />
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <HistoricoEnvios />
        </TabsContent>
      </Tabs>

      <EnviarTesteDialog open={testeOpen} onOpenChange={setTesteOpen} />
    </div>
  );
}

