import config from '../../../config/ads.json';
import { validateAdsConfig } from './config.js';

export const adsConfig = validateAdsConfig(config);
