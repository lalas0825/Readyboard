export { scanThresholds, authorizeDraft } from './services/thresholdEngine';
export type {
  LegalStatus,
  LegalTrigger,
  ThresholdResult,
  ThresholdScanResult,
  AuthorizeDraftResult,
} from './services/thresholdEngine';

export { uploadEvidence, getEvidenceInfo, verifyEvidenceIntegrity } from './services/evidenceStorage';
export type {
  SignatureInput,
  UploadEvidenceResult,
  EvidenceInfo,
} from './services/evidenceStorage';

export { assembleAndUpload } from './services/pdfAssembler';
export type {
  AssembleDocInput,
  AssembleDocResult,
} from './services/pdfAssembler';

export { generateNodDraft, approveNodDraft } from './services/nodAutoGen';
export type {
  GenerateDraftResult,
  ApproveNodResult,
  NodDraftContent,
} from './services/nodAutoGen';

export { SignaturePad } from './components/SignaturePad';
export type {
  SignatureData,
  SignatureMetadata,
} from './components/SignaturePad';

export { buildReaPdf } from './services/reaBuilder';
export type {
  ReaContext,
  ReaDelayItem,
  ReaNodReference,
} from './services/reaBuilder';

export { generateRea } from './services/generateRea';
export type {
  GenerateReaInput,
  GenerateReaResult,
} from './services/generateRea';

export { buildEvidencePackagePdf } from './services/evidencePackageBuilder';
export type {
  EvidencePackageContext,
  EvidenceDelay,
  EvidenceNod,
  EvidenceRea,
  EvidenceFieldReport,
  EvidenceCa,
} from './services/evidencePackageBuilder';

export { generateEvidencePackage } from './services/generateEvidencePackage';
export type {
  GenerateEvidencePackageInput,
  GenerateEvidencePackageResult,
} from './services/generateEvidencePackage';

export { checkEscalations } from './services/escalationCheck';
export type {
  EscalationResult,
  EscalationNotification,
} from './services/escalationCheck';

export type { PdfLocale } from './services/pdfTexts';
