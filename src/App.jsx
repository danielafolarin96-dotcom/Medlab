import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import FullScreenLoader from './components/FullScreenLoader'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminAuditLog from './pages/admin/AdminAuditLog'
import ClinicianDashboard from './pages/clinician/ClinicianDashboard'
import ClinicianPatients from './pages/clinician/ClinicianPatients'
import PatientDetail from './pages/clinician/PatientDetail'
import PatientDashboard from './pages/patient/PatientDashboard'

const HOME_BY_ROLE = { admin: '/admin', clinician: '/clinician', patient: '/patient' }

function RootRedirect() {
  const { session, role, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={HOME_BY_ROLE[role] ?? '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RootRedirect />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminAuditLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clinician"
        element={
          <ProtectedRoute allowedRoles={['clinician']}>
            <ClinicianDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clinician/patients"
        element={
          <ProtectedRoute allowedRoles={['clinician']}>
            <ClinicianPatients />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clinician/patients/:patientId"
        element={
          <ProtectedRoute allowedRoles={['clinician']}>
            <PatientDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/*"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
