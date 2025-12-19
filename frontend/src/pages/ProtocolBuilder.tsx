import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { exerciseService } from '@/lib/services/exerciseService';
import { protocolService } from '@/lib/services/protocolService';
import { assignmentService } from '@/lib/services/assignmentService';
import { patientService } from '@/lib/services/patientService';
import { messageService } from '@/lib/services/messageService';
import { Search, ChevronDown, Plus, GripVertical, Trash2, Loader2, Save, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import type { Exercise } from '@/types/api';
import type { ProtocolStepCreate } from '@/types/api';

/**
 * ProtocolBuilder Component
 * 
 * Allows doctors to create protocols by selecting exercises and assigning them to patients.
 * 
 * NOTE: Exercises are currently from mock data because backend doesn't have GET /exercises endpoint.
 * TODO: Replace mock exercises with API call when exercises endpoint is available.
 */
interface ProtocolExercise extends Exercise {
  sets: number;
  reps: number;
  duration_seconds: number | null;
  side: 'left' | 'right' | 'both' | null;
  order_index: number;
}

const ProtocolBuilder = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [protocol, setProtocol] = useState<ProtocolExercise[]>([]);
  const [protocolName, setProtocolName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');

  // Fetch patients for assignment
  const { data: patientsData } = useQuery({
    queryKey: ['patients', 'for-assignment'],
    queryFn: () => patientService.getAll({ limit: 100 }),
  });

  // Fetch exercises from API
  const { data: exercisesData, isLoading: exercisesLoading } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => exerciseService.getAll(),
  });

  // Filter exercises by search
  const filteredExercises = (exercisesData?.data || []).filter((exercise) =>
    exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exercise.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
    (exercise.joint?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  // Create protocol mutation
  const createProtocolMutation = useMutation({
    mutationFn: async (isDraft: boolean) => {
      if (!protocolName.trim()) {
        throw new Error('Protocol name is required');
      }
      if (protocol.length === 0) {
        throw new Error('Add at least one exercise to the protocol');
      }

      // Convert protocol exercises to API format
      const steps: ProtocolStepCreate[] = protocol.map((ex, index) => ({
        exercise_id: ex.id,
        sets: ex.sets || null,
        reps: ex.reps || null,
        duration_seconds: ex.duration_seconds,
        side: ex.side || null,
        order_index: index,
        notes: null,
      }));

      return protocolService.create({
        title: protocolName.trim(),
        notes: isDraft ? 'Draft protocol' : null,
        steps,
      });
    },
    onSuccess: (data, isDraft) => {
      queryClient.invalidateQueries({ queryKey: ['protocols'] });
      toast({
        title: 'Success',
        description: isDraft ? 'Protocol saved as draft' : 'Protocol created successfully',
      });
      if (!isDraft && selectedPatientId) {
        // If assigning to patient, create assignment
        createAssignmentMutation.mutate({ protocolId: data.id, patientId: selectedPatientId, protocolTitle: protocolName.trim() });
      } else {
        // Reset form
        setProtocol([]);
        setProtocolName('');
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || error.message || 'Failed to create protocol',
        variant: 'destructive',
      });
    },
  });

  // Create assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: async ({ protocolId, patientId, protocolTitle }: { protocolId: string; patientId: string; protocolTitle: string }) => {
      const today = new Date().toISOString().split('T')[0];
      return assignmentService.create({
        patient_id: patientId,
        protocol_id: protocolId,
        start_date: today,
        frequency_per_week: 3, // Default, could be configurable
        status: 'active',
      }).then(async (assignment) => {
        // Send notification message to patient
        try {
          await messageService.send({
            to_user: patientId,
            text: `A new protocol "${protocolTitle}" has been assigned to you. Please check your home page to get started.`,
          });
        } catch (msgError) {
          // Don't fail assignment if message fails
          console.warn('Failed to send assignment notification message:', msgError);
        }
        return assignment;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] }); // Refresh messages list
      toast({
        title: 'Success',
        description: 'Protocol assigned to patient successfully. They have been notified.',
      });
      setProtocol([]);
      setProtocolName('');
      setSelectedPatientId('');
      navigate('/patients');
    },
    onError: (error: any) => {
      console.error('Assignment creation error:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message || 'Failed to assign protocol';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const addToProtocol = (exercise: Exercise) => {
    if (!protocol.find((e) => e.id === exercise.id)) {
      setProtocol([
        ...protocol,
        {
          ...exercise,
          sets: 3,
          reps: 10,
          duration_seconds: null,
          side: 'both',
          order_index: protocol.length,
        },
      ]);
    }
  };

  const removeFromProtocol = (id: string) => {
    setProtocol(protocol.filter((e) => e.id !== id).map((ex, idx) => ({ ...ex, order_index: idx })));
  };

  const updateExercise = (id: string, updates: Partial<ProtocolExercise>) => {
    setProtocol(protocol.map((ex) => (ex.id === id ? { ...ex, ...updates } : ex)));
  };

  const handleSaveDraft = () => {
    createProtocolMutation.mutate(true);
  };

  const handleAssignToPatient = () => {
    if (!selectedPatientId) {
      toast({
        title: 'Error',
        description: 'Please select a patient',
        variant: 'destructive',
      });
      return;
    }
    createProtocolMutation.mutate(false);
  };

  return (
    <MainLayout title="Protocol Builder" subtitle="Select exercises to build a new protocol for your patients.">
      <div className="flex gap-6 animate-fade-in">
        {/* Exercise Library */}
        <div className="flex-1">
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12"
            />
          </div>

          {/* Exercise Grid */}
          {exercisesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading exercises...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {filteredExercises.map((exercise) => (
                  <div key={exercise.id} className="exercise-card group">
                    <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
                      {exercise.image_url ? (
                        <img
                          src={exercise.image_url}
                          alt={exercise.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <span className="text-sm">No Image</span>
                        </div>
                      )}
                      <button
                        onClick={() => addToProtocol(exercise)}
                        disabled={!!protocol.find((e) => e.id === exercise.id)}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-foreground mb-2">{exercise.name}</h3>
                      <div className="flex flex-wrap gap-1">
                        {exercise.joint && (
                          <span className="px-2 py-1 rounded-md bg-secondary text-muted-foreground text-xs">
                            {exercise.joint}
                          </span>
                        )}
                        {exercise.difficulty && (
                          <span className="px-2 py-1 rounded-md bg-secondary text-muted-foreground text-xs">
                            {exercise.difficulty}
                          </span>
                        )}
                        {exercise.position && (
                          <span className="px-2 py-1 rounded-md bg-secondary text-muted-foreground text-xs">
                            {exercise.position}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredExercises.length === 0 && !exercisesLoading && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No exercises found matching &quot;{searchTerm}&quot;</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Current Protocol Panel */}
        <div className="w-80 flex-shrink-0">
          <div className="sticky top-24">
            <div className="stat-card">
              <h3 className="text-lg font-semibold text-foreground mb-1">Current Protocol</h3>
              <p className="text-sm text-muted-foreground mb-4">{protocol.length} exercise(s)</p>

              <div className="space-y-3 mb-6 max-h-[400px] overflow-y-auto scrollbar-thin">
                {protocol.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No exercises added yet</p>
                ) : (
                  protocol.map((exercise, index) => (
                    <div key={exercise.id} className="protocol-item">
                      <div className="flex items-center gap-2 mb-3">
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                        <span className="font-medium text-foreground flex-1 text-sm">{exercise.name}</span>
                        <button
                          onClick={() => removeFromProtocol(exercise.id)}
                          className="p-1 hover:bg-card rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Sets</label>
                          <Input
                            type="number"
                            min="1"
                            value={exercise.sets}
                            onChange={(e) => updateExercise(exercise.id, { sets: parseInt(e.target.value) || 0 })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Reps</label>
                          <Input
                            type="number"
                            min="1"
                            value={exercise.reps}
                            onChange={(e) => updateExercise(exercise.id, { reps: parseInt(e.target.value) || 0 })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="text-xs text-muted-foreground block mb-1">Side</label>
                        <select
                          value={exercise.side || 'both'}
                          onChange={(e) =>
                            updateExercise(exercise.id, { side: e.target.value as 'left' | 'right' | 'both' })
                          }
                          className="w-full h-8 text-xs bg-card border border-border rounded px-2"
                        >
                          <option value="both">Both</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Input
                type="text"
                placeholder="Protocol Name (e.g., Post-ACL Week 1)"
                value={protocolName}
                onChange={(e) => setProtocolName(e.target.value)}
                className="w-full mb-4"
              />

              {/* Patient Selection for Assignment */}
              <div className="mb-4">
                <label className="text-xs text-muted-foreground block mb-1">Assign to Patient (optional)</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full h-9 text-sm bg-card border border-border rounded px-3"
                >
                  <option value="">None (Save as Draft)</option>
                  {patientsData?.data.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={handleSaveDraft}
                  disabled={createProtocolMutation.isPending || !protocolName.trim() || protocol.length === 0}
                >
                  {createProtocolMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Draft
                    </>
                  )}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAssignToPatient}
                  disabled={
                    createProtocolMutation.isPending ||
                    createAssignmentMutation.isPending ||
                    !protocolName.trim() ||
                    protocol.length === 0 ||
                    !selectedPatientId
                  }
                >
                  {createAssignmentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      {selectedPatientId ? 'Assign' : 'Create'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ProtocolBuilder;
