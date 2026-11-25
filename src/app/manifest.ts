import type { MetadataRoute } from 'next';
import { buildManifest } from '@/shared/pwa/manifest';

export default function manifest(): MetadataRoute.Manifest {
  return buildManifest();
}
