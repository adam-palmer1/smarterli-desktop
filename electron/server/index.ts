/**
 * Server communication layer barrel exports.
 *
 * These modules replace direct LLM/STT/DB calls with server proxies,
 * enabling the Electron client to communicate with the Smarter.li server.
 */

export { ServerClient, ServerClientError } from './ServerClient';
export type {
  LoginResponse,
  RegisterResponse,
  RefreshResponse,
  BalanceResponse,
  PlanInfo,
  UsageItem,
  MeetingListItem,
  MeetingDetail,
  HealthResponse,
  UserInfo,
} from './ServerClient';

export { AudioStreamer } from './AudioStreamer';
export type {
  TranscriptEvent,
  CreditUpdateEvent,
  SessionStartedEvent,
  SessionTerminatedEvent,
  AudioStreamerEvents,
} from './AudioStreamer';

export { IntelligenceClient } from './IntelligenceClient';
export type {
  IntelligenceTokenEvent,
  IntelligenceDoneEvent,
  IntelligenceErrorEvent,
  IntelligenceClientEvents,
} from './IntelligenceClient';

export { PanelClient } from './PanelClient';
export type {
  PanelTokenEvent,
  PanelCompleteEvent,
  PanelErrorEvent,
  PanelClientEvents,
} from './PanelClient';
