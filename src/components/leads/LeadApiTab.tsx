import { ApiKeysSection } from './ApiKeysSection';
import { WebhookSection } from './WebhookSection';
import { LeadFontesSection } from './LeadFontesSection';

export function LeadApiTab() {
  return (
    <div className="space-y-6">
      <ApiKeysSection />
      <WebhookSection />
      <LeadFontesSection />
    </div>
  );
}