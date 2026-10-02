import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LandingPage from './pages/LandingPage';
import ExplorePage from './pages/ExplorePage';
import InputPage from './pages/InputPage';
import ResultsPage from './pages/ResultsPage';
import DocumentationPage from './pages/DocumentationPage';
import ErrorBoundary from './components/ErrorBoundary';

import MobileBlocker from './components/MobileBlocker';

function App() {
  return (
    <ErrorBoundary>
      <MobileBlocker>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<LandingPage />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route path="input" element={<InputPage />} />
              <Route path="results" element={<ResultsPage />} />
              <Route path="docs" element={<DocumentationPage />} />
              <Route path="documentation" element={<DocumentationPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </MobileBlocker>
    </ErrorBoundary>
  );
}

export default App;
