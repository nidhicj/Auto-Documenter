export interface ScreenshotData {
  stepIndex: number;
  screenshotBase64: string;
  domEvent: DOMEvent;
  timestamp: number;
}

export interface DOMEvent {
  type: 'click' | 'navigation' | 'dom_change' | 'input' | 'scroll';
  target: {
    tagName: string;
    id?: string;
    className?: string;
    textContent?: string;
    selector?: string;
  };
  url: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface WorkflowEvent {
  id: string;
  events: DOMEvent[];
  screenshots: ScreenshotData[];
  startTime: number;
  endTime?: number;
  url: string;
  title: string;
}

export interface PendingScreenshot {
  stepIndex: number;
  screenshotBase64: string;
  domEvent: DOMEvent;
  timestamp: number;
  retryCount: number;
}

export interface UploadResponse {
  url: string;
  signedUrl: string;
  key: string;
}




