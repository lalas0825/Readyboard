import {
  Html, Head, Body, Container, Section, Text, Button, Hr, Img,
} from '@react-email/components';

type Props = {
  recipientName: string;
  projectName: string;
  verifiedCount: number;
  totalAreas: number;
  overallProgress: string;
  topDelays: { area: string; trade: string; cost: string }[];
  dashboardUrl: string;
  weekOf: string;
};

export function VerifiedReportEmail({
  recipientName, projectName, verifiedCount, totalAreas,
  overallProgress, topDelays, dashboardUrl, weekOf,
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

          <Text style={heading}>Weekly Report — {weekOf}</Text>

          <Text style={paragraph}>
            Hi {recipientName}, here is your weekly efficiency summary for <strong style={strong}>{projectName}</strong>.
          </Text>

          {/* Metrics */}
          <Section style={metricsRow}>
            <Section style={metricCard}>
              <Text style={metricValue}>{verifiedCount}</Text>
              <Text style={metricLabel}>Verified</Text>
            </Section>
            <Section style={metricCard}>
              <Text style={metricValue}>{totalAreas}</Text>
              <Text style={metricLabel}>Total Areas</Text>
            </Section>
            <Section style={metricCard}>
              <Text style={metricValue}>{overallProgress}</Text>
              <Text style={metricLabel}>Progress</Text>
            </Section>
          </Section>

          {/* Top delays */}
          {topDelays.length > 0 && (
            <>
              <Text style={sectionTitle}>Active Delays</Text>
              <Section style={detailCard}>
                {topDelays.map((d, i) => (
                  <Text key={i} style={delayRow}>
                    {d.area} — {d.trade}: <span style={costText}>{d.cost}</span>
                  </Text>
                ))}
              </Section>
            </>
          )}

          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
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
const heading = { fontSize: '20px', fontWeight: '700' as const, color: '#f8fafc', textAlign: 'center' as const, margin: '0 0 24px' };
const paragraph = { fontSize: '14px', lineHeight: '24px', color: '#94a3b8', margin: '0 0 16px' };
const strong = { color: '#f8fafc' };
const metricsRow = { display: 'flex' as const, gap: '12px', marginBottom: '24px' };
const metricCard = { flex: '1', backgroundColor: '#1e293b', borderRadius: '8px', padding: '16px', textAlign: 'center' as const };
const metricValue = { fontSize: '24px', fontWeight: '800' as const, color: '#f8fafc', margin: '0 0 4px' };
const metricLabel = { fontSize: '11px', color: '#64748b', margin: '0', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };
const sectionTitle = { fontSize: '11px', fontWeight: '700' as const, color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase' as const, margin: '0 0 12px' };
const detailCard = { backgroundColor: '#1e293b', borderRadius: '8px', padding: '16px', marginBottom: '24px' };
const delayRow = { fontSize: '13px', color: '#cbd5e1', margin: '0 0 8px', lineHeight: '20px' };
const costText = { color: '#f59e0b', fontWeight: '700' as const };
const buttonContainer = { textAlign: 'center' as const, margin: '24px 0' };
const button = { backgroundColor: '#f59e0b', borderRadius: '8px', color: '#0f172a', fontSize: '14px', fontWeight: '600' as const, padding: '12px 32px', textDecoration: 'none' };
const hr = { borderColor: '#1e293b', margin: '32px 0' };
const footer = { fontSize: '11px', color: '#64748b', textAlign: 'center' as const };
