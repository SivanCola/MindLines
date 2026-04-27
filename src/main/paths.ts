import path from 'node:path';

export function manifestPath(workspacePath: string): string {
  return path.join(workspacePath, '.mindline', 'manifest.json');
}

export function topicsRootDir(workspacePath: string): string {
  return path.join(workspacePath, 'topics');
}

export function topicDir(workspacePath: string, topicPath: string): string {
  return path.join(workspacePath, 'phases', topicPath);
}

export function topicJsonPath(workspacePath: string, topicPath: string): string {
  return path.join(topicDir(workspacePath, topicPath), 'topic.json');
}

export function messagesPath(workspacePath: string, topicPath: string): string {
  return path.join(topicDir(workspacePath, topicPath), 'messages.md');
}

export function topicSummaryPath(workspacePath: string, topicPath: string): string {
  return path.join(topicDir(workspacePath, topicPath), 'summary.md');
}

export function phaseDir(workspacePath: string, phaseId: string): string {
  return path.join(workspacePath, 'phases', phaseId);
}

export function phaseJsonPath(workspacePath: string, phaseId: string): string {
  return path.join(phaseDir(workspacePath, phaseId), 'phase.json');
}

export function phaseSummaryPath(workspacePath: string, phaseId: string): string {
  return path.join(phaseDir(workspacePath, phaseId), 'summary.md');
}

export function secretsDir(workspacePath: string): string {
  return path.join(workspacePath, '.groupai', 'secrets');
}

export function modelProviderSettingsDir(appHomePath: string): string {
  return path.join(appHomePath, 'model-providers');
}

export function modelProvidersPath(appHomePath: string): string {
  return path.join(modelProviderSettingsDir(appHomePath), 'config.json');
}

export function modelProviderSecretsDir(appHomePath: string): string {
  return path.join(modelProviderSettingsDir(appHomePath), 'secrets');
}

export function modelProviderSecretPath(appHomePath: string, providerId: string): string {
  return path.join(modelProviderSecretsDir(appHomePath), `${providerId}.json`);
}

export function splitSettingsModelProvidersPath(appHomePath: string): string {
  return path.join(appHomePath, 'settings', 'model-providers.json');
}

export function splitSettingsModelProviderSecretsDir(appHomePath: string): string {
  return path.join(appHomePath, 'secrets', 'model-providers');
}

export function legacyModelProvidersPath(rootPath: string): string {
  return path.join(rootPath, '.groupai', 'model-providers.json');
}

export function legacyModelProviderSecretsDir(rootPath: string): string {
  return path.join(rootPath, '.groupai', 'secrets', 'model-providers');
}

export function legacyModelProviderSecretPath(rootPath: string, providerId: string): string {
  return path.join(legacyModelProviderSecretsDir(rootPath), `${providerId}.json`);
}
