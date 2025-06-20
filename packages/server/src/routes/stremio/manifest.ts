// src/routes/stremio/manifest.ts

import { Router, Request, Response } from 'express';
import {
  AIOStreams,
  APIError,
  constants,
  Env,
  UserData,
  Manifest as AIOManifest,
  createLogger,
} from '@aiostreams/core';
import { stremioManifestRateLimiter } from '../../middlewares/ratelimit';

const logger = createLogger('server');
const router = Router();
export default router;

const buildManifest = async (config?: UserData): Promise<AIOManifest> => {
  // Base addon ID (with optional per-user suffix)
  let addonId = Env.ADDON_ID;
  if (config?.uuid) {
    addonId += `.${config.uuid.substring(0, 12)}`;
  }

  // Default empty arrays
  let catalogs: AIOManifest['catalogs'] = [];
  let resources: AIOManifest['resources'] = [];
  let addonCatalogs: AIOManifest['addonCatalogs'] = [];

  if (config) {
    const aiostreams = new AIOStreams(config, false);
    await aiostreams.initialise();

    catalogs      = aiostreams.getCatalogs();
    resources     = aiostreams.getResources();
    addonCatalogs = aiostreams.getAddonCatalogs();
  }

  return {
    // Core metadata
    id:          addonId,
    name:        config?.addonName    || Env.ADDON_NAME,
    version:     Env.VERSION === 'unknown' ? '0.0.0' : Env.VERSION,
    description: config?.addonDescription || Env.DESCRIPTION,

    // ← Required by Stremio’s schema
    types:      ['movie', 'series'],
    resources,
    idPrefixes: ['tt'],

    // Your catalogs
    catalogs,

    // Optional visuals
    background:
      config?.addonBackground ||
      'https://raw.githubusercontent.com/Viren070/AIOStreams/refs/heads/main/packages/frontend/public/assets/background.png',
    logo:
      config?.addonLogo ||
      'https://raw.githubusercontent.com/Viren070/AIOStreams/refs/heads/main/packages/frontend/public/assets/logo.png',

    // UI hints
    behaviorHints: {
      configurable:           true,
      configurationRequired:  config ? false : true,
    },

    // Any extra “addonCatalogs” you produce
    addonCatalogs,

    // Optional signed-config support
    stremioAddonsConfig:
      Env.STREMIO_ADDONS_CONFIG_ISSUER &&
      Env.STREMIO_ADDONS_CONFIG_SIGNATURE
        ? {
            issuer:    Env.STREMIO_ADDONS_CONFIG_ISSUER,
            signature: Env.STREMIO_ADDONS_CONFIG_SIGNATURE,
          }
        : undefined,
  };
};

router.get(
  '/',
  stremioManifestRateLimiter,
  async (req: Request, res: Response<AIOManifest>, next) => {
    logger.debug('Manifest request received', { userData: req.userData });
    try {
      const m = await buildManifest(req.userData);
      res.status(200).json(m);
    } catch (err) {
      logger.error(`Failed to generate manifest: ${err}`);
      next(new APIError(constants.ErrorCode.INTERNAL_SERVER_ERROR));
    }
  }
);
