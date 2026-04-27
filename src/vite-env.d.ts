/// <reference types="vite/client" />

import type { GroupAIApi } from './shared/types';

declare global {
  interface Window {
    groupAI: GroupAIApi;
  }
}
