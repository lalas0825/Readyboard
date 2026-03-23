// ─── PDF i18n Text Dictionary ──────────────────────────────
// Single source of all text used in legal PDFs (NOD, REA, Evidence Package).
// No hardcoded strings in builders — everything flows through PDF_TEXTS[locale].

export type PdfLocale = 'en' | 'es';

export type PdfTexts = {
  // Document titles
  nodTitle: string;
  reaTitle: string;
  evidenceTitle: string;
  draftWatermark: string;
  draftNote: string;

  // Section headers
  projectInfo: string;
  delayDetails: string;
  costImpact: string;
  claimSummary: string;
  itemizedCosts: string;
  referencedNods: string;
  authorizedBy: string;
  chronologicalNarrative: string;
  nodsWithReceipts: string;
  reasWithCosts: string;
  gpsVerificationLog: string;
  photoExhibits: string;
  correctiveActionHistory: string;
  financialSummary: string;
  coverTitle: string;

  // Field labels
  project: string;
  address: string;
  jurisdiction: string;
  area: string;
  floor: string;
  trade: string;
  reasonCode: string;
  crewSize: string;
  started: string;
  ended: string;
  ongoing: string;
  duration: string;
  laborRate: string;
  manHours: string;
  dailyCost: string;
  cumulativeCost: string;
  totalClaim: string;
  overhead: string;
  subtotal: string;
  dateRange: string;
  sentAt: string;
  sha256Hash: string;
  status: string;
  workers: string;
  hours: string;
  days: string;
  page: string;
  of: string;
  exhibit: string;

  // Receipt tracking
  receiptOpened: string;
  receiptNotOpened: string;
  openCount: string;
  firstOpenedAt: string;
  ipAddress: string;
  device: string;

  // Corrective action
  caCreated: string;
  caAcknowledged: string;
  caResolved: string;
  responseTime: string;
  noResponse: string;

  // Financial
  byCause: string;
  byParty: string;
  grandTotal: string;

  // GPS
  latitude: string;
  longitude: string;
  timestamp: string;
  deviceId: string;

  // Reason codes
  reasonCodes: Record<string, string>;

  // Footer
  footer: {
    tamperEvident: string;
    documentId: string;
    generated: string;
    verifyAt: string;
  };

  // Signature
  signed: string;
  strokes: string;
  pointsCaptured: string;
  preparedFor: string;
};

const REASON_CODES_EN: Record<string, string> = {
  no_heat: 'No Heat',
  prior_trade: 'Prior Trade Incomplete',
  no_access: 'No Access',
  inspection: 'Inspection Pending',
  plumbing: 'Plumbing Issue',
  material: 'Material Unavailable',
  moisture: 'Moisture Damage',
  safety: 'Safety Concern',
  other: 'Other',
};

const REASON_CODES_ES: Record<string, string> = {
  no_heat: 'Sin Calefacción',
  prior_trade: 'Oficio Anterior Incompleto',
  no_access: 'Sin Acceso',
  inspection: 'Inspección Pendiente',
  plumbing: 'Problema de Plomería',
  material: 'Material No Disponible',
  moisture: 'Daño por Humedad',
  safety: 'Riesgo de Seguridad',
  other: 'Otro',
};

