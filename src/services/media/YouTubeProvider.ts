import type { Episode, MediaRef, UserProfile } from '../../types';
import type {
  MediaPlaybackResolution,
  MediaProvider,
  MediaUploadMetadata,
} from './MediaProvider';

export class YouTubeProvider implements MediaProvider {
  readonly providerType = 'youtube' as const;
  readonly displayName = 'YouTube Provider (Not Implemented)';
  readonly isImplemented = false;

  async checkAccess(_mediaRef: MediaRef, _user: UserProfile | null, _episode?: Episode): Promise<boolean> {
    throw new Error('YouTubeProvider.checkAccess is not implemented yet.');
  }

  async getPlaybackUrl(
    _mediaRef: MediaRef,
    _user: UserProfile | null,
    _episode?: Episode
  ): Promise<MediaPlaybackResolution> {
    throw new Error('YouTubeProvider.getPlaybackUrl is not implemented yet.');
  }

  async upload(_file: File, _metadata?: MediaUploadMetadata): Promise<MediaRef> {
    throw new Error('YouTubeProvider.upload is not implemented yet.');
  }
}
