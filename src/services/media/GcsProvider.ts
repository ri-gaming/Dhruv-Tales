import type { Episode, MediaRef, UserProfile } from '../../types';
import type {
  MediaPlaybackResolution,
  MediaProvider,
  MediaUploadMetadata,
} from './MediaProvider';

export class GcsProvider implements MediaProvider {
  readonly providerType = 'gcs' as const;
  readonly displayName = 'Google Cloud Storage Provider (Not Implemented)';
  readonly isImplemented = false;

  async checkAccess(_mediaRef: MediaRef, _user: UserProfile | null, _episode?: Episode): Promise<boolean> {
    throw new Error('GcsProvider.checkAccess is not implemented yet.');
  }

  async getPlaybackUrl(
    _mediaRef: MediaRef,
    _user: UserProfile | null,
    _episode?: Episode
  ): Promise<MediaPlaybackResolution> {
    throw new Error('GcsProvider.getPlaybackUrl is not implemented yet.');
  }

  async upload(_file: File, _metadata?: MediaUploadMetadata): Promise<MediaRef> {
    throw new Error('GcsProvider.upload is not implemented yet.');
  }
}
