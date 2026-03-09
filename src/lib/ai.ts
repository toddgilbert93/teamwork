import { gateway } from '@ai-sdk/gateway';
import { PERSONA_MODELS, DEFAULT_MODEL } from './constants';

export function getModel(personaName: string) {
  const modelId = PERSONA_MODELS[personaName] ?? DEFAULT_MODEL;
  return gateway(modelId);
}
