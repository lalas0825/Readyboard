import {
  Html, Head, Body, Container, Section, Text, Button, Hr, Img,
} from '@react-email/components';

type Props = {
  inviterName: string;
  projectName: string;
  role: string;
  joinUrl: string;
  language?: 'en' | 'es';
};

const t = {
  en: {
    subject: 'You\'ve been invited to ReadyBoard',
    invited: 'has invited you to join',
    role: 'Your role:',
    cta: 'Accept Invitation',
    expires: 'This invitation expires in 7 days.',
  },
  es: {
    subject: 'Te han invitado a ReadyBoard',
    invited: 'te ha invitado a unirte a',
    role: 'Tu rol:',
    cta: 'Aceptar Invitación',
    expires: 'Esta invitación expira en 7 días.',
  },
};

export function TeamInviteEmail({ inviterName, projectName, role, joinUrl, language = 'en' }: Props) {
  const l = t[language];
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Img src="https://readyboard.ai/readyboard-lockup-dark.svg" alt="ReadyBoard" width={160} style={{ margin: '0 auto 24px' }} />
          <Text style={heading}>{l.subject}</Text>
          <Text style={text}><strong>{inviterName}</strong> {l.invited} <strong>{projectName}</strong>.</Text>
          <Text style={text}>{l.role} <strong>{role.replace('_', ' ')}</strong></Text>
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Button href={joinUrl} style={button}>{l.cta}</Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>{l.expires}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' };
const container = { maxWidth: '480px', margin: '0 auto', padding: '40px 24px', backgroundColor: '#1e293b', borderRadius: '8px' };
const heading = { color: '#f1f5f9', fontSize: '20px', fontWeight: 'bold' as const, margin: '0 0 16px' };
const text = { color: '#94a3b8', fontSize: '14px', lineHeight: '24px', margin: '0 0 8px' };
const button = { backgroundColor: '#059669', color: '#fff', padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none' };
const hr = { borderColor: '#334155', margin: '24px 0' };
const footer = { color: '#64748b', fontSize: '12px' };