export const PDF_TEXTS: Record<PdfLocale, PdfTexts> = {
  en: {
    nodTitle: 'NOTICE OF DELAY',
    reaTitle: 'REQUEST FOR EQUITABLE ADJUSTMENT',
    evidenceTitle: 'ARBITRATION-READY EVIDENCE PACKAGE',
    draftWatermark: 'DRAFT — PENDING APPROVAL',
    draftNote: 'This document requires authorization before it becomes a legal instrument.',
    projectInfo: 'PROJECT INFORMATION',
    delayDetails: 'DELAY DETAILS',
    costImpact: 'COST IMPACT',
    claimSummary: 'CLAIM SUMMARY',
    itemizedCosts: 'ITEMIZED COST TABLE',
    referencedNods: 'REFERENCED NOTICES OF DELAY',
    authorizedBy: 'AUTHORIZED BY',
    chronologicalNarrative: 'CHRONOLOGICAL DELAY NARRATIVE',
    nodsWithReceipts: 'NOTICES OF DELAY — RECEIPT CONFIRMATIONS',
    reasWithCosts: 'REQUESTS FOR EQUITABLE ADJUSTMENT',
    gpsVerificationLog: 'GPS VERIFICATION LOG',
    photoExhibits: 'PHOTO EXHIBITS',
    correctiveActionHistory: 'CORRECTIVE ACTION HISTORY',
    financialSummary: 'FINANCIAL SUMMARY',
    coverTitle: 'EVIDENCE PACKAGE',
    project: 'Project',
    address: 'Address',
    jurisdiction: 'Jurisdiction',
    area: 'Area',
    floor: 'Floor',
    trade: 'Trade',
    reasonCode: 'Reason Code',
    crewSize: 'Crew Size',
    started: 'Started',
    ended: 'Ended',
    ongoing: 'ONGOING',
    duration: 'Duration',
    laborRate: 'Labor Rate',
    manHours: 'Man-Hours',
    dailyCost: 'Daily Cost',
    cumulativeCost: 'Cumulative Cost',
    totalClaim: 'Total Claim Amount',
    overhead: 'Overhead',
    subtotal: 'Subtotal',
    dateRange: 'Date Range',
    sentAt: 'Sent',
    sha256Hash: 'SHA-256 Hash',
    status: 'Status',
    workers: 'workers',
    hours: 'hrs',
    days: 'days',
    page: 'Page',
    of: 'of',
    exhibit: 'Exhibit',
    receiptOpened: 'Opened',
    receiptNotOpened: 'Not Yet Opened',
    openCount: 'View Count',
    firstOpenedAt: 'First Opened',
    ipAddress: 'IP Address',
    device: 'Device',
    caCreated: 'Created',
    caAcknowledged: 'Acknowledged',
    caResolved: 'Resolved',
    responseTime: 'Response Time',
    noResponse: 'No Response',
    byCause: 'By Cause',
    byParty: 'By Responsible Party',
    grandTotal: 'Grand Total',
    latitude: 'Latitude',
    longitude: 'Longitude',
    timestamp: 'Timestamp',
    deviceId: 'Device ID',
    reasonCodes: REASON_CODES_EN,
    footer: {
      tamperEvident: 'READYBOARD LEGAL ENGINE — TAMPER-EVIDENT DOCUMENT',
      documentId: 'Document ID',
      generated: 'Generated',
      verifyAt: 'Verify integrity at',
    },
    signed: 'Signed',
    strokes: 'strokes',
    pointsCaptured: 'points captured',
    preparedFor: 'Prepared for',
  },
  es: {
    nodTitle: 'NOTIFICACIÓN DE RETRASO',
    reaTitle: 'SOLICITUD DE AJUSTE EQUITATIVO',
    evidenceTitle: 'PAQUETE DE EVIDENCIA PARA ARBITRAJE',
    draftWatermark: 'BORRADOR — PENDIENTE DE APROBACIÓN',
    draftNote: 'Este documento requiere autorización antes de convertirse en instrumento legal.',
    projectInfo: 'INFORMACIÓN DEL PROYECTO',
    delayDetails: 'DETALLES DEL RETRASO',
    costImpact: 'IMPACTO DE COSTOS',
    claimSummary: 'RESUMEN DEL RECLAMO',
    itemizedCosts: 'TABLA DE COSTOS DETALLADA',
    referencedNods: 'NOTIFICACIONES DE RETRASO REFERENCIADAS',
    authorizedBy: 'AUTORIZADO POR',
    chronologicalNarrative: 'NARRATIVA CRONOLÓGICA DE RETRASOS',
    nodsWithReceipts: 'NOTIFICACIONES — CONFIRMACIONES DE RECIBO',
    reasWithCosts: 'SOLICITUDES DE AJUSTE EQUITATIVO',
    gpsVerificationLog: 'REGISTRO DE VERIFICACIÓN GPS',
    photoExhibits: 'EXHIBICIONES FOTOGRÁFICAS',
    correctiveActionHistory: 'HISTORIAL DE ACCIONES CORRECTIVAS',
    financialSummary: 'RESUMEN FINANCIERO',
    coverTitle: 'PAQUETE DE EVIDENCIA',
    project: 'Proyecto',
    address: 'Dirección',
    jurisdiction: 'Jurisdicción',
    area: 'Área',
    floor: 'Piso',
    trade: 'Oficio',
    reasonCode: 'Código de Razón',
    crewSize: 'Tamaño de Cuadrilla',
    started: 'Inicio',
    ended: 'Fin',
    ongoing: 'EN CURSO',
    duration: 'Duración',
    laborRate: 'Tarifa Laboral',
    manHours: 'Horas-Hombre',
    dailyCost: 'Costo Diario',
    cumulativeCost: 'Costo Acumulado',
    totalClaim: 'Monto Total del Reclamo',
    overhead: 'Gastos Generales',
    subtotal: 'Subtotal',
    dateRange: 'Rango de Fechas',
    sentAt: 'Enviado',
    sha256Hash: 'Hash SHA-256',
    status: 'Estado',
    workers: 'trabajadores',
    hours: 'hrs',
    days: 'días',
    page: 'Página',
    of: 'de',
    exhibit: 'Exhibición',
    receiptOpened: 'Abierto',
    receiptNotOpened: 'Aún No Abierto',
    openCount: 'Número de Vistas',
    firstOpenedAt: 'Primera Apertura',
    ipAddress: 'Dirección IP',
    device: 'Dispositivo',
    caCreated: 'Creada',
    caAcknowledged: 'Reconocida',
    caResolved: 'Resuelta',
    responseTime: 'Tiempo de Respuesta',
    noResponse: 'Sin Respuesta',
    byCause: 'Por Causa',
    byParty: 'Por Parte Responsable',
    grandTotal: 'Total General',
    latitude: 'Latitud',
    longitude: 'Longitud',
    timestamp: 'Marca de Tiempo',
    deviceId: 'ID de Dispositivo',
    reasonCodes: REASON_CODES_ES,
    footer: {
      tamperEvident: 'MOTOR LEGAL READYBOARD — DOCUMENTO A PRUEBA DE MANIPULACIÓN',
      documentId: 'ID del Documento',
      generated: 'Generado',
      verifyAt: 'Verificar integridad en',
    },
    signed: 'Firmado',
    strokes: 'trazos',
    pointsCaptured: 'puntos capturados',
    preparedFor: 'Preparado para',
  },
};
