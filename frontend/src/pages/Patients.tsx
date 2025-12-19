import { useState, useEffect, MouseEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { patientService } from '@/lib/services/patientService';
import { CreatePatientDialog } from '@/components/patient/CreatePatientDialog';
import { Search, ChevronDown, User, FileText, Plus, Loader2, MessageCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import type { Patient } from '@/types/api';

const Patients = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const itemsPerPage = 20;

  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Debounced search - update query after user stops typing
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch patients with filters from backend API
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['patients', currentPage, statusFilter, debouncedSearch],
    queryFn: () =>
      patientService.getAll({
        skip: (currentPage - 1) * itemsPerPage,
        limit: itemsPerPage,
        status_filter: statusFilter !== 'all' ? (statusFilter as 'active' | 'on_hold' | 'discharged') : undefined,
        search: debouncedSearch || undefined,
      }),
  });



  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load patients. Please try again.',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const patients: Patient[] = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / itemsPerPage);



  // Delete patient mutation
  const deletePatientMutation = useMutation({
    mutationFn: async (patientId: string) => {
      await patientService.delete(patientId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast({
        title: 'Success',
        description: 'Patient deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || error.message || 'Failed to delete patient',
        variant: 'destructive',
      });
    },
  });

  const handleDeletePatient = (patient: Patient, e: MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    if (window.confirm(`Are you sure you want to delete ${patient.full_name}? This action cannot be undone.`)) {
      deletePatientMutation.mutate(patient.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success';
      case 'on_hold':
        return 'bg-warning';
      case 'discharged':
        return 'bg-muted-foreground';
      default:
        return 'bg-muted-foreground';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const calculateAge = (dateOfBirth: string | null): string => {
    if (!dateOfBirth) return 'N/A';
    try {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return `${age} years`;
    } catch {
      return 'N/A';
    }
  };

  return (
    <MainLayout title="Patients List">
      <div className="animate-fade-in">
        {/* Top Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, condition..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="filter-pill appearance-none pr-8 cursor-pointer"
              >
                <option value="all">Status: All</option>
                <option value="active">Status: Active</option>
                <option value="on_hold">Status: On Hold</option>
                <option value="discharged">Status: Discharged</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
            </div>
          </div>

          <Button
            onClick={() => setCreatePatientOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add New Patient
          </Button>

          <CreatePatientDialog open={createPatientOpen} onOpenChange={setCreatePatientOpen} />
        </div>

        {/* Table */}
        <div className="stat-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading patients...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-destructive mb-4">Failed to load patients</p>
              <Button onClick={() => refetch()} variant="outline">
                Retry
              </Button>
            </div>
          ) : patients.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">No patients found</p>
            </div>
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient Name</th>
                    <th>Condition</th>
                    <th>Status</th>
                    <th>Sessions</th>
                    <th>Missed</th>
                    <th>Age</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => navigate(`/patients/${patient.id}`)}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{patient.full_name}</p>
                            <p className="text-sm text-muted-foreground">{patient.condition || 'No condition specified'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-foreground">{patient.condition || 'N/A'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getStatusColor(patient.status)}`} />
                          <span className="text-foreground capitalize">{patient.status.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="text-foreground font-medium">{patient.total_sessions || 0}</td>
                      <td className="text-foreground font-medium">
                        <span className={patient.missed_sessions && patient.missed_sessions > 0 ? 'text-destructive' : ''}>
                          {patient.missed_sessions || 0}
                        </span>
                      </td>
                      <td className="text-muted-foreground">{calculateAge(patient.date_of_birth)}</td>
                      <td className="text-muted-foreground">
                        {formatDate(patient.created_at)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              // Navigate to patient chat
                              navigate(`/messages?patientId=${patient.id}`);
                              toast({
                                title: 'Chat with Patient',
                                description: `Opening chat with ${patient.full_name}`,
                              });
                            }}
                            className="p-2 hover:bg-secondary rounded-lg transition-colors"
                            title="Message Patient"
                          >
                            <MessageCircle className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => {
                              // Navigate to patient protocols
                              navigate(`/sessions?patientId=${patient.id}`);
                              toast({
                                title: 'Patient Protocols',
                                description: `View protocols for ${patient.full_name}`,
                              });
                            }}
                            className="p-2 hover:bg-secondary rounded-lg transition-colors"
                            title="View Protocols"
                          >
                            <FileText className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button
                            onClick={(e) => handleDeletePatient(patient, e)}
                            className="p-2 hover:bg-secondary rounded-lg transition-colors text-destructive hover:text-destructive"
                            title="Delete Patient"
                            disabled={deletePatientMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-4 border-t border-border">
                  <span className="text-sm text-muted-foreground">
                    Showing{' '}
                    <span className="text-foreground font-medium">
                      {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, total)}
                    </span>{' '}
                    of <span className="text-foreground font-medium">{total}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'ghost'}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <span className="text-muted-foreground px-2">...</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Patients;
