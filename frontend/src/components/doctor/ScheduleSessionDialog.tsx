import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { sessionService } from '@/lib/services/sessionService';
import { patientService } from '@/lib/services/patientService';
import { protocolService } from '@/lib/services/protocolService';
import { assignmentService } from '@/lib/services/assignmentService';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import type { Patient, Protocol, Assignment } from '@/types/api';

interface ScheduleSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId?: string;
}

export function ScheduleSessionDialog({ open, onOpenChange, patientId: initialPatientId }: ScheduleSessionDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || '');
  const [selectedProtocolId, setSelectedProtocolId] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [notes, setNotes] = useState('');

  // Update selectedPatientId when initialPatientId changes
  useEffect(() => {
    if (initialPatientId) {
      setSelectedPatientId(initialPatientId);
    }
  }, [initialPatientId]);

  // Fetch patients (always fetch to get patient name if pre-selected)
  const { data: patientsData } = useQuery({
    queryKey: ['patients', 'for-scheduling'],
    queryFn: () => patientService.getAll({ limit: 100 }),
  });

  // Fetch assignments for selected patient (this gives us assigned protocols)
  const { data: assignmentsData } = useQuery({
    queryKey: ['assignments', 'patient', selectedPatientId],
    queryFn: () => assignmentService.getAll({ patient_id: selectedPatientId, status: 'active' }),
    enabled: !!selectedPatientId,
  });

  const patients = patientsData?.data || [];
  const assignments: Assignment[] = assignmentsData || [];
  
  // Build protocol assignment map from assignments
  const protocolAssignmentMap = new Map<string, string>(); // protocol_id -> assignment_id
  const assignedProtocolIds: string[] = [];
  
  assignments.forEach(assignment => {
    if (!protocolAssignmentMap.has(assignment.protocol_id)) {
      protocolAssignmentMap.set(assignment.protocol_id, assignment.id);
      assignedProtocolIds.push(assignment.protocol_id);
    }
  });
  
  // Fetch protocol details for assigned protocols
  const { data: protocolsData } = useQuery({
    queryKey: ['protocols', 'assigned', assignedProtocolIds.join(',')],
    queryFn: async () => {
      if (!assignedProtocolIds.length) return [];
      // Fetch each protocol by ID
      const protocolPromises = assignedProtocolIds.map(protocolId => 
        protocolService.getById(protocolId).catch(() => null)
      );
      const protocols = (await Promise.all(protocolPromises)).filter((p): p is Protocol => p !== null);
      return protocols;
    },
    enabled: assignedProtocolIds.length > 0,
  });

  const assignedProtocols: Protocol[] = protocolsData || [];

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatientId || !selectedProtocolId) {
        throw new Error('Please select patient and protocol');
      }

      // Find assignment_id from protocol assignment map
      const assignmentId = protocolAssignmentMap.get(selectedProtocolId);
      if (!assignmentId) {
        throw new Error('No assignment found for this protocol. Please assign the protocol to this patient first via Protocol Builder.');
      }

      // Create session with scheduled date
      // If no date selected, backend will default to today
      return sessionService.create({
        patient_id: selectedPatientId,
        assignment_id: assignmentId,
        protocol_id: selectedProtocolId,
        scheduled_date: sessionDate || undefined, // Send date if provided, otherwise undefined (backend defaults to today)
      });
    },
    onSuccess: () => {
      // Invalidate all session queries to refresh everywhere
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient'] }); // Patient detail page
      toast({
        title: 'Success',
        description: 'Session scheduled successfully',
      });
      // Reset form (but keep patient if it was pre-selected)
      if (!initialPatientId) {
        setSelectedPatientId('');
      }
      setSelectedProtocolId('');
      setSessionDate('');
      setNotes('');
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Session creation error:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message || 'Failed to schedule session';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSessionMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Session</DialogTitle>
          <DialogDescription>
            Create a new session for a patient. The patient will be able to view and start it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!initialPatientId && (
            <div className="space-y-2">
              <Label htmlFor="patient">Patient *</Label>
              <select
                id="patient"
                value={selectedPatientId}
                onChange={(e) => {
                  setSelectedPatientId(e.target.value);
                  setSelectedProtocolId(''); // Reset protocol when patient changes
                }}
                className="w-full px-3 py-2 bg-card border border-border rounded-lg"
                required
                disabled={createSessionMutation.isPending}
              >
                <option value="">Select a patient...</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.full_name} ({patient.condition || 'No condition'})
                  </option>
                ))}
              </select>
            </div>
          )}
          {initialPatientId && (
            <div className="space-y-2">
              <Label htmlFor="patient">Patient</Label>
              <div className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-muted-foreground">
                {patients.find(p => p.id === initialPatientId)?.full_name || 'Loading...'}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="protocol">Protocol *</Label>
            <select
              id="protocol"
              value={selectedProtocolId}
              onChange={(e) => setSelectedProtocolId(e.target.value)}
              className="w-full px-3 py-2 bg-card border border-border rounded-lg"
              required
              disabled={!selectedPatientId || createSessionMutation.isPending}
            >
              <option value="">
                {!selectedPatientId ? 'Select patient first...' : assignedProtocols.length === 0 ? 'No assigned protocols' : 'Select a protocol...'}
              </option>
              {assignedProtocols.map((protocol) => (
                <option key={protocol.id} value={protocol.id}>
                  {protocol.title}
                </option>
              ))}
            </select>
            {selectedPatientId && assignedProtocols.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No protocols assigned to this patient. Assign a protocol first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                disabled={createSessionMutation.isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Session notes..."
              rows={3}
              disabled={createSessionMutation.isPending}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createSessionMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createSessionMutation.isPending || !selectedPatientId || !selectedProtocolId}>
              {createSessionMutation.isPending ? 'Scheduling...' : 'Schedule Session'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

