import {
  Html, Head, Body, Container, Section, Text, Button, Hr, Img,
} from '@react-email/components';

type Props = {
  userName: string;
  projectName: string;
  portalUrl: string;
  language?: 'en' | 'es';
};

const t = {
  en: {
    heading: 'Payment failed',
    body: (p: string) => `We couldn't process the payment for your ${p} subscription. Please update your payment method to avoid service interruption.`,
    note: 'Field operations and foreman access remain active. Pro features (Legal Docs, Checklist, Schedule) are temporarily restricted.',
    cta: 'Update Payment Method',
  },
  es: {
    heading: 'Pago fallido',
    body: (p: string) => `No pudimos procesar el pago de tu suscripción para ${p}. Por favor actualiza tu método de pago para evitar interrupciones.`,
    note: 'Las operaciones de campo y el acceso del capataz siguen activos. Las funciones Pro están temporalmente restringidas.',
    cta: 'Actualizar Método de Pago',
  },
};

export function PaymentFailedEmail({ userName, projectName, portalUrl, language = 'en' }: Props) {
  const l = t[language];
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Img src="https://readyboard.ai/readyboard-lockup-dark.svg" alt="ReadyBoard" width={160} style={{ margin: '0 auto 24px' }} />
          <Text style={heading}>{l.heading}</Text>
          <Text style={text}>Hi {userName},</Text>
          <Text style={text}>{l.body(projectName)}</Text>
          <Text style={noteStyle}>{l.note}</Text>
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Button href={portalUrl} style={button}>{l.cta}</Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>ReadyBoard — readyboard.ai</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' };
const container = { maxWidth: '480px', margin: '0 auto', padding: '40px 24px', backgroundColor: '#1e293b', borderRadius: '8px' };
const heading = { color: '#f87171', fontSize: '20px', fontWeight: 'bold' as const, margin: '0 0 16px' };
const text = { color: '#94a3b8', fontSize: '14px', lineHeight: '24px', margin: '0 0 8px' };
const noteStyle = { color: '#64748b', fontSize: '12px', lineHeight: '20px', margin: '12px 0', padding: '12px', backgroundColor: '#0f172a', borderRadius: '6px' };
const button = { backgroundColor: '#dc2626', color: '#fff', padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none' };
const hr = { borderColor: '#334155', margin: '24px 0' };
const footer = { color: '#64748b', fontSize: '12px' };
