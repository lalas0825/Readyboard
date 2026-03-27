import {
  Html, Head, Body, Container, Section, Text, Button, Hr, Img,
} from '@react-email/components';

type Props = {
  recipientName: string;
  projectName: string;
  areaName: string;
  tradeName: string;
  reasonCode: string;
  dailyCost: string;
  cumulativeCost: string;
  signedAt: string;
  hash: string;
  verifyUrl: string;
  dashboardUrl: string;
  trackingPixelUrl: string;
  language?: 'en' | 'es';
};

const t = {
  en: {
    subject: 'Notice of Delay — Formal Notification',
    heading: 'Notice of Delay (NOD)',
    body: 'A formal Notice of Delay has been issued for the following:',
    area: 'Area',
    trade: 'Trade',
    reason: 'Reason',
    daily: 'Daily Cost',
    total: 'Accumulated Cost',
    signed: 'Signed',
    verify: 'Verify Document Authenticity',
    cta: 'View in Dashboard',
    hash: 'Document Hash (SHA-256)',
    footer: 'This is an automated notification. The attached document is legally binding.',
  },
  es: {
    subject: 'Aviso de Retraso — Notificación Formal',
    heading: 'Aviso de Retraso (NOD)',
    body: 'Se ha emitido un Aviso de Retraso formal para lo siguiente:',
    area: 'Área',
    trade: 'Oficio',
    reason: 'Razón',
    daily: 'Costo Diario',
    total: 'Costo Acumulado',
    signed: 'Firmado',
    verify: 'Verificar Autenticidad del Documento',
    cta: 'Ver en Dashboard',
    hash: 'Hash del Documento (SHA-256)',
    footer: 'Esta es una notificación automática. El documento adjunto es legalmente vinculante.',
  },
};

export function NodSentEmail(props: Props) {
  const l = t[props.language ?? 'en'];
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Img src="https://readyboard.ai/readyboard-lockup-dark.svg" alt="ReadyBoard" width={160} style={{ margin: '0 auto 24px' }} />
          <Text style={heading}>{l.heading}</Text>
          <Text style={text}>{l.body}</Text>

          <Section style={detailBox}>
            <Text style={detailRow}><strong>{l.area}:</strong> {props.areaName}</Text>
            <Text style={detailRow}><strong>{l.trade}:</strong> {props.tradeName}</Text>
            <Text style={detailRow}><strong>{l.reason}:</strong> {props.reasonCode}</Text>
            <Text style={detailRow}><strong>{l.daily}:</strong> {props.dailyCost}</Text>
            <Text style={detailRow}><strong>{l.total}:</strong> {props.cumulativeCost}</Text>
            <Text style={detailRow}><strong>{l.signed}:</strong> {props.signedAt}</Text>
          </Section>

          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Button href={props.dashboardUrl} style={button}>{l.cta}</Button>
          </Section>

          <Hr style={hr} />
          <Text style={hashText}>{l.hash}:</Text>
          <Text style={hashValue}>{props.hash}</Text>
          <Text style={verifyLink}>
            <a href={props.verifyUrl} style={{ color: '#60a5fa' }}>{l.verify}</a>
          </Text>

          <Hr style={hr} />
          <Text style={footer}>{l.footer}</Text>
          <Text style={footer}>{props.projectName}</Text>

          {/* Tracking pixel — fire-and-forget receipt tracking */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.trackingPixelUrl} alt="" width={1} height={1} style={{ border: 0 }} />
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' };
const container = { maxWidth: '480px', margin: '0 auto', padding: '40px 24px', backgroundColor: '#1e293b', borderRadius: '8px' };
const heading = { color: '#f87171', fontSize: '20px', fontWeight: 'bold' as const, margin: '0 0 16px' };
const text = { color: '#94a3b8', fontSize: '14px', lineHeight: '24px', margin: '0 0 8px' };
const detailBox = { backgroundColor: '#0f172a', borderRadius: '6px', padding: '16px', margin: '16px 0' };
const detailRow = { color: '#cbd5e1', fontSize: '13px', lineHeight: '22px', margin: '0' };
const button = { backgroundColor: '#059669', color: '#fff', padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none' };
const hr = { borderColor: '#334155', margin: '24px 0' };
const hashText = { color: '#64748b', fontSize: '10px', margin: '0 0 4px' };
const hashValue = { color: '#94a3b8', fontSize: '10px', fontFamily: 'monospace', wordBreak: 'break-all' as const, margin: '0 0 8px' };
const verifyLink = { fontSize: '11px', margin: '0' };
const footer = { color: '#64748b', fontSize: '12px' };
