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
