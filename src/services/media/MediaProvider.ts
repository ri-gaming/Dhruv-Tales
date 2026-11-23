import type { Episode, MediaProviderType, MediaRef, UserProfile } from '../../types';

export interface MediaPlaybackResolution {
  url: string;
  mimeType: string;
  provider: MediaProviderType;
  isSimulatedMedia: boolean;
  label: string;
}

export interface MediaUploadMetadata {
  storyId?: string;
  episodeId?: string;
  title?: string;
}

/**
 * Provider-agnostic MediaProvider contract.
 * Episodes store only `mediaRef: { provider, id, type }` — never hardcoded cloud URLs.
 * Switching to Google Drive, YouTube, GCS, or Cloudflare Stream later only requires
 * implementing this interface without changing UI or Firestore story/episode schemas.
 */
export interface MediaProvider {
  readonly providerType: MediaProviderType;
  readonly displayName: string;
  readonly isImplemented: boolean;

  checkAccess(mediaRef: MediaRef, user: UserProfile | null, episode?: Episode): Promise<boolean>;

  getPlaybackUrl(
    mediaRef: MediaRef,
    user: UserProfile | null,
    episode?: Episode
  ): Promise<MediaPlaybackResolution>;

  upload(file: File, metadata?: MediaUploadMetadata): Promise<MediaRef>;
}
