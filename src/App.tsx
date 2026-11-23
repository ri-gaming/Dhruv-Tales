import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AudioPlayerProvider } from './hooks/useAudioPlayer';
import { AppDataProvider } from './hooks/useAuthAndActivity';
import { LanguageProvider } from './hooks/useLanguage';
import { HomePage } from './pages/HomePage';
import { LibraryPage } from './pages/LibraryPage';
import { ProfilePage } from './pages/ProfilePage';
import { SearchPage } from './pages/SearchPage';
import { StoryDetailsPage } from './pages/StoryDetailsPage';

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AppDataProvider>
          <AudioPlayerProvider>
            <BrowserRouter>
              <AppShell>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/story/:storyId" element={<StoryDetailsPage />} />
                  <Route path="/library" element={<LibraryPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
            </BrowserRouter>
          </AudioPlayerProvider>
        </AppDataProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
