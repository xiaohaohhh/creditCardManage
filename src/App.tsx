import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { AddCardPage } from './pages/AddCardPage';
import { EditCardPage } from './pages/EditCardPage';
import { SettingsPage } from './pages/SettingsPage';
import { BillsPage } from './pages/BillsPage';
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/add" element={<AddCardPage />} />
        <Route path="/edit/:id" element={<EditCardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/bills" element={<BillsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;