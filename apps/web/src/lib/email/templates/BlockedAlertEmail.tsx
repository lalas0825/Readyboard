import {
  Html, Head, Body, Container, Section, Text, Button, Hr, Img,
} from '@react-email/components';

type Props = {
  recipientName: string;
  projectName: string;
  areaName: string;
  tradeName: string;
  reasonCode: string;
  blockedSince: string;
  dailyCost: string;
  dashboardUrl: string;
};

export function BlockedAlertEmail({
  recipientName, projectName, areaName, tradeName,
  reasonCode, blockedSince, dailyCost, dashboardUrl,
}: Props) {
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

          <Section style={alertBanner}>
            <Text style={alertText}>AREA BLOCKED</Text>
          </Section>

          <Text style={paragraph}>
            Hi {recipientName},
          </Text>
          <Text style={paragraph}>
            A blockage has been reported on <strong style={strong}>{projectName}</strong>:
          </Text>

          <Section style={detailCard}>
            <Text style={detailRow}><span style={label}>Area:</span> {areaName}</Text>
            <Text style={detailRow}><span style={label}>Trade:</span> {tradeName}</Text>
            <Text style={detailRow}><span style={label}>Reason:</span> {reasonCode}</Text>
            <Text style={detailRow}><span style={label}>Since:</span> {blockedSince}</Text>
            <Text style={detailRow}><span style={label}>Daily Cost:</span> <span style={costText}>{dailyCost}</span></Text>
          </Section>

          <Text style={paragraph}>
            Action required: Review the delay and assign a corrective action or generate a NOD.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
              View in Dashboard
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            ReadyBoard — Automated delay documentation for commercial construction.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#0f172a', fontFamily: '-apple-system, sans-serif' };
const container = { margin: '0 auto', padding: '40px 24px', maxWidth: '480px' };
const logo = { margin: '0 auto 24px' };
const alertBanner = { backgroundColor: '#450a0a', borderRadius: '8px', padding: '12px', textAlign: 'center' as const, marginBottom: '24px', border: '1px solid #ef444440' };
const alertText = { fontSize: '12px', fontWeight: '700' as const, color: '#ef4444', letterSpacing: '1px', margin: '0' };
const paragraph = { fontSize: '14px', lineHeight: '24px', color: '#94a3b8', margin: '0 0 16px' };
const strong = { color: '#f8fafc' };
const detailCard = { backgroundColor: '#1e293b', borderRadius: '8px', padding: '16px', marginBottom: '16px' };
const detailRow = { fontSize: '13px', color: '#cbd5e1', margin: '0 0 8px', lineHeight: '20px' };
const label = { color: '#64748b', fontWeight: '500' as const };
const costText = { color: '#f59e0b', fontWeight: '700' as const };
const buttonContainer = { textAlign: 'center' as const, margin: '24px 0' };
const button = { backgroundColor: '#ef4444', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '600' as const, padding: '12px 32px', textDecoration: 'none' };
const hr = { borderColor: '#1e293b', margin: '32px 0' };
const footer = { fontSize: '11px', color: '#64748b', textAlign: 'center' as const };
