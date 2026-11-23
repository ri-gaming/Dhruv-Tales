import type { Episode, MediaRef, UserProfile } from '../../types';
import type {
  MediaPlaybackResolution,
  MediaProvider,
  MediaUploadMetadata,
} from './MediaProvider';

export class DriveProvider implements MediaProvider {
  readonly providerType = 'drive' as const;
  readonly displayName = 'Google Drive Provider (Not Implemented)';
  readonly isImplemented = false;

  async checkAccess(_mediaRef: MediaRef, _user: UserProfile | null, _episode?: Episode): Promise<boolean> {
    throw new Error('DriveProvider.checkAccess is not implemented yet.');
  }

  async getPlaybackUrl(
    _mediaRef: MediaRef,
    _user: UserProfile | null,
    _episode?: Episode
  ): Promise<MediaPlaybackResolution> {
    throw new Error('DriveProvider.getPlaybackUrl is not implemented yet.');
  }

  async upload(_file: File, _metadata?: MediaUploadMetadata): Promise<MediaRef> {
    throw new Error('DriveProvider.upload is not implemented yet.');
  }
}
