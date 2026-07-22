import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Apply from './pages/Apply';
import HRLogin from './pages/HRLogin';
import HRDashboard from './pages/HRDashboard';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/apply/:jobId" element={<Apply />} />
        <Route path="/hr-login" element={<HRLogin />} />
        <Route path="/hr-dashboard" element={<HRDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;