import { z } from 'zod';

const unset = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((value) => value ?? null);

const handoffTargetSchema = z.object({
  clientId: z.string().min(1),
  name: unset(z.string()),
  rootUrl: unset(z.string()),
  /** Keycloak's own verdict on the origin rule; absent from older answers. */
  originAllowed: unset(z.boolean()),
  enabled: unset(z.boolean()),
  signInPath: unset(z.string()),
  returnParam: unset(z.string()),
});

const handoffTargetInputSchema = z.object({
  enabled: z.boolean(),
  signInPath: z.string(),
  returnParam: z.string(),
});

/** A Keycloak client as the sky-handoff admin API reports it; unset attributes are null. */
export type HandoffTarget = z.output<typeof handoffTargetSchema>;

/** The only fields superadmin may change on a target (`PUT /v1/admin/targets/{clientId}`). */
export type HandoffTargetInput = z.output<typeof handoffTargetInputSchema>;

/** A target as the admin API answered it, or `null` when the answer does not have its shape. */
export function parseHandoffTarget(body: unknown): HandoffTarget | null {
  const parsed = handoffTargetSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

const handoffTargetListSchema = z.union([
  // Keycloak answers `GET /v1/admin/targets` with `{"targets": [...]}`.
  z.object({ targets: z.array(handoffTargetSchema) }).transform((body) => body.targets),
  z.array(handoffTargetSchema),
]);

/**
 * The admin API's target list, or `null` when the answer does not have its shape. Clients
 * whose root URL may become a target come first, each group ordered by client id.
 */
export function parseHandoffTargets(body: unknown): HandoffTarget[] | null {
  const parsed = handoffTargetListSchema.safeParse(body);
  if (!parsed.success) return null;
  return [...parsed.data].sort(
    (a, b) =>
      Number(Boolean(b.originAllowed)) - Number(Boolean(a.originAllowed)) ||
      a.clientId.localeCompare(b.clientId),
  );
}

/** Keeps exactly the three writable fields, or `null` when the body does not have their shape. */
export function parseHandoffTargetInput(body: unknown): HandoffTargetInput | null {
  const parsed = handoffTargetInputSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

export type HandoffTargetErrors = {
  signInPath?: string;
  returnParam?: string;
  /** Problems with the client itself rather than a typed field. */
  target?: string;
};

// Kept in step with HandoffRules in e-skylab-keycloak (spi/.../handoff/HandoffRules.java).
const RETURN_PARAM = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const SIGN_IN_PATH_CHARACTERS = /^[A-Za-z0-9._~/-]*$/;
const MAX_SIGN_IN_PATH_LENGTH = 128;
const HANDOFF_DOMAIN = 'yildizskylab.com';
const HANDOFF_HOST = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*yildizskylab\.com$/;

export const ROOT_URL_OUTSIDE_DOMAIN = `Kök adres https://*.${HANDOFF_DOMAIN} değil; açılamaz.`;

function signInPathError(value: string, enabled: boolean): string | undefined {
  if (!value) return enabled ? 'Giriş kapısı yolu gerekli.' : undefined;
  if (!value.startsWith('/')) return 'Giriş kapısı yolu "/" ile başlamalı.';
  if (value.includes('//') || value.includes('\\') || value.includes('..')) {
    return 'Giriş kapısı yolu "//", "\\" veya ".." içeremez.';
  }
  if (value.includes('?') || value.includes('#')) {
    return 'Giriş kapısı yolu "?" veya "#" içeremez; parametreyi dönüş parametresine yaz.';
  }
  if (!SIGN_IN_PATH_CHARACTERS.test(value)) {
    return 'Giriş kapısı yolu yalnız harf, rakam, "/" ve . _ ~ - içerebilir.';
  }
  if (value.split('/').includes('.')) return 'Giriş kapısı yolunda "." bölümü olamaz.';
  if (value.length > MAX_SIGN_IN_PATH_LENGTH) {
    return `Giriş kapısı yolu en çok ${MAX_SIGN_IN_PATH_LENGTH} karakter olabilir.`;
  }
  return undefined;
}

function returnParamError(value: string, enabled: boolean): string | undefined {
  if (!value) return enabled ? 'Dönüş parametresi gerekli.' : undefined;
  if (!RETURN_PARAM.test(value)) {
    return 'Dönüş parametresi harfle başlamalı; yalnız harf, rakam ve _ içerebilir (en çok 32).';
  }
  return undefined;
}

/**
 * The origin rule: `https://` on yildizskylab.com or a subdomain, with no userinfo, port,
 * path other than `/`, query or fragment.
 */
export function rootUrlAllowsHandoff(rootUrl: string | null): boolean {
  if (!rootUrl?.startsWith('https://')) return false;
  const rest = rootUrl.slice('https://'.length);
  const slash = rest.indexOf('/');
  const authority = slash === -1 ? rest : rest.slice(0, slash);
  const path = slash === -1 ? '' : rest.slice(slash);
  if (path !== '' && path !== '/') return false;
  return HANDOFF_HOST.test(authority.toLowerCase());
}

/**
 * Mirrors the sky-handoff admin API's rules so mistakes show before saving; Keycloak still
 * decides. An empty field only matters when the target is being enabled.
 */
export function handoffTargetErrors(
  input: HandoffTargetInput,
  rootUrl: string | null,
): HandoffTargetErrors {
  const errors: HandoffTargetErrors = {};
  const signInPath = signInPathError(input.signInPath, input.enabled);
  const returnParam = returnParamError(input.returnParam, input.enabled);
  if (signInPath) errors.signInPath = signInPath;
  if (returnParam) errors.returnParam = returnParam;
  if (input.enabled && !rootUrlAllowsHandoff(rootUrl)) errors.target = ROOT_URL_OUTSIDE_DOMAIN;
  return errors;
}
