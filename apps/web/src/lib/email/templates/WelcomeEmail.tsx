import {
  Html, Head, Body, Container, Section, Text, Button, Hr, Img,
} from '@react-email/components';

type Props = {
  userName: string;
  loginUrl: string;
  role: string;
};

export function WelcomeEmail({ userName, loginUrl, role }: Props) {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Img
            src="https://readyboard.ai/readyboard-lockup-dark.svg"
            alt="ReadyBoard"
            width={160}
            height={40}
            style={logo}
          />

          <Text style={heading}>Welcome to ReadyBoard</Text>

          <Text style={paragraph}>
            Hi {userName},
          </Text>
          <Text style={paragraph}>
            Your {role === 'gc_admin' ? 'GC Admin' : role === 'sub_pm' ? 'Sub PM' : 'team'} account
            is ready. ReadyBoard tells every trade what areas they can work today, alerts when
            something changes, and auto-documents every lost day as legal evidence.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={loginUrl}>
              Open Dashboard
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            ReadyBoard — Legal infrastructure for commercial construction.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#0f172a', fontFamily: '-apple-system, sans-serif' };
const container = { margin: '0 auto', padding: '40px 24px', maxWidth: '480px' };
const logo = { margin: '0 auto 24px' };
const heading = { fontSize: '24px', fontWeight: '700' as const, color: '#f8fafc', textAlign: 'center' as const, margin: '0 0 24px' };
const paragraph = { fontSize: '14px', lineHeight: '24px', color: '#94a3b8', margin: '0 0 16px' };
const buttonContainer = { textAlign: 'center' as const, margin: '24px 0' };
const button = { backgroundColor: '#f59e0b', borderRadius: '8px', color: '#0f172a', fontSize: '14px', fontWeight: '600' as const, padding: '12px 32px', textDecoration: 'none' };
const hr = { borderColor: '#1e293b', margin: '32px 0' };
const footer = { fontSize: '11px', color: '#64748b', textAlign: 'center' as const };
