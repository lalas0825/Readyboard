import {
  Html, Head, Body, Container, Section, Text, Button, Hr, Img,
} from '@react-email/components';

type Props = {
  userName: string;
  daysLeft: number;
  billingUrl: string;
  language?: 'en' | 'es';
};

const t = {
  en: {
    heading: (d: number) => d === 1 ? 'Your trial ends tomorrow' : `Your trial ends in ${d} days`,
    body: 'Upgrade now to keep access to Legal Docs, Checklist Mode, Schedule Import, and all Pro features.',
    cta: 'Upgrade Now',
    footer: 'If you don\'t upgrade, your project will revert to the Starter plan.',
  },
  es: {
    heading: (d: number) => d === 1 ? 'Tu prueba termina mañana' : `Tu prueba termina en ${d} días`,
    body: 'Actualiza ahora para mantener acceso a Documentos Legales, Modo Checklist, Importación de Cronograma y todas las funciones Pro.',
    cta: 'Actualizar Ahora',
    footer: 'Si no actualizas, tu proyecto volverá al plan Starter.',
  },
};

export function TrialEndingEmail({ userName, daysLeft, billingUrl, language = 'en' }: Props) {
  const l = t[language];
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Img src="https://readyboard.ai/readyboard-lockup-dark.svg" alt="ReadyBoard" width={160} style={{ margin: '0 auto 24px' }} />
          <Text style={heading}>{l.heading(daysLeft)}</Text>
          <Text style={text}>Hi {userName},</Text>
          <Text style={text}>{l.body}</Text>
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Button href={billingUrl} style={button}>{l.cta}</Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>{l.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' };
const container = { maxWidth: '480px', margin: '0 auto', padding: '40px 24px', backgroundColor: '#1e293b', borderRadius: '8px' };
const heading = { color: '#fbbf24', fontSize: '20px', fontWeight: 'bold' as const, margin: '0 0 16px' };
const text = { color: '#94a3b8', fontSize: '14px', lineHeight: '24px', margin: '0 0 8px' };
const button = { backgroundColor: '#059669', color: '#fff', padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none' };
const hr = { borderColor: '#334155', margin: '24px 0' };
const footer = { color: '#64748b', fontSize: '12px' };
