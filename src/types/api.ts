export interface CreateHookResponse {
  id: string;
  url: string;
  dashboardUrl: string;
  createdAt: string;
}

export interface HookSummary {
  id: string;
  name: string | null;
  createdAt: string;
}

export interface RequestSummary {
  id: string;
  method: string;
  path: string;
  contentType: string | null;
  bodySize: number;
  attachmentCount: number;
  createdAt: string;
}

export interface RequestDetail extends RequestSummary {
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  body: string | null;
  bodyTruncated: boolean;
  ip: string | null;
  userAgent: string | null;
  attachments: Array<{
    id: string;
    fieldName: string | null;
    fileName: string | null;
    contentType: string | null;
    size: number;
  }>;
}
