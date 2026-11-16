import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Apply from './pages/Apply';
import HRLogin from './pages/HRLogin';
import HRDashboard from './pages/HRDashboard';
import CreateJob from './pages/CreateJob';
import ManageJobs from './pages/ManageJobs';
import EditJob from './pages/EditJob';
import JobDetails from './pages/JobDetails';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="/apply/:jobId" element={<Apply />} />
        <Route path="/hr-login" element={<HRLogin />} />
        <Route path="/hr-dashboard" element={<HRDashboard />} />
        <Route path="/create-job" element={<CreateJob />} />
        <Route path="/manage-jobs" element={<ManageJobs />} />
        <Route path="/edit-job/:id" element={<EditJob />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
